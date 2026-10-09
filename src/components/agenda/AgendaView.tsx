"use client";

import { CalendarCheck2, CalendarDays, CalendarSearch, LoaderCircle, Mail, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { groupAgenda } from "@/lib/agenda-groups";
import { redirectToSignIn } from "@/lib/client-api";
import type { AgendaItem, ScanEvent, ScanStats } from "@/lib/types";
import { EmptyState } from "../ui/EmptyState";
import { AgendaCard } from "./AgendaCard";

type Filter = "all" | "missing";

export function AgendaView() {
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
        if (data.signInAgain) redirectToSignIn();
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
            if (event.signInAgain) redirectToSignIn();
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="text-sm text-zinc-500">Your calendar plus every appointment AI finds in your email.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={scanning}
              aria-label="How far back to scan email"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button
              type="button"
              onClick={scan}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0b57d0] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#0b57d0]/20 hover:bg-[#0a4fbd] disabled:opacity-60"
            >
              {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {scanning ? "Scanning…" : items ? "Scan again" : "Scan my inbox"}
            </button>
          </div>
        </header>

        {scanning && (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">{status}</span>
              {progress && <span className="tabular-nums text-zinc-500">{progress.done}/{progress.total}</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full bg-[#0b57d0] transition-all duration-300 ${progress ? "" : "w-1/3 animate-pulse"}`}
                style={progress ? { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` } : undefined}
              />
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={CalendarDays} label="Upcoming" value={items?.length ?? 0} />
            <Stat icon={CalendarCheck2} label="From calendar" value={stats.calendarEvents} />
            <Stat icon={Mail} label="Emails analysed" value={stats.emailsAnalyzed} />
            <Stat icon={TriangleAlert} label="Not in calendar" value={stats.missingFromCalendar} highlight={stats.missingFromCalendar > 0} />
          </div>
        )}

        {items && (
          <div className="inline-flex rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
            {(["all", "missing"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${filter === f ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
              >
                {f === "all" ? "Everything" : `Not in calendar${stats ? ` (${stats.missingFromCalendar})` : ""}`}
              </button>
            ))}
          </div>
        )}

        {items && groups.length === 0 && (
          <EmptyState
            icon={CalendarCheck2}
            title={filter === "missing" ? "Nothing missing" : "No upcoming appointments"}
            description={filter === "missing" ? "Every appointment in your inbox is already on your calendar." : "Nothing scheduled in your calendar or recent email."}
          />
        )}

        {groups.map((group) => (
          <section key={group.name} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{group.name}</h2>
            <ul className="space-y-2.5">
              {group.items.map((item) => <AgendaCard key={item.id} item={item} />)}
            </ul>
          </section>
        ))}

        {!items && !scanning && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900/50">
            <EmptyState icon={CalendarSearch} title="Build your agenda" description="Scan your recent email. AI finds meetings, interviews, bookings and appointments, and compares them with your calendar.">
              <button type="button" onClick={scan} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#0b57d0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4fbd]">
                <Sparkles className="h-4 w-4" />Scan my inbox
              </button>
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: LucideIcon; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${highlight ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
      <div className={`flex items-center gap-1.5 text-xs ${highlight ? "text-amber-800 dark:text-amber-300" : "text-zinc-500"}`}><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
