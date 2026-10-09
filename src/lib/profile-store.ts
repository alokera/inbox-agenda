import { createStore, del, get, set } from "idb-keyval";
import { DEFAULT_TEMPLATES, type EmailTemplate } from "./templates";
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
    pitch: "",
    signature: "",
    tone: "professional",
  };
}

export async function loadProfile(): Promise<JobProfile | null> {
  const stored = await get<Partial<JobProfile>>(PROFILE_KEY, store);
  // Fill in fields added after the profile was first saved.
  return stored ? { ...emptyProfile(), ...stored } : null;
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
  await Promise.all([del(PROFILE_KEY, store), del(RESUMES_KEY, store), del("sent-applications", store), del("templates", store)]);
}

/** What the AI gets to see of each resume. */
export function toResumeSummaries(resumes: StoredResume[]): ResumeSummary[] {
  return resumes.map((r) => ({ id: r.id, label: r.label, excerpt: r.text.slice(0, 2000) }));
}

/** A ready-made signature from the profile fields (bold name, then one detail per line). */
export function defaultSignature(p: JobProfile): string {
  return [
    "Best regards,",
    p.fullName && `**${p.fullName}**`,
    p.headline,
    p.phone,
    p.email,
    p.portfolioUrl && `Portfolio: ${p.portfolioUrl}`,
    p.linkedinUrl && `LinkedIn: ${p.linkedinUrl}`,
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

const TEMPLATES_KEY = "templates";

/** The user's email templates; the built-in ones until they edit or add any. */
export async function loadTemplates(): Promise<EmailTemplate[]> {
  return (await get<EmailTemplate[]>(TEMPLATES_KEY, store)) ?? DEFAULT_TEMPLATES;
}

export async function saveTemplates(templates: EmailTemplate[]): Promise<void> {
  await set(TEMPLATES_KEY, templates, store);
}
