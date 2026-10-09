import "server-only";
import { gmail } from "@googleapis/gmail";
import type { OAuth2Client } from "google-auth-library";
import { mapWithConcurrency } from "./concurrency";
import { extractEmailText, getHeader } from "./email-text";
import type { EmailCandidate } from "./types";

export const MAX_EMAILS = 40;

// Cheap pre-filter done by Gmail itself, so only plausible emails reach the (paid) AI.
const KEYWORDS = [
  "meeting", "appointment", "interview", "scheduled", "reschedule", "rescheduled", "cancelled", "canceled",
  "reservation", "booking", "booked", "confirmed", "confirmation", "invitation", "invite", "reminder",
  "call", "consultation", "zoom.us", "meet.google.com", "teams.microsoft.com", "filename:ics",
];

export function buildSearchQuery(days: number): string {
  const keywords = KEYWORDS.map((k) => (k.includes(":") ? k : `"${k}"`)).join(" OR ");
  return `newer_than:${days}d -category:promotions -category:social -in:spam -in:trash (${keywords})`;
}

export async function findCandidateEmails(
  auth: OAuth2Client,
  days: number,
  onProgress?: (done: number, total: number) => void,
): Promise<EmailCandidate[]> {
  const api = gmail({ version: "v1", auth });
  const list = await api.users.messages.list({ userId: "me", q: buildSearchQuery(days), maxResults: MAX_EMAILS });
  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  let done = 0;
  const emails = await mapWithConcurrency(ids, 8, async (id) => {
    const { data } = await api.users.messages.get({ userId: "me", id, format: "full" });
    onProgress?.(++done, ids.length);
    if (!data.payload) return null;
    const sentAt = data.internalDate ? new Date(Number(data.internalDate)) : new Date(getHeader(data.payload, "Date"));
    return {
      id,
      subject: getHeader(data.payload, "Subject") || "(no subject)",
      from: getHeader(data.payload, "From"),
      date: (Number.isNaN(sentAt.getTime()) ? new Date() : sentAt).toISOString(),
      text: extractEmailText(data.payload),
    } satisfies EmailCandidate;
  });
  return emails.filter((e): e is EmailCandidate => e !== null && e.text.length > 0);
}
