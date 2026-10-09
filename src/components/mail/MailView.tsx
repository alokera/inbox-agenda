"use client";

import { Bookmark, Inbox, LoaderCircle, Mail, MailOpen, RefreshCw, Search, Star, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { EmailPage, EmailSummary, MailView as View } from "@/lib/types";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { EmailListItem } from "./EmailListItem";
import { EmailReader } from "./EmailReader";

const VIEWS: Record<View, { title: string; description: string; icon: LucideIcon; empty: string }> = {
  important: { title: "Important", description: "Emails Gmail's AI marked as important to you", icon: Bookmark, empty: "Nothing marked important." },
  inbox: { title: "Inbox", description: "Everything in your inbox", icon: Inbox, empty: "Your inbox is empty." },
  unread: { title: "Unread", description: "Inbox emails you haven't opened yet", icon: Mail, empty: "You're all caught up." },
  starred: { title: "Starred", description: "Emails you've starred", icon: Star, empty: "No starred emails." },
};

interface LoadedPage {
  key: string;
  emails: EmailSummary[];
  nextPageToken: string | null;
  estimatedTotal: number;
  loadedAt: Date;
}

export function MailView({ view }: { view: View }) {
  const config = VIEWS[view];
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [page, setPage] = useState<LoadedPage | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Everything that defines the current list; loading = we don't have data for this key yet.
  const key = `${view}|${query}|${refreshTick}`;
  const loading = page?.key !== key && error?.key !== key;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ view, q: query });
    fetchJson<EmailPage>(`/api/emails?${params}`)
      .then((data) => !cancelled && setPage({ key, ...data, loadedAt: new Date() }))
      .catch((err) => !cancelled && setError({ key, message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [view, query, key]);

  async function loadMore() {
    if (!page?.nextPageToken) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ view, q: query, pageToken: page.nextPageToken });
      const more = await fetchJson<EmailPage>(`/api/emails?${params}`);
      setPage({ ...page, emails: [...page.emails, ...more.emails], nextPageToken: more.nextPageToken });
    } catch (err) {
      setError({ key, message: err instanceof Error ? err.message : "Couldn't load more" });
    } finally {
      setLoadingMore(false);
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSelectedId(null);
    setQuery(search.trim());
  }

  const emails = page?.key === key ? page.emails : [];

  return (
    <div className="flex h-full">
      {/* List pane */}
      <section className={`flex h-full w-full flex-col border-r border-zinc-200 lg:w-[26rem] lg:shrink-0 xl:w-[30rem] dark:border-zinc-800 ${selectedId ? "hidden lg:flex" : "flex"}`}>
        <header className="space-y-3 border-b border-zinc-200 px-4 pb-3 pt-4 dark:border-zinc-800">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <config.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {config.title}
              </h1>
              <p className="text-xs text-zinc-500">{config.description}</p>
            </div>
            <button type="button" onClick={() => setRefreshTick((t) => t + 1)} title="Refresh" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mail (supports Gmail syntax, e.g. from:amazon)"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-8 text-sm outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-indigo-950"
            />
            {query && (
              <button type="button" onClick={() => { setSearch(""); setQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error?.key === key && <p className="m-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error.message}</p>}

          {loading && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-full" /></div>
                </li>
              ))}
            </ul>
          )}

          {!loading && error?.key !== key && emails.length === 0 && <EmptyState icon={query ? Search : MailOpen} title={query ? "No emails match your search" : config.empty} />}

          {!loading && emails.length > 0 && page && (
            <>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {emails.map((email) => (
                  <EmailListItem key={email.id} email={email} now={page.loadedAt} selected={email.id === selectedId} onSelect={() => setSelectedId(email.id)} />
                ))}
              </ul>
              <div className="p-4 text-center">
                {page.nextPageToken ? (
                  <button type="button" onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">
                    {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Load more
                  </button>
                ) : (
                  <p className="text-xs text-zinc-400">That&apos;s everything</p>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Reader pane */}
      <section className={`h-full min-w-0 flex-1 bg-white dark:bg-zinc-950 ${selectedId ? "block" : "hidden lg:block"}`}>
        {selectedId ? (
          <EmailReader key={selectedId} emailId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon={MailOpen} title="Select an email to read" description="Open any email, then use “Find appointments” to let AI pull out meetings and bookings." />
          </div>
        )}
      </section>
    </div>
  );
}
