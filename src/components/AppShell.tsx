"use client";

import { CalendarDays, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { SessionUser } from "@/lib/session";
import type { LabelCounts } from "@/lib/types";
import { AccountMenu } from "./shell/AccountMenu";
import { SearchBar, SearchBarFallback } from "./shell/SearchBar";
import { Sidebar } from "./shell/Sidebar";
import { Skeleton } from "./ui/Skeleton";
import { MailboxContext, UserContext } from "./UserContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [canDraft, setCanDraft] = useState(false);
  const [counts, setCounts] = useState<LabelCounts | null>(null);
  const [countsTick, setCountsTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((me: { user: SessionUser | null; canDraft?: boolean }) => {
        if (!me.user) return router.replace("/");
        setUser(me.user);
        setCanDraft(Boolean(me.canDraft));
      })
      .catch(() => router.replace("/"));
  }, [router]);

  // Refresh counts on navigation and whenever a view asks (e.g. after Refresh).
  useEffect(() => {
    if (!user) return;
    fetchJson<LabelCounts>("/api/labels").then(setCounts).catch(() => {});
  }, [user, pathname, countsTick]);

  const refreshCounts = useCallback(() => setCountsTick((t) => t + 1), []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  function toggleMenu() {
    // Gmail behaviour: the menu button collapses the sidebar on desktop, opens a drawer on mobile.
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((c) => !c);
    else setDrawerOpen(true);
  }

  if (!user) {
    return (
      <div className="flex h-dvh flex-col bg-[#f6f8fc] dark:bg-zinc-950">
        <div className="flex h-16 items-center gap-4 px-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-12 max-w-[720px] flex-1 rounded-full" /></div>
        <div className="flex flex-1 gap-4 pb-4 pr-4">
          <div className="hidden w-64 space-y-2 pl-4 lg:block">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          <div className="flex-1 rounded-2xl bg-white dark:bg-zinc-900" />
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={user}>
      <MailboxContext.Provider value={{ counts, refreshCounts, canDraft }}>
        <div className="flex h-dvh flex-col bg-[#f6f8fc] text-[#1f1f1f] dark:bg-zinc-950 dark:text-zinc-100">
          <header className="flex h-16 shrink-0 items-center gap-2 pl-2 pr-2 sm:pr-4">
            <button type="button" onClick={toggleMenu} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#444746] hover:bg-black/[0.06] dark:text-zinc-300 dark:hover:bg-white/10" aria-label="Main menu">
              <Menu className="h-6 w-6" />
            </button>
            <Link href="/inbox" className="hidden shrink-0 items-center gap-2 pr-4 sm:flex lg:w-[184px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b57d0] text-white"><CalendarDays className="h-[18px] w-[18px]" /></span>
              <span className="text-[22px] leading-none text-[#444746] dark:text-zinc-200">InboxAgenda</span>
            </Link>
            <div className="flex min-w-0 flex-1">
              <Suspense fallback={<SearchBarFallback />}>
                <SearchBar />
              </Suspense>
            </div>
            <div className="ml-auto pl-2">
              <AccountMenu user={user} onSignOut={signOut} />
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <aside className="hidden shrink-0 lg:block">
              <Sidebar collapsed={collapsed} counts={counts} />
            </aside>

            {drawerOpen && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                <aside className="absolute inset-y-0 left-0 bg-[#f6f8fc] pt-3 shadow-xl dark:bg-zinc-900">
                  <Sidebar collapsed={false} counts={counts} onNavigate={() => setDrawerOpen(false)} />
                </aside>
              </div>
            )}

            <main className="min-w-0 flex-1 lg:pb-4 lg:pr-4">
              <div className="h-full overflow-hidden bg-white lg:rounded-2xl dark:bg-zinc-900">{children}</div>
            </main>
          </div>
        </div>
      </MailboxContext.Provider>
    </UserContext.Provider>
  );
}
