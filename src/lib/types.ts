export type AppointmentStatus = "scheduled" | "rescheduled" | "cancelled";

/** One entry on the agenda, from either the calendar or an email. */
export interface AgendaItem {
  id: string;
  source: "calendar" | "email";
  title: string;
  /** ISO 8601. For all-day items, midnight local time of the day. */
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  meetingLink: string | null;
  organizer: string | null;
  status: AppointmentStatus;
  /** AI confidence 0–1 (email items only). */
  confidence: number | null;
  /** Gmail message the item came from (email items), or a matching email (calendar items). */
  emailId: string | null;
  emailSubject: string | null;
  calendarLink: string | null;
  /** True for email appointments that have no matching calendar event — the app's key insight. */
  missingFromCalendar: boolean;
}

/** An email worth sending to the AI. */
export interface EmailCandidate {
  id: string;
  subject: string;
  from: string;
  /** ISO 8601 send time. */
  date: string;
  text: string;
}

export interface ScanStats {
  emailsMatched: number;
  emailsAnalyzed: number;
  calendarEvents: number;
  appointmentsInEmail: number;
  missingFromCalendar: number;
}

export type ScanEvent =
  | { type: "status"; message: string }
  | { type: "progress"; done: number; total: number }
  | { type: "result"; items: AgendaItem[]; stats: ScanStats }
  | { type: "error"; message: string; signInAgain?: boolean };

export type MailView = "inbox" | "starred" | "important" | "sent" | "drafts" | "all" | "spam" | "trash";

/** Gmail's inbox tabs. */
export type MailCategory = "primary" | "promotions" | "social" | "updates";

export interface EmailAddress {
  name: string;
  email: string;
}

/** A row in the email list. */
export interface EmailSummary {
  id: string;
  threadId: string;
  from: EmailAddress;
  /** Raw To header (shown instead of the sender in Sent and Drafts). */
  to: string;
  subject: string;
  snippet: string;
  /** ISO 8601. */
  date: string;
  unread: boolean;
  important: boolean;
  starred: boolean;
  /** User-visible system labels, e.g. ["Inbox"]. */
  labels: string[];
}

export interface EmailPage {
  emails: EmailSummary[];
  nextPageToken: string | null;
  /** Gmail's estimate, not exact. */
  estimatedTotal: number;
}

/** A fully opened email. */
export interface EmailDetail extends EmailSummary {
  cc: string;
  text: string;
  attachments: string[];
}

export type LabelCounts = Partial<Record<MailView, { total: number; unread: number }>>;

/** The user's job-application details, stored only in their browser. */
export interface JobProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  portfolioUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  otherUrl: string;
  /** Experience, key skills and projects in the user's own words; the AI uses only these facts. */
  summary: string;
  /** The user's go-to paragraph about their experience; templates insert it as {{pitch}}. */
  pitch: string;
  signature: string;
  tone: "professional" | "friendly";
}

/** What the server/AI sees of a resume (never the PDF itself, except when attaching). */
export interface ResumeSummary {
  id: string;
  label: string;
  /** First part of the resume's text, so the AI can match it to the job. */
  excerpt: string;
}

export interface JobAnalysis {
  isJobOpportunity: boolean;
  company: string | null;
  role: string | null;
  location: string | null;
  skills: string[];
  applyMethod: "reply" | "email" | "link" | "unknown";
  applyEmail: string | null;
  applyLink: string | null;
  deadline: string | null;
  asksFor: { resume: boolean; portfolio: boolean; github: boolean; coverLetter: boolean };
  suggestedResumeId: string | null;
  resumeReason: string | null;
  subject: string;
  body: string;
}

/** Original-message details needed to reply in the same Gmail thread. */
export interface ReplyContext {
  threadId: string;
  messageId: string | null;
  references: string | null;
  replyTo: string;
  subject: string;
}
