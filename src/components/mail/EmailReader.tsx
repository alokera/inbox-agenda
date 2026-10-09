"use client";

import { ArrowLeft, Bookmark, CalendarSearch, ExternalLink, LoaderCircle, Paperclip, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { formatFullDate, splitLinks } from "@/lib/ui-format";
import type { AgendaItem, EmailDetail } from "@/lib/types";
import { AgendaCard } from "../agenda/AgendaCard";
import { Avatar } from "../ui/Avatar";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { useUser } from "../UserContext";

interface Props {
  emailId: string;
  onBack: () => void;
}

/** Keyed by email id by its parent, so all state resets when another email is opened. */
export function EmailReader({ emailId, onBack }: Props) {
  const user = useUser();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AgendaItem[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<EmailDetail>(`/api/emails/${emailId}`)
      .then((data) => !cancelled && setEmail(data))
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <button type="button" onClick={onBack} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800" aria-label="Back to list">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={findAppointments}
            disabled={analyzing || !email}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Find appointments
          </button>
          <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Open in Gmail</span>
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="m-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p>}

        {!email && !error && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-3/4" />
            <div className="flex gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div></div>
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        )}

        {email && (
          <article className="mx-auto max-w-3xl space-y-6 p-6">
            <header className="space-y-4">
              <div className="flex items-start gap-2">
                <h1 className="flex-1 text-xl font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{email.subject}</h1>
                {email.important && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Bookmark className="h-3 w-3 fill-current" />Important</span>}
                {email.starred && <Star className="mt-1.5 h-4 w-4 fill-yellow-400 text-yellow-400" aria-label="Starred" />}
              </div>
              <div className="flex items-center gap-3">
                <Avatar name={email.from.name} email={email.from.email} size="lg" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{email.from.name}</span>{" "}
                    {email.from.name !== email.from.email && <span className="text-zinc-500">&lt;{email.from.email}&gt;</span>}
                  </p>
                  <p className="truncate text-zinc-500">to {email.to || "me"}{email.cc && `, cc ${email.cc}`}</p>
                </div>
                <time className="shrink-0 text-xs text-zinc-500">{formatFullDate(email.date)}</time>
              </div>
            </header>

            {(appointments || analyzeError) && (
              <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-indigo-900 dark:text-indigo-200"><Sparkles className="h-4 w-4" />AI found in this email</h2>
                {analyzeError && <p className="text-sm text-rose-600">{analyzeError}</p>}
                {appointments?.length === 0 && <EmptyState icon={CalendarSearch} title="No appointments in this email" />}
                {appointments && appointments.length > 0 && (
                  <ul className="space-y-2">{appointments.map((item) => <AgendaCard key={item.id} item={item} showEmailLink={false} />)}</ul>
                )}
              </section>
            )}

            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
              {email.text ? (
                splitLinks(email.text).map((segment, i) =>
                  segment.type === "link" ? (
                    <a key={i} href={segment.value} target="_blank" rel="noopener noreferrer nofollow" className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 dark:text-indigo-400">
                      {segment.value}
                    </a>
                  ) : (
                    <span key={i}>{segment.value}</span>
                  ),
                )
              ) : (
                <span className="text-zinc-500">This email has no text content.</span>
              )}
            </div>

            {email.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {email.attachments.map((name, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                    <Paperclip className="h-3.5 w-3.5" />{name}
                  </span>
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
