import { describe, expect, it } from "vitest";
import { buildRecruiterQuery, buildTriagePrompt, decide, DEFAULT_AUTOPILOT, followUpsDue, normalizeSettings, parseTriage, type Triage } from "./autopilot";
import { emptyPreferences } from "./job-store";
import { emptyProfile } from "./profile-store";

const triage = (extra: Partial<Triage> = {}): Triage => ({
  isJobOpportunity: true,
  canApplyByEmail: true,
  applyEmail: null,
  role: "Full Stack Developer",
  company: "Acme",
  location: "Pune",
  score: 90,
  reasons: [],
  concerns: [],
  ...extra,
});

const base = { settings: { ...DEFAULT_AUTOPILOT, mode: "auto" as const }, alreadyApplied: false, alreadyRepliedInThread: false, sentToday: 0, canSend: true };

describe("decide", () => {
  it("auto-sends strong matches in auto mode", () => {
    expect(decide({ ...base, triage: triage({ score: 90 }) }).action).toBe("auto-send");
  });

  it("queues good-but-not-great matches, and everything in review mode", () => {
    expect(decide({ ...base, triage: triage({ score: 75 }) }).action).toBe("queue");
    expect(decide({ ...base, settings: { ...DEFAULT_AUTOPILOT, mode: "review" }, triage: triage({ score: 99 }) }).action).toBe("queue");
  });

  it("queues instead of sending at the daily cap or without permission", () => {
    expect(decide({ ...base, sentToday: 10, triage: triage() })).toMatchObject({ action: "queue", reason: expect.stringMatching(/Daily limit/) });
    expect(decide({ ...base, canSend: false, triage: triage() })).toMatchObject({ action: "queue", reason: expect.stringMatching(/permission/) });
  });

  it("skips non-jobs, website-only jobs, duplicates and low matches", () => {
    expect(decide({ ...base, triage: triage({ isJobOpportunity: false }) }).reason).toMatch(/Not a job/);
    expect(decide({ ...base, triage: triage({ canApplyByEmail: false }) }).reason).toMatch(/website/);
    expect(decide({ ...base, alreadyRepliedInThread: true, triage: triage() }).reason).toMatch(/already replied/);
    expect(decide({ ...base, alreadyApplied: true, triage: triage() }).reason).toMatch(/already emailed/);
    expect(decide({ ...base, triage: triage({ score: 40 }) })).toMatchObject({ action: "skip", reason: "Low match (40%)" });
  });
});

describe("normalizeSettings", () => {
  it("clamps unsafe values", () => {
    const s = normalizeSettings({ mode: "auto", dailyCap: 500, autoSendScore: 10, queueScore: 99, lookbackDays: -3 });
    expect(s).toMatchObject({ mode: "auto", dailyCap: 25, autoSendScore: 50, queueScore: 50, lookbackDays: 1 });
  });

  it("falls back to defaults for junk", () => {
    expect(normalizeSettings({ mode: "turbo" as never, dailyCap: Number.NaN })).toMatchObject({ mode: "off", dailyCap: 10 });
  });
});

describe("followUpsDue", () => {
  const now = new Date(2026, 9, 20).getTime();
  const day = 86_400_000;
  it("returns unanswered applications older than the threshold, once", () => {
    const history = [
      { messageId: "old", sentAt: now - 8 * day },
      { messageId: "recent", sentAt: now - 2 * day },
      { messageId: "replied", sentAt: now - 9 * day, repliedAt: now - 5 * day },
      { messageId: "done", sentAt: now - 9 * day, followUpQueuedAt: now - day },
      { messageId: "ancient", sentAt: now - 90 * day },
    ];
    expect(followUpsDue(history, 7, now).map((h) => h.messageId)).toEqual(["old"]);
    expect(followUpsDue(history, 0, now)).toEqual([]);
  });
});

describe("triage", () => {
  it("parses and sanitises the model's answer", () => {
    expect(parseTriage(JSON.stringify({ isJobOpportunity: true, canApplyByEmail: true, applyEmail: "not-an-email", score: 140, reasons: ["a"] }))).toMatchObject({ applyEmail: null, score: 100, concerns: [] });
    expect(parseTriage("nope")).toBeNull();
  });

  it("builds a prompt with the candidate's preferences", () => {
    const prompt = buildTriagePrompt({ ...emptyProfile("Alok", "a@x.com"), headline: "Full Stack Developer" }, { ...emptyPreferences(), roles: "Full Stack", locations: "Pune" });
    expect(prompt).toContain("Target roles: Full Stack");
    expect(prompt).toMatch(/untrusted data/);
  });

  it("excludes job-alert digests from the recruiter search", () => {
    expect(buildRecruiterQuery(14)).toContain("-from:jobalerts-noreply@linkedin.com");
    expect(buildRecruiterQuery(14)).toContain("newer_than:14d");
  });
});
