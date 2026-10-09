"use client";

import { ChevronLeft, ChevronRight, Inbox, Info, MailOpen, RefreshCw, Search, Tag, Users, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { EmailPage, EmailSummary, MailCategory, MailView as View } from "@/lib/types";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { useMailbox } from "../UserContext";
import { EmailReader } from "./EmailReader";
import { EmailRow } from "./EmailRow";
import { MailSkeleton } from "./MailSkeleton";

const PAGE_SIZE = 50;

const EMPTY: Record<View, string> = {
  inbox: "Your inbox is empty",
  starred: "No starred messages. Stars let you give messages a special status to make them easier to find.",
  important: "No important messages",
  sent: "No sent messages",
  drafts: "You don't have any saved drafts",
  all: "No messages",
  spam: "Hooray, no spam here!",
  trash: "No conversations in Trash",
};

const TABS: { id: MailCategory; label: string; icon: LucideIcon }[] = [
  { id: "primary", label: "Primary", icon: Inbox },
  { id: "promotions", label: "Promotions", icon: Tag },
  { id: "social", label: "Social", icon: Users },
  { id: "updates", label: "Updates", icon: Info },
];

const isCategory = (value: string | null): value is MailCategory => TABS.some((t) => t.id === value);

interface LoadedPage extends EmailPage {
  key: string;
  loadedAt: Date;
}

interface PageNav {
  listKey: string;
  index: number;
  /** tokens[i] fetches page i (undefined = first page). */
  tokens: (string | undefined)[];
}

/**
 * A Gmail mailbox: optional inbox tabs, a toolbar with "1–50 of N" paging, and rows.
 * Opening an email swaps the list for the reader in the same card, with `?id=` in the
 * URL so the browser's back button returns to the list.
 */
interface Props {
  view: View;
  /** A built-in search (e.g. "Job emails"), used when the URL has no ?q. */
  preset?: { query: string; label: string };
}

export function MailView({ view, preset }: Props) {
  const params = useSearchParams();
  const { counts, refreshCounts } = useMailbox();
  const urlQuery = params.get("q");
  const query = urlQuery ?? preset?.query ?? "";
  const showingPreset = Boolean(preset && urlQuery === null);
  const selectedId = params.get("id");
  const tab = params.get("tab");
  const category: MailCategory | undefined = view === "inbox" && !query ? (isCategory(tab) ? tab : "primary") : undefined;

  // Paging restarts whenever the list itself changes (view, tab or search).
  const listKey = `${view}|${category ?? ""}|${query}`;
  const [nav, setNav] = useState<PageNav>({ listKey, index: 0, tokens: [undefined] });
  const pageNav = nav.listKey === listKey ? nav : { listKey, index: 0, tokens: [undefined] };
  const pageToken = pageNav.tokens[pageNav.index];

  const [refreshTick, setRefreshTick] = useState(0);
  const fetchKey = `${listKey}|${pageNav.index}|${refreshTick}`;
  const [page, setPage] = useState<LoadedPage | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const loading = page?.key !== fetchKey && error?.key !== fetchKey;
  const openedFromList = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const search = new URLSearchParams({ view, q: query });
    if (category) search.set("category", category);
    if (pageToken) search.set("pageToken", pageToken);
    fetchJson<EmailPage>(`/api/emails?${search}`)
      .then((data) => !cancelled && setPage({ key: fetchKey, ...data, loadedAt: new Date() }))
      .catch((err) => !cancelled && setError({ key: fetchKey, message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [view, category, query, pageToken, fetchKey]);

  /** Updates the query string without a reload; Next.js keeps useSearchParams in sync. */
  function setParams(update: Record<string, string | null>, mode: "push" | "replace" = "push") {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(update)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const url = next.size ? `?${next}` : window.location.pathname;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  function openEmail(id: string) {
    openedFromList.current = true;
    setParams({ id });
  }

  function closeEmail() {
    if (openedFromList.current) {
      openedFromList.current = false;
      window.history.back();
    } else {
      setParams({ id: null }, "replace"); // opened from a shared link: there's no list entry to go back to
    }
  }

  function refresh() {
    setRefreshTick((t) => t + 1);
    refreshCounts();
  }

  const emails: EmailSummary[] = page?.key === fetchKey ? page.emails : [];
  const exactTotal = !query && !category ? counts?.[view]?.total : undefined;
  const start = pageNav.index * PAGE_SIZE + 1;
  const end = start + emails.length - 1;
  const total = exactTotal ?? (page && page.estimatedTotal >= end ? page.estimatedTotal : undefined);
  const hasNext = Boolean(page?.key === fetchKey && page.nextPageToken);

  function goToPage(delta: 1 | -1) {
    if (delta === 1 && page?.nextPageToken) {
      setNav({ listKey, index: pageNav.index + 1, tokens: [...pageNav.tokens.slice(0, pageNav.index + 1), page.nextPageToken] });
    } else if (delta === -1 && pageNav.index > 0) {
      setNav({ ...pageNav, index: pageNav.index - 1 });
    }
  }

  if (selectedId) {
    const position = emails.findIndex((e) => e.id === selectedId);
    return (
      <EmailReader
        key={selectedId}
        emailId={selectedId}
        position={position >= 0 ? { index: pageNav.index * PAGE_SIZE + position + 1, total: total ?? end } : null}
        onBack={closeEmail}
        onPrevious={position > 0 ? () => setParams({ id: emails[position - 1].id }, "replace") : undefined}
        onNext={position >= 0 && position < emails.length - 1 ? () => setParams({ id: emails[position + 1].id }, "replace") : undefined}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center gap-1 px-2 sm:px-4">
        <IconButton label="Refresh" onClick={refresh}>
          <RefreshCw className={`h-[18px] w-[18px] ${loading ? "animate-spin" : ""}`} />
        </IconButton>
        {showingPreset && preset ? (
          <span className="truncate px-2 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">{preset.label}</span>
        ) : (
          query && <span className="truncate px-2 text-sm text-[#444746] dark:text-zinc-300">Search results for <strong className="font-medium">&ldquo;{query}&rdquo;</strong></span>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs text-[#444746] dark:text-zinc-400">
          {emails.length > 0 && (
            <span className="px-2 tabular-nums">
              {start.toLocaleString()}–{end.toLocaleString()} of {total !== undefined ? total.toLocaleString() : "many"}
            </span>
          )}
          <IconButton label="Newer" onClick={() => goToPage(-1)} disabled={pageNav.index === 0 || loading}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton label="Older" onClick={() => goToPage(1)} disabled={!hasNext || loading}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {/* Inbox tabs */}
      {category && (
        <div className="flex shrink-0 overflow-x-auto border-b border-[#f1f3f4] dark:border-zinc-800">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === category;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setParams({ tab: id === "primary" ? null : id, id: null })}
                className={`flex h-14 min-w-[140px] flex-1 items-center gap-4 border-b-[3px] px-4 text-sm font-medium transition-colors sm:max-w-[250px] ${
                  active
                    ? "border-[#0b57d0] text-[#0b57d0] dark:border-blue-400 dark:text-blue-300"
                    : "border-transparent text-[#444746] hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:bg-white/5"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error?.key === fetchKey && (
          <p className="m-4 rounded-lg bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/50 dark:text-red-300">{error.message}</p>
        )}
        {loading && <MailSkeleton />}
        {!loading && error?.key !== fetchKey && emails.length === 0 && (
          <EmptyState icon={query ? Search : MailOpen} title={showingPreset ? "No job emails found in the last 60 days" : query ? "No messages matched your search" : EMPTY[view]} />
        )}
        {!loading && emails.length > 0 && page && (
          <ul>
            {emails.map((email) => (
              <EmailRow key={email.id} email={email} view={view} now={page.loadedAt} onOpen={() => openEmail(email.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
