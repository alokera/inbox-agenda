import { Bookmark, Star } from "lucide-react";
import { formatListDate } from "@/lib/ui-format";
import type { EmailSummary } from "@/lib/types";
import { Avatar } from "../ui/Avatar";

interface Props {
  email: EmailSummary;
  selected: boolean;
  now: Date;
  onSelect: () => void;
}

export function EmailListItem({ email, selected, now, onSelect }: Props) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
          selected
            ? "border-indigo-600 bg-indigo-50/70 dark:border-indigo-400 dark:bg-indigo-950/30"
            : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-zinc-900"
        }`}
      >
        <Avatar name={email.from.name} email={email.from.email} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {email.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-label="Unread" />}
            <span className={`min-w-0 flex-1 truncate text-sm ${email.unread ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}>
              {email.from.name}
            </span>
            {email.important && <Bookmark className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Important" />}
            {email.starred && <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" aria-label="Starred" />}
            <time className={`shrink-0 text-xs tabular-nums ${email.unread ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
              {formatListDate(email.date, now)}
            </time>
          </div>
          <p className={`truncate text-sm ${email.unread ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>{email.subject}</p>
          <p className="truncate text-sm text-zinc-500">{email.snippet}</p>
        </div>
      </button>
    </li>
  );
}
