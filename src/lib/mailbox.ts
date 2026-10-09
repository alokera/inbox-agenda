import "server-only";
import { gmail, type gmail_v1 } from "@googleapis/gmail";
import type { OAuth2Client } from "google-auth-library";
import { mapWithConcurrency } from "./concurrency";
import { decodeEntities, extractEmailText, getHeader, listAttachments, parseAddress } from "./email-text";
import type { EmailCandidate, EmailDetail, EmailPage, EmailSummary, LabelCounts, MailCategory, MailView, ReplyContext } from "./types";

export const PAGE_SIZE = 50;
const MAX_READER_CHARS = 100_000;

/** Each view is a Gmail system label. "All Mail" has none (everything except Spam and Trash). */
export const VIEW_LABELS: Record<MailView, string[]> = {
  inbox: ["INBOX"],
  starred: ["STARRED"],
  important: ["IMPORTANT"],
  sent: ["SENT"],
  drafts: ["DRAFT"],
  all: [],
  spam: ["SPAM"],
  trash: ["TRASH"],
};

/** Gmail's inbox tabs are labels too. */
export const CATEGORY_LABELS: Record<MailCategory, string> = {
  primary: "CATEGORY_PERSONAL",
  promotions: "CATEGORY_PROMOTIONS",
  social: "CATEGORY_SOCIAL",
  updates: "CATEGORY_UPDATES",
};

const VISIBLE_LABELS: Record<string, string> = { INBOX: "Inbox", SENT: "Sent", DRAFT: "Drafts", SPAM: "Spam", TRASH: "Trash" };

export function isMailView(value: unknown): value is MailView {
  return typeof value === "string" && value in VIEW_LABELS;
}

export function isMailCategory(value: unknown): value is MailCategory {
  return typeof value === "string" && value in CATEGORY_LABELS;
}

function toSummary(message: gmail_v1.Schema$Message): EmailSummary {
  const payload = message.payload ?? {};
  const labelIds = message.labelIds ?? [];
  const labels = new Set(labelIds);
  const sent = message.internalDate ? new Date(Number(message.internalDate)) : new Date(getHeader(payload, "Date"));
  return {
    id: message.id!,
    threadId: message.threadId ?? message.id!,
    from: parseAddress(getHeader(payload, "From")),
    to: getHeader(payload, "To"),
    subject: getHeader(payload, "Subject") || "(no subject)",
    snippet: decodeEntities(message.snippet ?? ""),
    date: (Number.isNaN(sent.getTime()) ? new Date(0) : sent).toISOString(),
    unread: labels.has("UNREAD"),
    important: labels.has("IMPORTANT"),
    starred: labels.has("STARRED"),
    labels: labelIds.filter((id) => id in VISIBLE_LABELS).map((id) => VISIBLE_LABELS[id]),
  };
}

export interface ListOptions {
  view: MailView;
  category?: MailCategory;
  /** Gmail search syntax, e.g. `from:amazon has:attachment`. */
  query?: string;
  pageToken?: string;
}

export async function listEmails(auth: OAuth2Client, { view, category, query, pageToken }: ListOptions): Promise<EmailPage> {
  const api = gmail({ version: "v1", auth });
  const labelIds = [...VIEW_LABELS[view], ...(view === "inbox" && category ? [CATEGORY_LABELS[category]] : [])];
  const list = await api.users.messages.list({
    userId: "me",
    labelIds: labelIds.length ? labelIds : undefined,
    q: query || undefined,
    includeSpamTrash: view === "spam" || view === "trash",
    maxResults: PAGE_SIZE,
    pageToken: pageToken || undefined,
  });

  // The list call only returns ids; fetch headers + snippet for each (metadata is much smaller than full).
  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
  const messages = await mapWithConcurrency(ids, 10, async (id) => {
    const { data } = await api.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] });
    return toSummary(data);
  });

  return { emails: messages, nextPageToken: list.data.nextPageToken ?? null, estimatedTotal: list.data.resultSizeEstimate ?? messages.length };
}

export async function getEmail(auth: OAuth2Client, id: string): Promise<EmailDetail> {
  const api = gmail({ version: "v1", auth });
  const { data } = await api.users.messages.get({ userId: "me", id, format: "full" });
  const payload = data.payload ?? {};
  return {
    ...toSummary(data),
    cc: getHeader(payload, "Cc"),
    text: extractEmailText(payload, MAX_READER_CHARS),
    attachments: listAttachments(payload),
  };
}

/** The opened email in the shape the AI extractor expects. */
export function toCandidate(email: EmailDetail): EmailCandidate {
  const from = email.from.name === email.from.email ? email.from.email : `${email.from.name} <${email.from.email}>`;
  return { id: email.id, subject: email.subject, from, date: email.date, text: email.text.slice(0, 6000) };
}

/** Exact total/unread counts per mailbox, for the sidebar and the "1–50 of N" pager. */
export async function getLabelCounts(auth: OAuth2Client): Promise<LabelCounts> {
  const api = gmail({ version: "v1", auth });
  const views: [MailView, string][] = [["inbox", "INBOX"], ["starred", "STARRED"], ["important", "IMPORTANT"], ["sent", "SENT"], ["drafts", "DRAFT"], ["spam", "SPAM"], ["trash", "TRASH"]];
  const entries = await Promise.all(
    views.map(async ([view, id]) => {
      const { data } = await api.users.labels.get({ userId: "me", id });
      return [view, { total: data.messagesTotal ?? 0, unread: data.messagesUnread ?? 0 }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Headers needed to reply in the same thread (Gmail threads replies by References + subject). */
export async function getReplyContext(auth: OAuth2Client, id: string): Promise<ReplyContext> {
  const api = gmail({ version: "v1", auth });
  const { data } = await api.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["Message-ID", "References", "Reply-To", "From", "Subject"] });
  const payload = data.payload ?? {};
  const replyTo = getHeader(payload, "Reply-To") || getHeader(payload, "From");
  return {
    threadId: data.threadId ?? id,
    messageId: getHeader(payload, "Message-ID") || null,
    references: getHeader(payload, "References") || null,
    replyTo: parseAddress(replyTo).email,
    subject: getHeader(payload, "Subject") || "",
  };
}

/** Saves a draft (never sends). Returns the draft's message id, used to open it in Gmail. */
export async function createDraft(auth: OAuth2Client, raw: string, threadId: string): Promise<{ draftId: string; messageId: string }> {
  const api = gmail({ version: "v1", auth });
  const { data } = await api.users.drafts.create({ userId: "me", requestBody: { message: { raw, threadId } } });
  return { draftId: data.id!, messageId: data.message?.id ?? "" };
}
