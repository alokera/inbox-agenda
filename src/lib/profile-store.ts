import { createStore, del, get, set } from "idb-keyval";
import type { JobProfile, ResumeSummary } from "./types";

/**
 * The job profile and resume PDFs live only in this browser (IndexedDB).
 * They're sent to the server just-in-time: profile + resume text to draft with AI,
 * and the chosen PDF when creating the Gmail draft. Nothing is stored server-side.
 */
const store = typeof indexedDB === "undefined" ? undefined : createStore("inbox-agenda", "job-profile");

export interface StoredResume {
  id: string;
  label: string;
  filename: string;
  size: number;
  /** Extracted text, used by the AI to pick the best resume for a job. */
  text: string;
  isDefault: boolean;
  addedAt: number;
  file: Blob;
}

const PROFILE_KEY = "profile";
const RESUMES_KEY = "resumes";

export function emptyProfile(name = "", email = ""): JobProfile {
  return {
    fullName: name,
    email,
    phone: "",
    location: "",
    headline: "",
    portfolioUrl: "",
    githubUrl: "",
    linkedinUrl: "",
    otherUrl: "",
    summary: "",
    signature: "",
    tone: "professional",
  };
}

export async function loadProfile(): Promise<JobProfile | null> {
  return (await get<JobProfile>(PROFILE_KEY, store)) ?? null;
}

export async function saveProfile(profile: JobProfile): Promise<void> {
  await set(PROFILE_KEY, profile, store);
}

export async function loadResumes(): Promise<StoredResume[]> {
  return (await get<StoredResume[]>(RESUMES_KEY, store)) ?? [];
}

export async function saveResumes(resumes: StoredResume[]): Promise<void> {
  // Exactly one default whenever there are resumes.
  const normalized = resumes.length && !resumes.some((r) => r.isDefault) ? resumes.map((r, i) => ({ ...r, isDefault: i === 0 })) : resumes;
  await set(RESUMES_KEY, normalized, store);
}

export async function clearJobData(): Promise<void> {
  await Promise.all([del(PROFILE_KEY, store), del(RESUMES_KEY, store), del("sent-applications", store)]);
}

/** What the AI gets to see of each resume. */
export function toResumeSummaries(resumes: StoredResume[]): ResumeSummary[] {
  return resumes.map((r) => ({ id: r.id, label: r.label, excerpt: r.text.slice(0, 2000) }));
}

/** A ready-made signature from the profile fields. */
export function defaultSignature(p: JobProfile): string {
  return [
    "Best regards,",
    p.fullName,
    p.headline,
    [p.phone, p.email].filter(Boolean).join(" · "),
    [p.portfolioUrl, p.linkedinUrl].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join("\n");
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** An application the user sent from InboxAgenda (kept locally to warn about duplicates). */
export interface SentApplication {
  id: string;
  to: string;
  subject: string;
  company: string | null;
  role: string | null;
  resumeLabel: string | null;
  sentAt: number;
  /** Gmail ids, to open the sent message. */
  messageId: string;
  threadId: string;
}

const SENT_KEY = "sent-applications";
const MAX_SENT_HISTORY = 500;

export async function loadSentApplications(): Promise<SentApplication[]> {
  return (await get<SentApplication[]>(SENT_KEY, store)) ?? [];
}

export async function recordSentApplication(entry: SentApplication): Promise<void> {
  const history = await loadSentApplications();
  await set(SENT_KEY, [entry, ...history].slice(0, MAX_SENT_HISTORY), store);
}

/** Earlier applications to the same address, newest first. */
export function previousApplicationsTo(history: SentApplication[], to: string): SentApplication[] {
  const address = to.trim().toLowerCase();
  return address ? history.filter((h) => h.to.toLowerCase() === address) : [];
}
