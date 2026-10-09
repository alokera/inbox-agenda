"use client";

import { ExternalLink, SquareKanban } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadFeed, setJobStatus, TRACKER_COLUMNS, type FeedJob, type JobStatus } from "@/lib/job-store";
import { EmptyState } from "../ui/EmptyState";
import { scoreTone } from "./JobCard";

const COLUMN_ACCENT: Record<string, string> = {
  saved: "bg-[#0b57d0]",
  applied: "bg-[#8430ce]",
  interviewing: "bg-[#e37400]",
  offer: "bg-[#188038]",
  rejected: "bg-[#9aa0a6]",
};

/** Application pipeline: Saved → Applied → Interviewing → Offer / Rejected. */
export function Tracker() {
  const [jobs, setJobs] = useState<FeedJob[] | null>(null);

  useEffect(() => {
    loadFeed().then(setJobs);
  }, []);

  async function move(key: string, status: JobStatus) {
    setJobs(await setJobStatus(key, status));
  }

  const tracked = (jobs ?? []).filter((j) => TRACKER_COLUMNS.some((c) => c.status === j.status));
  const applied = tracked.filter((j) => j.status !== "saved").length;
  const responses = tracked.filter((j) => j.status === "interviewing" || j.status === "offer" || j.repliedAt).length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-end gap-3 px-4 pb-3 pt-6 sm:px-8">
        <div className="flex-1">
          <h1 className="text-[22px] text-[#1f1f1f] dark:text-zinc-50">Tracker</h1>
          <p className="text-sm text-[#5f6368] dark:text-zinc-400">
            {applied} applied · {responses} replied or interviewing{applied ? ` · ${Math.round((responses / applied) * 100)}% response rate` : ""}
          </p>
        </div>
      </header>

      {jobs !== null && tracked.length === 0 ? (
        <EmptyState icon={SquareKanban} title="Nothing tracked yet" description="Save jobs from the Job feed, or send an application from InboxAgenda; it appears here automatically.">
          <Link href="/feed" className="mt-2 rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a4fbd]">Open Job feed</Link>
        </EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:px-8">
          {TRACKER_COLUMNS.map((column) => {
            const items = tracked.filter((j) => j.status === column.status).sort((a, b) => b.statusChangedAt - a.statusChangedAt);
            return (
              <section key={column.status} className="flex w-72 shrink-0 flex-col rounded-2xl bg-[#f2f6fc] dark:bg-zinc-800/50">
                <h2 className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">
                  <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_ACCENT[column.status]}`} />
                  {column.label}
                  <span className="ml-auto text-xs text-[#5f6368] tabular-nums dark:text-zinc-400">{items.length}</span>
                </h2>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {items.map((job) => (
                    <li key={job.key} className="space-y-2 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(60,64,67,0.15)] dark:bg-zinc-900">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-[#1f1f1f] dark:text-zinc-50">{job.title}</p>
                          <p className="truncate text-xs text-[#5f6368] dark:text-zinc-400">{[job.company, job.location].filter(Boolean).join(" · ") || job.snippet}</p>
                          {job.repliedAt && <span className="mt-1 inline-block rounded-full bg-[#f3e8fd] px-2 py-0.5 text-[11px] font-medium text-[#8430ce] dark:bg-purple-950/50 dark:text-purple-300">Replied {new Date(job.repliedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</span>}
                        </div>
                        {job.score !== undefined && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${scoreTone(job.score)}`}>{job.score}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Status of ${job.title}`}
                          value={job.status}
                          onChange={(e) => move(job.key, e.target.value as JobStatus)}
                          className="min-w-0 flex-1 rounded-md border border-[#dadce0] bg-transparent px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {TRACKER_COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                          <option value="new">Back to feed</option>
                        </select>
                        {job.url && (
                          <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full p-1.5 text-[#5f6368] hover:bg-black/[0.06] dark:hover:bg-white/10" aria-label="Open job">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-[#80868b]">{column.label} {new Date(job.statusChangedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
