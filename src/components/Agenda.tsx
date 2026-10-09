"use client";

import { useState } from "react";
import { groupAgenda } from "@/lib/agenda-groups";
import type { AgendaItem, ScanEvent, ScanStats } from "@/lib/types";
import { AgendaCard } from "./AgendaCard";

interface Props {
  userEmail: string;
  onSignedOut: () => void;
}

type Filter = "all" | "missing";

export function Agenda({ userEmail, onSignedOut }: Props) {
  const [days, setDays] = useState(30);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [items, setItems] = useState<AgendaItem[] | null>(null);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [scannedAt, setScannedAt] = useState<Date | null>(null);

  async function scan() {
    setScanning(true);
    setError(null);
    setStatus("Starting…");
    setProgress(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.signInAgain) return onSignedOut();
        throw new Error(data.error ?? "Scan failed");
      }

      // Read the newline-delimited JSON stream event by event.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as ScanEvent;
          if (event.type === "status") {
            setStatus(event.message);
            setProgress(null);
          } else if (event.type === "progress") {
            setProgress({ done: event.done, total: event.total });
          } else if (event.type === "result") {
            setItems(event.items);
            setStats(event.stats);
            setScannedAt(new Date());
          } else if (event.type === "error") {
            if (event.signInAgain) return onSignedOut();
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      setStatus(null);
      setProgress(null);
    }
  }

  const visible = items?.filter((item) => filter === "all" || item.missingFromCalendar) ?? [];
  const groups = scannedAt ? groupAgenda(visible, scannedAt) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="text-sm text-neutral-600 dark:text-neutral-400">
          Scan emails from the last{" "}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={scanning}
            className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <button
          type="button"
          onClick={scan}
          disabled={scanning}
          className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {scanning ? "Scanning…" : items ? "Scan again" : "Scan my inbox"}
        </button>

        {scanning && (
          <div className="w-full space-y-1">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{status}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full bg-indigo-600 transition-all ${progress ? "" : "w-1/3 animate-pulse"}`}
                style={progress ? { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` } : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Upcoming items" value={items?.length ?? 0} />
          <Stat label="From your calendar" value={stats.calendarEvents} />
          <Stat label="Emails analysed by AI" value={stats.emailsAnalyzed} />
          <Stat label="Missing from calendar" value={stats.missingFromCalendar} highlight={stats.missingFromCalendar > 0} />
        </div>
      )}

      {items && (
        <div className="flex gap-2 text-sm">
          {(["all", "missing"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 ${filter === f ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-900"}`}
            >
              {f === "all" ? "Everything" : "Only missing from calendar"}
            </button>
          ))}
        </div>
      )}

      {items && groups.length === 0 && (
        <p className="py-12 text-center text-neutral-500">
          {filter === "missing" ? "Nothing missing. Your calendar has everything from your inbox. 🎉" : "No upcoming appointments found."}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.name} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{group.name}</h2>
          <ul className="space-y-3">
            {group.items.map((item) => (
              <AgendaCard key={item.id} item={item} userEmail={userEmail} />
            ))}
          </ul>
        </section>
      ))}

      {!items && !scanning && (
        <p className="py-12 text-center text-neutral-500">Click “Scan my inbox” to build your agenda.</p>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-neutral-200 dark:border-neutral-800"}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
