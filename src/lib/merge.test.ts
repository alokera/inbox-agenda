import { describe, expect, it } from "vitest";
import { isSameEvent, mergeAgenda } from "./merge";
import type { AgendaItem } from "./types";

const NOW = new Date("2026-10-09T09:00:00Z");

function item(overrides: Partial<AgendaItem>): AgendaItem {
  return {
    id: Math.random().toString(36),
    source: "email",
    title: "Untitled",
    start: "2026-10-10T10:00:00Z",
    end: null,
    allDay: false,
    location: null,
    meetingLink: null,
    organizer: null,
    status: "scheduled",
    confidence: 0.9,
    emailId: "e1",
    emailSubject: "Subject",
    calendarLink: null,
    missingFromCalendar: true,
    ...overrides,
  };
}

const cal = (overrides: Partial<AgendaItem>) => item({ source: "calendar", confidence: null, emailId: null, emailSubject: null, missingFromCalendar: false, ...overrides });

describe("isSameEvent", () => {
  it("matches same-ish time with a shared meaningful word", () => {
    expect(isSameEvent(cal({ title: "Project Phoenix sync", start: "2026-10-10T10:00:00Z" }), item({ title: "Phoenix kickoff", start: "2026-10-10T10:30:00Z" }))).toBe(true);
  });

  it("does not match on time alone (different events at the same time)", () => {
    expect(isSameEvent(cal({ title: "Team standup" }), item({ title: "Dentist appointment" }))).toBe(false);
  });

  it("ignores generic words like 'meeting' or 'call'", () => {
    expect(isSameEvent(cal({ title: "Meeting with Priya" }), item({ title: "Call with Rahul" }))).toBe(false);
  });

  it("matches on identical meeting links", () => {
    const link = "https://meet.google.com/abc-defg-hij";
    expect(isSameEvent(cal({ title: "Weekly", meetingLink: link }), item({ title: "Catch-up", meetingLink: link }))).toBe(true);
  });

  it("does not match events far apart in time", () => {
    expect(isSameEvent(cal({ title: "Phoenix review", start: "2026-10-10T10:00:00Z" }), item({ title: "Phoenix review", start: "2026-10-12T10:00:00Z" }))).toBe(false);
  });
});

describe("mergeAgenda", () => {
  it("flags email appointments that aren't on the calendar", () => {
    const result = mergeAgenda([cal({ title: "Standup" })], [item({ title: "Dentist – Dr. Rao", start: "2026-10-11T11:00:00Z" })], NOW);
    expect(result.find((r) => r.title.startsWith("Dentist"))?.missingFromCalendar).toBe(true);
  });

  it("prefers the calendar event when both describe the same thing, linking the email", () => {
    const result = mergeAgenda([cal({ id: "c1", title: "Interview with Acme" })], [item({ title: "Acme interview", emailId: "mail-1", emailSubject: "Interview invite" })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "c1", source: "calendar", emailId: "mail-1", missingFromCalendar: false });
  });

  it("collapses duplicate emails (confirmation + reminder), keeping the most confident", () => {
    const result = mergeAgenda([], [item({ id: "low", title: "Flight AI 101 to Delhi", confidence: 0.6 }), item({ id: "high", title: "Flight AI101 Delhi", confidence: 0.95 })], NOW);
    expect(result.map((r) => r.id)).toEqual(["high"]);
  });

  it("surfaces a cancellation from email on the matching calendar event", () => {
    const result = mergeAgenda([cal({ title: "Haircut at Looks" })], [item({ title: "Haircut cancelled", status: "cancelled" })], NOW);
    expect(result[0]).toMatchObject({ source: "calendar", status: "cancelled" });
  });

  it("does not flag cancelled email-only appointments as missing", () => {
    const [only] = mergeAgenda([], [item({ title: "Yoga class", status: "cancelled" })], NOW);
    expect(only.missingFromCalendar).toBe(false);
  });

  it("drops past items and sorts by start time", () => {
    const result = mergeAgenda(
      [cal({ title: "Later", start: "2026-10-20T10:00:00Z" }), cal({ title: "Past", start: "2026-10-01T10:00:00Z" })],
      [item({ title: "Sooner", start: "2026-10-09T15:00:00Z" })],
      NOW,
    );
    expect(result.map((r) => r.title)).toEqual(["Sooner", "Later"]);
  });

  it("keeps an event that started earlier but is still in progress", () => {
    const [ongoing] = mergeAgenda([cal({ title: "Workshop", start: "2026-10-09T08:00:00Z", end: "2026-10-09T12:00:00Z" })], [], NOW);
    expect(ongoing?.title).toBe("Workshop");
  });
});
