import { createStore, get, set } from "idb-keyval";
import { DEFAULT_AUTOPILOT, normalizeSettings, type AutopilotSettings } from "./autopilot";

const store = typeof indexedDB === "undefined" ? undefined : createStore("inbox-agenda-autopilot", "state");

/** An application (or follow-up) prepared by Autopilot, waiting for one-click review. */
export interface QueueItem {
  id: string;
  kind: "application" | "follow-up";
  createdAt: number;
  /** Gmail message to reply to (job email, or your earlier application for follow-ups). */
  replyToEmailId: string;
  to: string;
  subject: string;
  body: string;
  resumeId: string;
  score: number | null;
  role: string | null;
  company: string | null;
  reason: string;
  /** Sent-history id of the application being followed up. */
  followUpOf?: string;
}

export interface LogEntry {
  id: string;
  at: number;
  action: "sent" | "queued" | "skipped" | "error" | "replied" | "follow-up";
  title: string;
  detail: string;
  emailId?: string;
}

export interface AutopilotRun {
  at: number;
  checked: number;
  sent: number;
  queued: number;
  skipped: number;
}

const MAX_LOG = 300;

export async function loadSettings(): Promise<AutopilotSettings> {
  return normalizeSettings((await get<Partial<AutopilotSettings>>("settings", store)) ?? DEFAULT_AUTOPILOT);
}

export async function saveSettings(settings: AutopilotSettings): Promise<void> {
  await set("settings", normalizeSettings(settings), store);
}

export async function loadQueue(): Promise<QueueItem[]> {
  return (await get<QueueItem[]>("queue", store)) ?? [];
}

export async function saveQueue(queue: QueueItem[]): Promise<void> {
  await set("queue", queue, store);
}

export async function loadLog(): Promise<LogEntry[]> {
  return (await get<LogEntry[]>("log", store)) ?? [];
}

export async function appendLog(entries: Omit<LogEntry, "id">[]): Promise<void> {
  if (!entries.length) return;
  const log = await loadLog();
  await set("log", [...entries.map((e) => ({ ...e, id: crypto.randomUUID() })).reverse(), ...log].slice(0, MAX_LOG), store);
}

export async function loadProcessedEmails(): Promise<string[]> {
  return (await get<string[]>("processed", store)) ?? [];
}

export async function addProcessedEmails(ids: string[]): Promise<void> {
  const existing = await loadProcessedEmails();
  await set("processed", [...new Set([...ids, ...existing])].slice(0, 5000), store);
}

export async function loadLastRun(): Promise<AutopilotRun | null> {
  return (await get<AutopilotRun>("last-run", store)) ?? null;
}

export async function saveLastRun(run: AutopilotRun): Promise<void> {
  await set("last-run", run, store);
}
