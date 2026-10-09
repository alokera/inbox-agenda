"use client";

import { ArrowLeft, Bookmark, Briefcase, CalendarSearch, ChevronLeft, ChevronRight, ExternalLink, Forward, LoaderCircle, Paperclip, Reply, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { formatReaderDate, recipientsLabel, shortNames, splitLinks } from "@/lib/ui-format";
import type { AgendaItem, EmailDetail } from "@/lib/types";
import { AgendaCard } from "../agenda/AgendaCard";
import { ApplicationPanel } from "../jobs/ApplicationPanel";
import { Avatar } from "../ui/Avatar";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { Skeleton } from "../ui/Skeleton";
import { useUser } from "../UserContext";

interface Props {
  emailId: string;
  /** "3 of 2,345" in the toolbar, when the email is in the loaded page. */
  position: { index: number; total: number } | null;
  onBack: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

/** A Gmail-style opened message. Keyed by email id, so all state resets when another email opens. */
export function EmailReader({ emailId, position, onBack, onPrevious, onNext }: Props) {
  const user = useUser();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [openedAt, setOpenedAt] = useState(new Date(0));
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AgendaItem[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson<EmailDetail>(`/api/emails/${emailId}`)
      .then((data) => {
        if (cancelled) return;
        setEmail(data);
        setOpenedAt(new Date());
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [emailId]);

  async function findAppointments() {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const data = await fetchJson<{ items: AgendaItem[] }>(`/api/emails/${emailId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      setAppointments(data.items);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const gmailLink = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(user.email)}#all/${emailId}`;
  const recipients = email ? recipientsLabel(email.to, user.email) : "";

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center gap-1 px-2 sm:px-4">
        <IconButton label="Back" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <button
          type="button"
          onClick={findAppointments}
          disabled={analyzing || !email}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-[#c2e7ff] px-4 text-sm font-medium text-[#001d35] transition-shadow hover:shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] disabled:opacity-60 dark:bg-blue-900 dark:text-blue-50"
        >
          {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">Find appointments</span>
        </button>
        <button
          type="button"
          onClick={() => setApplying(true)}
          disabled={!email}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[#747775] px-4 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.04] disabled:opacity-60 dark:border-zinc-600 dark:text-blue-300"
        >
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">Draft application</span>
        </button>
        <a href={gmailLink} target="_blank" rel="noopener noreferrer" title="Open in Gmail" aria-label="Open in Gmail" className="flex h-10 w-10 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-zinc-300 dark:hover:bg-white/10">
          <ExternalLink className="h-[18px] w-[18px]" />
        </a>
        <div className="ml-auto flex items-center gap-1 text-xs text-[#444746] dark:text-zinc-400">
          {position && <span className="hidden px-2 tabular-nums sm:inline">{position.index.toLocaleString()} of {position.total.toLocaleString()}</span>}
          <IconButton label="Newer" onClick={() => onPrevious?.()} disabled={!onPrevious}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton label="Older" onClick={() => onNext?.()} disabled={!onNext}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="m-6 rounded-lg bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        {!email && !error && (
          <div className="space-y-5 px-4 py-5 sm:pl-[72px] sm:pr-14">
            <Skeleton className="h-7 w-2/3" />
            <div className="flex gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/5" /></div></div>
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-4" />)}
          </div>
        )}

        {email && (
          <article className="px-4 pb-10 pt-5 sm:pl-[72px] sm:pr-14">
            {/* Subject with label chips */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[22px] leading-7 text-[#1f1f1f] dark:text-zinc-50">{email.subject}</h1>
              {email.important && <Bookmark className="h-5 w-5 -rotate-90 fill-[#f4b400] text-[#f4b400]" aria-label="Important" />}
              {email.labels.map((label) => (
                <span key={label} className="rounded bg-[#dde3ea] px-1.5 text-xs leading-5 text-[#444746] dark:bg-zinc-700 dark:text-zinc-200">{label}</span>
              ))}
            </div>

            {/* Sender row */}
            <div className="relative mt-5 flex items-start gap-3">
              <div className="sm:absolute sm:-left-14"><Avatar name={email.from.name} email={email.from.email} size="lg" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-bold text-[#1f1f1f] dark:text-zinc-50">{email.from.name}</span>
                  {email.from.name !== email.from.email && <span className="text-xs text-[#5f6368] dark:text-zinc-400"> &lt;{email.from.email}&gt;</span>}
                </p>
                <p className="truncate text-xs text-[#5f6368] dark:text-zinc-400">
                  to {recipients || "me"}{email.cc && `, cc ${shortNames(email.cc)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-[#5f6368] dark:text-zinc-400">
                <time className="hidden md:inline">{formatReaderDate(email.date, openedAt)}</time>
                <Star className={`h-5 w-5 ${email.starred ? "fill-[#f4b400] text-[#f4b400]" : "text-[#c4c7c5] dark:text-zinc-600"}`} aria-label={email.starred ? "Starred" : undefined} />
              </div>
            </div>
            <time className="mt-1 block text-xs text-[#5f6368] md:hidden dark:text-zinc-400">{formatReaderDate(email.date, openedAt)}</time>

            {applying && <ApplicationPanel emailId={email.id} onClose={() => setApplying(false)} />}

            {/* AI results */}
            {(appointments || analyzeError) && (
              <section className="mt-5 space-y-3 rounded-2xl bg-[#f2f6fc] p-4 dark:bg-zinc-800/60">
                <h2 className="flex items-center gap-2 text-sm font-medium text-[#0b57d0] dark:text-blue-300"><Sparkles className="h-4 w-4" />Appointments found by AI</h2>
                {analyzeError && <p className="text-sm text-[#c5221f]">{analyzeError}</p>}
                {appointments?.length === 0 && <EmptyState icon={CalendarSearch} title="No appointments in this email" />}
                {appointments && appointments.length > 0 && <ul className="space-y-2">{appointments.map((item) => <AgendaCard key={item.id} item={item} showEmailLink={false} />)}</ul>}
              </section>
            )}

            {/* Body */}
            <div className="mt-6 whitespace-pre-wrap break-words text-sm leading-6 text-[#222] dark:text-zinc-200">
              {email.text ? (
                splitLinks(email.text).map((segment, i) =>
                  segment.type === "link" ? (
                    <a key={i} href={segment.value} target="_blank" rel="noopener noreferrer nofollow" className="text-[#0b57d0] underline dark:text-blue-300">
                      {segment.value}
                    </a>
                  ) : (
                    <span key={i}>{segment.value}</span>
                  ),
                )
              ) : (
                <span className="text-[#5f6368]">This message has no text content.</span>
              )}
            </div>

            {email.attachments.length > 0 && (
              <div className="mt-8 border-t border-[#f1f3f4] pt-4 dark:border-zinc-800">
                <p className="mb-3 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">{email.attachments.length} attachment{email.attachments.length === 1 ? "" : "s"}</p>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((name, i) => (
                    <span key={i} className="inline-flex max-w-[220px] items-center gap-2 rounded-lg border border-[#dadce0] px-3 py-2 text-xs text-[#3c4043] dark:border-zinc-700 dark:text-zinc-300">
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate">{name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* InboxAgenda is read-only, so replying happens in Gmail itself. */}
            <div className="mt-8 flex flex-wrap gap-3">
              {[{ label: "Reply in Gmail", icon: Reply }, { label: "Forward in Gmail", icon: Forward }].map(({ label, icon: Icon }) => (
                <a key={label} href={gmailLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#747775] px-6 text-sm font-medium text-[#444746] hover:bg-black/[0.04] dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-white/5">
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              ))}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
