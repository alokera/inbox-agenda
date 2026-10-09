"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Landing } from "@/components/Landing";

interface Me {
  user: { email: string } | null;
  configured: { google: boolean; ai: boolean };
}

export default function Home() {
  const router = useRouter();
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
        if (data.user) return router.replace("/inbox");
        setError(callbackError);
        setMe(data);
      });
  }, [router]);

  if (!me) return <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950" />;
  return <Landing configured={me.configured} error={error} />;
}
