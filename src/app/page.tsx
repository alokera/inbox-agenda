"use client";

import { useEffect, useState } from "react";
import { Agenda } from "@/components/Agenda";
import { Landing } from "@/components/Landing";
import type { SessionUser } from "@/lib/session";

interface Me {
  user: SessionUser | null;
  configured: { google: boolean; ai: boolean };
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Errors from the OAuth callback arrive as ?error=…; show once, then clean the URL.
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError) window.history.replaceState(null, "", "/");
    fetch("/api/me")
      .then((res) => res.json())
      .catch(() => ({ user: null, configured: { google: false, ai: false } }))
      .then((data: Me) => {
        setError(callbackError);
        setMe(data);
      });
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe((current) => (current ? { ...current, user: null } : current));
  }

  if (!me) return <div className="flex flex-1 items-center justify-center text-neutral-500">Loading…</div>;
  if (!me.user) return <Landing configured={me.configured} error={error} />;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg text-white">📅</span>
        <h1 className="text-xl font-semibold">InboxAgenda</h1>
        <div className="ml-auto flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny external avatar, no optimization needed */}
          {me.user.picture && <img src={me.user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />}
          <span className="hidden text-sm text-neutral-600 sm:inline dark:text-neutral-400">{me.user.email}</span>
          <button type="button" onClick={signOut} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
            Sign out
          </button>
        </div>
      </header>
      <Agenda userEmail={me.user.email} onSignedOut={() => setMe({ ...me, user: null })} />
    </div>
  );
}
