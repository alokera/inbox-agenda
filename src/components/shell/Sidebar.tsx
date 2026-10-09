"use client";

import { Bookmark, Briefcase, CalendarDays, File, Inbox, Mails, OctagonAlert, Send, Sparkles, Star, Trash, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LabelCounts, MailView } from "@/lib/types";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  view?: MailView;
  /** Which number to show next to the item, like Gmail does. */
  badge?: "unread" | "total";
}

const MAIL_ITEMS: Item[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox, view: "inbox", badge: "unread" },
  { href: "/starred", label: "Starred", icon: Star },
  { href: "/important", label: "Important", icon: Bookmark },
  { href: "/sent", label: "Sent", icon: Send },
  { href: "/drafts", label: "Drafts", icon: File, view: "drafts", badge: "total" },
  { href: "/all", label: "All Mail", icon: Mails },
  { href: "/spam", label: "Spam", icon: OctagonAlert, view: "spam", badge: "unread" },
  { href: "/trash", label: "Trash", icon: Trash },
];

interface Props {
  collapsed: boolean;
  counts: LabelCounts | null;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, counts, onNavigate }: Props) {
  const pathname = usePathname();

  const renderItem = ({ href, label, icon: Icon, view, badge }: Item) => {
    const active = pathname === href;
    const count = view && badge ? (counts?.[view]?.[badge] ?? 0) : 0;
    const bold = active || (badge === "unread" && count > 0);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        className={`flex h-8 items-center text-sm transition-colors ${
          collapsed ? "mx-auto w-14 justify-center rounded-full" : "mr-4 gap-[18px] rounded-r-full pl-[26px] pr-3"
        } ${
          active
            ? "bg-[#d3e3fd] text-[#001d35] dark:bg-blue-900/60 dark:text-blue-50"
            : "text-[#202124] hover:bg-black/[0.06] dark:text-zinc-300 dark:hover:bg-white/10"
        } ${bold ? "font-bold" : ""}`}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {count > 0 && <span className="text-xs tabular-nums">{count.toLocaleString()}</span>}
          </>
        )}
      </Link>
    );
  };

  return (
    <nav className={`flex h-full flex-col overflow-y-auto pb-4 transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-64"}`}>
      {/* Gmail puts "Compose" here. InboxAgenda is read-only, so its main action is finding appointments. */}
      <div className={`pb-4 pt-2 ${collapsed ? "px-2" : "pl-2"}`}>
        <Link
          href="/agenda"
          onClick={onNavigate}
          title={collapsed ? "Find appointments" : undefined}
          className={`flex h-14 items-center rounded-2xl bg-[#c2e7ff] text-sm font-medium text-[#001d35] transition-shadow hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] dark:bg-blue-900 dark:text-blue-50 ${
            collapsed ? "w-14 justify-center" : "w-fit gap-3 pl-4 pr-6"
          }`}
        >
          <Sparkles className="h-5 w-5" />
          {!collapsed && "Find appointments"}
        </Link>
      </div>

      <div className="space-y-px">{MAIL_ITEMS.map(renderItem)}</div>

      {collapsed ? <div className="mx-auto my-3 h-px w-8 bg-black/10 dark:bg-white/10" /> : <p className="mb-1 ml-[26px] mt-5 text-sm font-medium text-[#202124] dark:text-zinc-300">InboxAgenda</p>}
      <div className="space-y-px">
        {renderItem({ href: "/agenda", label: "Agenda", icon: CalendarDays })}
        {renderItem({ href: "/jobs", label: "Job emails", icon: Briefcase })}
        {renderItem({ href: "/profile", label: "Job profile", icon: UserRound })}
      </div>
    </nav>
  );
}
