import { Bookmark, Star } from "lucide-react";
import { formatListDate, shortNames } from "@/lib/ui-format";
import type { EmailSummary, MailView } from "@/lib/types";
import { Avatar } from "../ui/Avatar";

interface Props {
  email: EmailSummary;
  view: MailView;
  now: Date;
  onOpen: () => void;
}

const VIEW_LABEL: Partial<Record<MailView, string>> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", spam: "Spam", trash: "Trash" };

/** One Gmail-style row: single line on desktop, stacked with an avatar on phones. */
export function EmailRow({ email, view, now, onOpen }: Props) {
  const outgoing = view === "sent" || view === "drafts";
  const who = outgoing ? `To: ${shortNames(email.to) || "(no recipients)"}` : email.from.name;
  // Like Gmail, show label chips except the one for the mailbox you're already in.
  const chips = email.labels.filter((label) => label !== VIEW_LABEL[view]);
  const weight = email.unread ? "font-bold text-[#1f1f1f] dark:text-zinc-50" : "text-[#1f1f1f] dark:text-zinc-200";

  return (
    <li
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      tabIndex={0}
      role="link"
      className={`group relative cursor-pointer border-b border-[#f1f3f4] outline-none focus-visible:bg-[#c2dbff] dark:border-zinc-800 ${
        email.unread ? "bg-white dark:bg-zinc-900" : "bg-[#f2f6fc] dark:bg-zinc-950/60"
      } hover:z-10 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]`}
    >
      {/* Desktop: Gmail's single-line row */}
      <div className="hidden h-10 items-center gap-3 pl-4 pr-4 text-sm md:flex">
        <Star className={`h-5 w-5 shrink-0 ${email.starred ? "fill-[#f4b400] text-[#f4b400]" : "text-[#c4c7c5] dark:text-zinc-600"}`} aria-label={email.starred ? "Starred" : undefined} />
        <Bookmark className={`h-[18px] w-[18px] shrink-0 -rotate-90 ${email.important ? "fill-[#f4b400] text-[#f4b400]" : "text-[#c4c7c5] dark:text-zinc-600"}`} aria-label={email.important ? "Important" : undefined} />
        <span className={`w-48 shrink-0 truncate lg:w-52 ${weight}`}>
          {view === "drafts" ? <span className="text-[#d93025]">Draft</span> : who}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {chips.map((label) => (
            <span key={label} className="shrink-0 rounded bg-[#dde3ea] px-1.5 text-xs leading-5 text-[#444746] dark:bg-zinc-700 dark:text-zinc-200">{label}</span>
          ))}
          <span className="truncate">
            <span className={weight}>{email.subject}</span>
            {email.snippet && <span className="text-[#5f6368] dark:text-zinc-400"> - {email.snippet}</span>}
          </span>
        </span>
        <time className={`w-16 shrink-0 text-right text-xs ${email.unread ? "font-bold text-[#1f1f1f] dark:text-zinc-50" : "text-[#5f6368] dark:text-zinc-400"}`}>
          {formatListDate(email.date, now)}
        </time>
      </div>

      {/* Mobile: avatar + stacked lines, like the Gmail app */}
      <div className="flex gap-3 px-4 py-3 md:hidden">
        <Avatar name={outgoing ? shortNames(email.to) || "?" : email.from.name} email={outgoing ? email.to : email.from.email} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[15px] ${weight}`}>{view === "drafts" ? <span className="text-[#d93025]">Draft</span> : who}</span>
            <time className={`shrink-0 text-xs ${email.unread ? "font-bold" : "text-[#5f6368] dark:text-zinc-400"}`}>{formatListDate(email.date, now)}</time>
          </div>
          <p className={`truncate text-sm ${weight}`}>{email.subject}</p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm text-[#5f6368] dark:text-zinc-400">{email.snippet}</p>
            {email.important && <Bookmark className="h-4 w-4 shrink-0 -rotate-90 fill-[#f4b400] text-[#f4b400]" />}
            {email.starred && <Star className="h-4 w-4 shrink-0 fill-[#f4b400] text-[#f4b400]" />}
          </div>
        </div>
      </div>
    </li>
  );
}
