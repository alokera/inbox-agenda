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
