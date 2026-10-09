import type { AgendaItem } from "./types";

const MINUTE = 60_000;

// Words too generic to show two titles describe the same event.
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "with", "for", "to", "of", "on", "at", "in", "your", "you", "my", "our",
  "meeting", "call", "appointment", "event", "invitation", "invite", "reminder", "confirmed", "confirmation",
  "updated", "new", "re", "fwd", "sync", "session",
]);

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function sharesWord(a: string, b: string): boolean {
  const wordsB = significantWords(b);
  return [...significantWords(a)].some((w) => wordsB.has(w));
}

/**
 * Two items describe the same event if they start within two hours of each other AND
 * share a meaningful title word or meeting link. Time alone isn't enough: a 3pm dentist
 * appointment in email must not be hidden by an unrelated 3pm standup on the calendar.
 */
export function isSameEvent(a: AgendaItem, b: AgendaItem): boolean {
  const related = sharesWord(a.title, b.title) || (a.meetingLink !== null && a.meetingLink === b.meetingLink);
  if (!related) return false;
  if (a.allDay || b.allDay) return a.start.slice(0, 10) === b.start.slice(0, 10);
  return Math.abs(Date.parse(a.start) - Date.parse(b.start)) <= 120 * MINUTE;
}

/**
 * Combines calendar events with appointments found in email:
 * - the calendar wins when both describe the same event (it's the user's source of truth),
 *   but remembers the matching email so the UI can link to it;
 * - duplicates among emails (confirmation + reminder) collapse into the most confident one;
 * - email appointments left over are flagged `missingFromCalendar`.
 * Past items (ended before `from`) are dropped. Result is sorted by start time.
 */
export function mergeAgenda(calendarItems: AgendaItem[], emailItems: AgendaItem[], from: Date): AgendaItem[] {
  const isUpcoming = (item: AgendaItem) => Date.parse(item.end ?? item.start) >= from.getTime() - (item.allDay ? 86_400_000 : 0);
  const calendar = calendarItems.filter(isUpcoming).map((item) => ({ ...item }));

  const emails: AgendaItem[] = [];
  const byConfidence = [...emailItems].filter(isUpcoming).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  for (const item of byConfidence) {
    const calendarMatch = calendar.find((c) => isSameEvent(c, item));
    if (calendarMatch) {
      calendarMatch.emailId ??= item.emailId;
      calendarMatch.emailSubject ??= item.emailSubject;
      // An email saying the event was cancelled is worth surfacing even though it's on the calendar.
      if (item.status === "cancelled") calendarMatch.status = "cancelled";
      continue;
    }
    if (emails.some((e) => isSameEvent(e, item))) continue;
    emails.push({ ...item, missingFromCalendar: item.status !== "cancelled" });
  }

  return [...calendar, ...emails].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
