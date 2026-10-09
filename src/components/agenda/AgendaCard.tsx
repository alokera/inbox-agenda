"use client";

import { CalendarDays, ExternalLink, Mail, MapPin, TriangleAlert, User, Video } from "lucide-react";
import type { AgendaItem } from "@/lib/types";
import { useUser } from "../UserContext";

const timeFormat: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function AgendaCard({ item, showEmailLink = true }: { item: AgendaItem; showEmailLink?: boolean }) {
  const user = useUser();
  const start = new Date(item.start);
  const end = item.end ? new Date(item.end) : null;
  const cancelled = item.status === "cancelled";
  const accent = cancelled ? "bg-zinc-300 dark:bg-zinc-700" : item.missingFromCalendar ? "bg-amber-400" : item.source === "calendar" ? "bg-blue-500" : "bg-emerald-500";

  return (
    <li className="group relative flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <span className={`w-1 shrink-0 ${accent}`} aria-hidden />
      <div className="flex min-w-0 flex-1 gap-4 p-4">
        <div className="w-20 shrink-0">
          <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{item.allDay ? "All day" : start.toLocaleTimeString([], timeFormat)}</p>
          {end && !item.allDay && <p className="text-xs tabular-nums text-zinc-500">{end.toLocaleTimeString([], timeFormat)}</p>}
          <p className="mt-1 text-xs text-zinc-500">{start.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className={`mr-1 font-medium leading-snug ${cancelled ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-50"}`}>{item.title}</h3>
            {cancelled && <Pill tone="rose">Cancelled</Pill>}
            {item.status === "rescheduled" && <Pill tone="sky">Rescheduled</Pill>}
            {item.missingFromCalendar && <Pill tone="amber"><TriangleAlert className="h-3 w-3" />Not in calendar</Pill>}
            {item.confidence !== null && item.confidence < 0.7 && <Pill tone="zinc">AI unsure · {Math.round(item.confidence * 100)}%</Pill>}
          </div>

          {(item.location || item.organizer) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {item.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.location}</span></span>}
              {item.organizer && <span className="inline-flex min-w-0 items-center gap-1"><User className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.organizer}</span></span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              {item.source === "calendar" ? <CalendarDays className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
              {item.source === "calendar" ? "Google Calendar" : "Found in email"}
            </span>
            <span className="flex-1" />
            {item.meetingLink && <ActionLink href={item.meetingLink} primary><Video className="h-3.5 w-3.5" />Join</ActionLink>}
            {showEmailLink && item.emailId && (
              <ActionLink href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(user.email)}#all/${item.emailId}`} title={item.emailSubject ?? undefined}>
                <Mail className="h-3.5 w-3.5" />Email
              </ActionLink>
            )}
            {item.calendarLink && <ActionLink href={item.calendarLink}><ExternalLink className="h-3.5 w-3.5" />Calendar</ActionLink>}
          </div>
        </div>
      </div>
    </li>
  );
}

function Pill({ tone, children }: { tone: "rose" | "sky" | "amber" | "zinc"; children: React.ReactNode }) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900",
    sky: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900",
    amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
    zinc: "bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

function ActionLink({ href, title, primary, children }: { href: string; title?: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
        primary ? "bg-[#0b57d0] text-white hover:bg-[#0a4fbd]" : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </a>
  );
}
