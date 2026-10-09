import { describe, expect, it } from "vitest";
import { defaultSignature, emptyProfile, previousApplicationsTo, toResumeSummaries, type SentApplication, type StoredResume } from "./profile-store";

const sent = (to: string, sentAt: number) => ({ id: String(sentAt), to, subject: "s", company: null, role: null, resumeLabel: null, sentAt, messageId: "m", threadId: "t" }) satisfies SentApplication;

describe("previousApplicationsTo", () => {
  it("matches addresses case-insensitively and ignores whitespace", () => {
    const history = [sent("HR@Acme.com", 2), sent("jobs@other.io", 1)];
    expect(previousApplicationsTo(history, " hr@acme.com ").map((h) => h.id)).toEqual(["2"]);
    expect(previousApplicationsTo(history, "")).toEqual([]);
  });
});

describe("profile helpers", () => {
  it("builds a signature from the filled-in fields only", () => {
    const profile = { ...emptyProfile("Aalok Upadhyay", "a@x.com"), headline: "Full-stack developer", portfolioUrl: "https://aalok.dev" };
    expect(defaultSignature(profile)).toBe("Best regards,\nAalok Upadhyay\nFull-stack developer\na@x.com\nhttps://aalok.dev");
  });

  it("only shares a resume excerpt with the AI", () => {
    const resume = { id: "r1", label: "Frontend", text: "x".repeat(5000) } as StoredResume;
    expect(toResumeSummaries([resume])[0].excerpt).toHaveLength(2000);
  });
});
