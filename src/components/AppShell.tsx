"use client";

import { CalendarDays, Inbox, LogOut, Mail, Menu, Star, Bookmark, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { SessionUser } from "@/lib/session";
import type { LabelCounts, MailView } from "@/lib/types";
import { Skeleton } from "./ui/Skeleton";
import { UserContext } from "./UserContext";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: MailView;
}

const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Plan", items: [{ href: "/agenda", label: "Agenda", icon: CalendarDays }] },
  {
    section: "Mail",
    items: [
      { href: "/important", label: "Important", icon: Bookmark, count: "important" },
      { href: "/inbox", label: "Inbox", icon: Inbox, count: "inbox" },
      { href: "/unread", label: "Unread", icon: Mail, count: "unread" },
      { href: "/starred", label: "Starred", icon: Star },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [counts, setCounts] = useState<LabelCounts | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((me: { user: SessionUser | null }) => (me.user ? setUser(me.user) : router.replace("/")))
      .catch(() => router.replace("/"));
  }, [router]);

  // Refresh unread counts whenever the user moves between views.
  useEffect(() => {
    if (!user) return;
    fetchJson<LabelCounts>("/api/labels").then(setCounts).catch(() => {});
  }, [user, pathname]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (!user) {
    return (
      <div className="flex h-dvh">
        <div className="hidden w-64 border-r border-zinc-200 p-4 lg:block dark:border-zinc-800">
          <Skeleton className="mb-8 h-8 w-36" />
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="mb-2 h-8 w-full" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-10 w-64" /></div>
      </div>
    );
  }

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 p-3">
      <Link href="/agenda" className="flex items-center gap-2.5 px-2 pt-1" onClick={() => setMenuOpen(false)}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
          <CalendarDays className="h-4.5 w-4.5" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">InboxAgenda</span>
      </Link>

      <div className="flex-1 space-y-5">
        {NAV.map(({ section, items }) => (
          <div key={section} className="space-y-0.5">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{section}</p>
            {items.map(({ href, label, icon: Icon, count }) => {
              const active = pathname === href;
              const unread = count && counts ? counts[count].unread : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700"
                      : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                  <span className="flex-1">{label}</span>
                  {unread > 0 && <span className="rounded-full bg-zinc-200/80 px-1.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{unread > 999 ? "999+" : unread}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element -- small external Google avatar */}
        {user.picture ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" /> : <span className="h-8 w-8 rounded-full bg-zinc-200" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
        <button type="button" onClick={signOut} title="Sign out" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );

  return (
    <UserContext.Provider value={user}>
      <div className="flex h-dvh overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-100/60 lg:block dark:border-zinc-800 dark:bg-zinc-900/40">{sidebar}</aside>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-zinc-950/40" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-zinc-50 shadow-xl dark:bg-zinc-900">
              <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-500" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 lg:hidden dark:border-zinc-800">
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-md p-1.5 text-zinc-600 dark:text-zinc-300" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold">InboxAgenda</span>
          </div>
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </UserContext.Provider>
  );
}
