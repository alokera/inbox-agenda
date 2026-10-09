import type { AgendaItem } from "@/lib/types";

const timeFormat: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const dateFormat: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

export function AgendaCard({ item, userEmail }: { item: AgendaItem; userEmail: string }) {
  const start = new Date(item.start);
  const end = item.end ? new Date(item.end) : null;
  const cancelled = item.status === "cancelled";
  const time = item.allDay ? "All day" : `${start.toLocaleTimeString([], timeFormat)}${end ? ` – ${end.toLocaleTimeString([], timeFormat)}` : ""}`;

  return (
    <li
      className={`flex gap-4 rounded-xl border p-4 ${
        item.missingFromCalendar
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="w-24 shrink-0 text-sm">
        <div className="font-semibold tabular-nums">{time}</div>
        <div className="text-xs text-neutral-500">{start.toLocaleDateString([], dateFormat)}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`font-medium ${cancelled ? "text-neutral-400 line-through" : ""}`}>{item.title}</h3>
          {cancelled && <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">Cancelled</Badge>}
          {item.status === "rescheduled" && <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">Rescheduled</Badge>}
          {item.missingFromCalendar && <Badge className="bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">Not in your calendar</Badge>}
          {item.confidence !== null && item.confidence < 0.7 && (
            <Badge className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Unsure ({Math.round(item.confidence * 100)}%)</Badge>
          )}
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {[item.location, item.organizer && `with ${item.organizer}`].filter(Boolean).join(" · ")}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
          <span className="text-neutral-500">{item.source === "calendar" ? "📅 Calendar" : "✉️ Found in email"}</span>
          {item.meetingLink && <ExternalLink href={item.meetingLink}>Join meeting</ExternalLink>}
          {item.emailId && (
            // authuser picks the right Google account when several are signed in.
            <ExternalLink href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(userEmail)}#all/${item.emailId}`} title={item.emailSubject ?? undefined}>
              Open email
            </ExternalLink>
          )}
          {item.calendarLink && <ExternalLink href={item.calendarLink}>Open in Calendar</ExternalLink>}
        </div>
      </div>
    </li>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function ExternalLink({ href, title, children }: { href: string; title?: string; children: React.ReactNode }) {
  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
      {children} ↗
    </a>
  );
}
