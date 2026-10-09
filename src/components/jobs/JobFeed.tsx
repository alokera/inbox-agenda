"use client";

import { LoaderCircle, Radar, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { redirectToSignIn } from "@/lib/client-api";
import { addProcessedAlerts, emptyPreferences, loadFeed, loadPreferences, loadProcessedAlerts, mergeFoundJobs, saveFeed, setJobStatus, type FeedJob, type JobStatus } from "@/lib/job-store";
import { loadProfile } from "@/lib/profile-store";
import type { JobScanEvent, JobSource } from "@/lib/types";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { JobCard } from "./JobCard";

type View = "matches" | "all" | "saved" | "hidden";

const ALERT_SETUP = [
  { name: "LinkedIn", href: "https://www.linkedin.com/jobs/", how: "Search your role and location, then turn on “Set alert”." },
  { name: "Naukri", href: "https://www.naukri.com/", how: "Search, then “Create job alert” (or Recommended jobs emails in settings)." },
  { name: "Indeed", href: "https://in.indeed.com/", how: "Search, then “Get new jobs for this search by email”." },
];

/**
 * Phase 1 of job automation: jobs from LinkedIn, Indeed and Naukri alert emails,
 * extracted and scored by AI against the job profile and preferences.
 */
export function JobFeed() {
  const [jobs, setJobs] = useState<FeedJob[] | null>(null);
  const [days, setDays] = useState(7);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("matches");
  const [minScore, setMinScore] = useState(60);
  const [source, setSource] = useState<JobSource | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFeed().then(setJobs);
  }, []);

  async function scan() {
    setScanning(true);
    setError(null);
    setSummary(null);
    setStatus("Starting…");
    try {
      const [profile, prefs, processed, current] = await Promise.all([loadProfile(), loadPreferences(), loadProcessedAlerts(), loadFeed()]);
      if (!profile?.fullName) throw new Error("Set up your Job profile first (name, headline, experience) so jobs can be matched.");
      const res = await fetch("/api/jobs/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, profile, preferences: prefs ?? emptyPreferences(profile), processedEmailIds: processed, knownJobKeys: current.map((j) => j.key) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.signInAgain) return redirectToSignIn();
        throw new Error(data.error ?? "Scan failed");
      }

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
          const event = JSON.parse(line) as JobScanEvent;
          if (event.type === "status") {
            setStatus(event.message);
            setProgress(null);
          } else if (event.type === "progress") {
            setProgress({ done: event.done, total: event.total });
          } else if (event.type === "result") {
            const merged = mergeFoundJobs(await loadFeed(), event.jobs);
            await saveFeed(merged);
            await addProcessedAlerts(event.processedEmailIds);
            setJobs(merged);
            const { alertEmails, jobsFound, skipped } = event.stats;
            setSummary(alertEmails ? `Read ${alertEmails} alert emails: ${event.jobs.length} new jobs added${skipped ? `, ${skipped} skipped by your filters` : ""}${jobsFound - skipped - event.jobs.length > 0 ? `, ${jobsFound - skipped - event.jobs.length} already in your feed` : ""}.` : "No new job-alert emails since your last scan.");
          } else if (event.type === "error") {
            if (event.signInAgain) return redirectToSignIn();
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

  async function changeStatus(key: string, next: JobStatus) {
    setJobs(await setJobStatus(key, next));
  }

  const counts = useMemo(() => {
    const list = jobs ?? [];
    return {
      matches: list.filter((j) => j.status === "new" && (j.score ?? 0) >= minScore).length,
      all: list.filter((j) => j.status === "new").length,
      saved: list.filter((j) => j.status === "saved").length,
      hidden: list.filter((j) => j.status === "hidden").length,
    };
  }, [jobs, minScore]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (jobs ?? [])
      .filter((j) => (view === "matches" ? j.status === "new" && (j.score ?? 0) >= minScore : view === "all" ? j.status === "new" : j.status === view))
      .filter((j) => source === "all" || j.source === source)
      .filter((j) => !q || `${j.title} ${j.company ?? ""} ${j.location ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.foundAt - a.foundAt);
  }, [jobs, view, minScore, source, search]);

  const sources = useMemo(() => [...new Set((jobs ?? []).map((j) => j.source))], [jobs]);
  const select = "rounded-lg border border-[#c4c7c5] bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-8">
        <header className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="text-[22px] text-[#1f1f1f] dark:text-zinc-50">Job feed</h1>
            <p className="text-sm text-[#5f6368] dark:text-zinc-400">Jobs from your LinkedIn, Indeed and Naukri alert emails, scored by AI against your profile.</p>
          </div>
          <Link href="/profile" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#0b57d0] hover:bg-[#0b57d0]/[0.06] dark:text-blue-300">
            <Settings2 className="h-4 w-4" />Preferences
          </Link>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={scanning} className={select} aria-label="Scan period">
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button type="button" onClick={scan} disabled={scanning} className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd] disabled:opacity-60">
            {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {scanning ? "Scanning…" : "Scan job alerts"}
          </button>
        </header>

        {scanning && (
          <div className="space-y-2 rounded-2xl bg-[#f2f6fc] p-4 dark:bg-zinc-800/60">
            <div className="flex justify-between text-sm"><span>{status}</span>{progress && <span className="tabular-nums text-[#5f6368]">{progress.done}/{progress.total}</span>}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-zinc-900">
              <div className={`h-full rounded-full bg-[#0b57d0] transition-all ${progress ? "" : "w-1/3 animate-pulse"}`} style={progress ? { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` } : undefined} />
            </div>
          </div>
        )}
        {summary && <p className="rounded-xl bg-[#e6f4ea] px-4 py-2.5 text-sm text-[#137333] dark:bg-emerald-950/40 dark:text-emerald-300">{summary}</p>}
        {error && <p className="rounded-xl bg-[#fce8e6] px-4 py-2.5 text-sm text-[#c5221f] dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        {jobs === null && <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>}

        {jobs !== null && jobs.length === 0 && !scanning && (
          <div className="space-y-4 rounded-2xl border border-dashed border-[#c4c7c5] p-6 dark:border-zinc-700">
            <EmptyState icon={Radar} title="Your feed is empty" description="Set up job alerts on these sites (once), so new jobs arrive in your Gmail. Then click “Scan job alerts”." />
            <ul className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3">
              {ALERT_SETUP.map((site) => (
                <li key={site.name} className="rounded-xl bg-[#f2f6fc] p-3 text-xs text-[#444746] dark:bg-zinc-800/60 dark:text-zinc-300">
                  <a href={site.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0b57d0] hover:underline dark:text-blue-300">{site.name} ↗</a>
                  <p className="mt-1">{site.how}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {jobs !== null && jobs.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-[#e9eef6] p-1 text-sm dark:bg-zinc-800">
                {([["matches", `Top matches (${counts.matches})`], ["all", `All new (${counts.all})`], ["saved", `Saved (${counts.saved})`], ["hidden", `Hidden (${counts.hidden})`]] as [View, string][]).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setView(id)} className={`rounded-full px-3 py-1.5 font-medium transition ${view === id ? "bg-white text-[#0b57d0] shadow-sm dark:bg-zinc-900 dark:text-blue-300" : "text-[#444746] hover:text-[#1f1f1f] dark:text-zinc-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="flex-1" />
              {view === "matches" && (
                <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className={select} aria-label="Minimum match">
                  <option value={85}>85%+ match</option>
                  <option value={70}>70%+ match</option>
                  <option value={60}>60%+ match</option>
                </select>
              )}
              {sources.length > 1 && (
                <select value={source} onChange={(e) => setSource(e.target.value as JobSource | "all")} className={select} aria-label="Source">
                  <option value="all">All sources</option>
                  {sources.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              )}
              <label className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6368]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter" className="w-36 rounded-lg border border-[#c4c7c5] bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-[#0b57d0] dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
            </div>

            {visible.length === 0 ? (
              <EmptyState icon={Radar} title={view === "matches" ? "No new jobs above this match" : "Nothing here"} description={view === "matches" ? "Lower the match filter, check “All new”, or scan again later." : undefined} />
            ) : (
              <ul className="space-y-3">
                {visible.map((job) => <JobCard key={job.key} job={job} onStatus={(next) => changeStatus(job.key, next)} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
