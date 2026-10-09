import { describe, expect, it } from "vitest";
import { buildEmailMessage, buildExtractionPrompt, parseExtraction, toAgendaItem } from "./extract";

describe("parseExtraction", () => {
  it("parses a valid reply", () => {
    const raw = JSON.stringify({
      appointments: [
        { title: "Dentist – Dr. Rao", start: "2026-10-16T16:00:00+05:30", end: "2026-10-16T16:30:00+05:30", allDay: false, location: "Smile Clinic", meetingLink: null, organizer: "Smile Clinic", status: "scheduled", confidence: 0.92 },
      ],
    });
    expect(parseExtraction(raw)).toEqual([
      { title: "Dentist – Dr. Rao", start: "2026-10-16T16:00:00+05:30", end: "2026-10-16T16:30:00+05:30", allDay: false, location: "Smile Clinic", meetingLink: null, organizer: "Smile Clinic", status: "scheduled", confidence: 0.92 },
    ]);
  });

  it("tolerates markdown code fences", () => {
    expect(parseExtraction('```json\n{"appointments":[{"title":"Call","start":"2026-10-20T10:00:00Z"}]}\n```')).toHaveLength(1);
  });

  it("returns [] for non-JSON or unexpected shapes", () => {
    expect(parseExtraction("Sorry, I can't help with that.")).toEqual([]);
    expect(parseExtraction('{"foo": 1}')).toEqual([]);
  });

  it("drops invalid items but keeps valid ones", () => {
    const raw = JSON.stringify({ appointments: [{ title: "", start: "2026-10-20T10:00:00Z" }, { title: "No date", start: "next week" }, { title: "Valid", start: "2026-10-20T10:00:00Z" }] });
    expect(parseExtraction(raw).map((a) => a.title)).toEqual(["Valid"]);
  });

  it("applies safe defaults and clamps values", () => {
    const [a] = parseExtraction(JSON.stringify({ appointments: [{ title: "X", start: "2026-10-20T10:00:00Z", status: "maybe", confidence: 7, end: "garbage" }] }));
    expect(a).toMatchObject({ status: "scheduled", confidence: 1, end: null, allDay: false, location: null });
  });

  it("only keeps https meeting links (no javascript: or http:)", () => {
    const links = ["javascript:alert(1)", "http://insecure.example.com", "https://zoom.us/j/123"].map(
      (meetingLink) => parseExtraction(JSON.stringify({ appointments: [{ title: "X", start: "2026-10-20T10:00:00Z", meetingLink }] }))[0].meetingLink,
    );
    expect(links).toEqual([null, null, "https://zoom.us/j/123"]);
  });
});

describe("prompt building", () => {
  it("wraps the email as untrusted data and includes the timezone", () => {
    expect(buildExtractionPrompt("Asia/Kolkata")).toContain("assume Asia/Kolkata");
    expect(buildExtractionPrompt("UTC")).toMatch(/untrusted data/i);
    const message = buildEmailMessage({ id: "1", subject: "Hi", from: "a@b.c", date: "2026-10-09T10:00:00.000Z", text: "Body" });
    expect(message).toContain("<email>\nBody\n</email>");
  });
});

describe("toAgendaItem", () => {
  it("links the item to its email and marks it missing until merged", () => {
    const email = { id: "abc", subject: "Booking confirmed", from: "x", date: "2026-10-09T10:00:00Z", text: "" };
    const [appointment] = parseExtraction(JSON.stringify({ appointments: [{ title: "Hotel", start: "2026-11-01T14:00:00Z" }] }));
    expect(toAgendaItem(appointment, email, 0)).toMatchObject({ id: "email-abc-0", source: "email", emailId: "abc", emailSubject: "Booking confirmed", missingFromCalendar: true });
  });
});
