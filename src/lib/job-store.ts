import { createStore, get, set } from "idb-keyval";
import type { JobPreferences, JobProfile, ScoredJob } from "./types";

/** Job feed, tracker and preferences live in this browser (IndexedDB), like the job profile. */
const store = typeof indexedDB === "undefined" ? undefined : createStore("inbox-agenda-jobs", "feed");

export type JobStatus = "new" | "saved" | "applied" | "interviewing" | "offer" | "rejected" | "hidden";

export const TRACKER_COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "interviewing", label: "Interviewing" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

export interface FeedJob extends ScoredJob {
  status: JobStatus;
  foundAt: number;
  statusChangedAt: number;
  /** Gmail thread of the application, once sent from InboxAgenda. */
  threadId?: string;
  repliedAt?: number;
}

const FEED_KEY = "jobs";
const PROCESSED_KEY = "processed-alert-emails";
const PREFS_KEY = "preferences";
const MAX_FEED = 1000;
const MAX_PROCESSED = 2000;

export function emptyPreferences(profile?: JobProfile | null): JobPreferences {
  return { roles: profile?.headline ?? "", locations: "", remoteOk: true, experienceYears: "", minSalary: "", skipKeywords: "", skipCompanies: "" };
}

export async function loadPreferences(): Promise<JobPreferences | null> {
  return (await get<JobPreferences>(PREFS_KEY, store)) ?? null;
}

export async function savePreferences(prefs: JobPreferences): Promise<void> {
  await set(PREFS_KEY, prefs, store);
}

export async function loadFeed(): Promise<FeedJob[]> {
  return (await get<FeedJob[]>(FEED_KEY, store)) ?? [];
}

export async function saveFeed(jobs: FeedJob[]): Promise<void> {
  await set(FEED_KEY, trimFeed(jobs), store);
}

export async function loadProcessedAlerts(): Promise<string[]> {
  return (await get<string[]>(PROCESSED_KEY, store)) ?? [];
}

export async function addProcessedAlerts(ids: string[]): Promise<void> {
  const existing = await loadProcessedAlerts();
  await set(PROCESSED_KEY, [...new Set([...ids, ...existing])].slice(0, MAX_PROCESSED), store);
}

/**
 * Adds newly found jobs to the feed. Jobs already there keep their status (saved, applied…)
 * and only gain details they were missing, such as a score or a link.
 */
export function mergeFoundJobs(existing: FeedJob[], incoming: ScoredJob[], now = Date.now()): FeedJob[] {
  const byKey = new Map(existing.map((job) => [job.key, job]));
  for (const job of incoming) {
    const current = byKey.get(job.key);
    if (current) {
      byKey.set(job.key, {
        ...current,
        url: current.url ?? job.url,
        salary: current.salary ?? job.salary,
        score: current.score ?? job.score,
        reasons: current.reasons ?? job.reasons,
        concerns: current.concerns ?? job.concerns,
      });
    } else {
      byKey.set(job.key, { ...job, status: "new", foundAt: now, statusChangedAt: now });
    }
  }
  return [...byKey.values()];
}

/** Keeps the feed bounded by dropping the oldest untouched jobs first; tracked jobs are always kept. */
export function trimFeed(jobs: FeedJob[]): FeedJob[] {
  if (jobs.length <= MAX_FEED) return jobs;
  const tracked = jobs.filter((j) => j.status !== "new" && j.status !== "hidden");
  const rest = jobs.filter((j) => j.status === "new" || j.status === "hidden").sort((a, b) => b.foundAt - a.foundAt);
  return [...tracked, ...rest.slice(0, Math.max(0, MAX_FEED - tracked.length))];
}

export async function setJobStatus(key: string, status: JobStatus): Promise<FeedJob[]> {
  const jobs = await loadFeed();
  const next = jobs.map((job) => (job.key === key ? { ...job, status, statusChangedAt: Date.now() } : job));
  await saveFeed(next);
  return next;
}

/** Records an application sent from InboxAgenda in the tracker (linking it to a feed job when there is one). */
export async function trackSentApplication(entry: { jobKey?: string; title: string; company: string | null; to: string; messageId: string; threadId?: string }): Promise<void> {
  const jobs = await loadFeed();
  const now = Date.now();
  if (entry.jobKey && jobs.some((j) => j.key === entry.jobKey)) {
    await saveFeed(jobs.map((j) => (j.key === entry.jobKey ? { ...j, status: "applied", statusChangedAt: now, threadId: entry.threadId } : j)));
    return;
  }
  const job: FeedJob = {
    key: `sent:${entry.messageId || now}`,
    title: entry.title,
    company: entry.company,
    location: null,
    salary: null,
    experience: null,
    url: null,
    source: "email",
    snippet: `Emailed ${entry.to}`,
    posted: null,
    alertEmailId: "",
    status: "applied",
    foundAt: now,
    statusChangedAt: now,
    threadId: entry.threadId,
  };
  await saveFeed([job, ...jobs]);
}

/** Marks tracker jobs whose application thread got a reply. */
export async function markReplied(replies: { threadId: string; at: number }[]): Promise<void> {
  if (!replies.length) return;
  const at = new Map(replies.map((r) => [r.threadId, r.at]));
  const jobs = await loadFeed();
  await saveFeed(jobs.map((j) => (j.threadId && at.has(j.threadId) && !j.repliedAt ? { ...j, repliedAt: at.get(j.threadId) } : j)));
}
