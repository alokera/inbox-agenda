import { describe, expect, it } from "vitest";
import { buildApplicationPrompt, buildColdMessage, parseApplication } from "./application";
import type { JobProfile } from "./types";

const profile: JobProfile = {
  fullName: "Aalok Upadhyay",
  email: "aalok@example.com",
  phone: "",
  location: "Pune",
  headline: "Full-stack developer",
  portfolioUrl: "https://aalok.dev",
  githubUrl: "https://github.com/alokera",
  linkedinUrl: "",
  otherUrl: "",
  summary: "Built a RAG app and a Redis job queue.",
  pitch: "I have 4+ years of experience building full-stack web apps.",
  signature: "Best,\nAalok",
  tone: "professional",
};

const valid = {
  isJobOpportunity: true,
  company: "Acme",
  role: "Frontend Engineer",
  location: "Remote",
  skills: ["React", "TypeScript"],
  applyMethod: "email",
  applyEmail: "jobs@acme.com",
  applyLink: null,
  deadline: "Oct 20",
  asksFor: { resume: true, portfolio: true, github: false, coverLetter: false },
  suggestedResumeId: "r1",
  resumeReason: "Frontend-focused resume.",
  subject: "Application – Frontend Engineer – Aalok Upadhyay",
  body: "Hi Acme team, ...",
};

describe("parseApplication", () => {
  it("accepts a valid reply", () => {
    expect(parseApplication(JSON.stringify(valid), ["r1", "r2"])).toMatchObject({ company: "Acme", suggestedResumeId: "r1", applyEmail: "jobs@acme.com" });
  });

  it("tolerates code fences", () => {
    expect(parseApplication("```json\n" + JSON.stringify(valid) + "\n```", ["r1"])).not.toBeNull();
  });

  it("drops a resume id the user doesn't have (hallucinated)", () => {
    const result = parseApplication(JSON.stringify({ ...valid, suggestedResumeId: "made-up" }), ["r1"]);
    expect(result?.suggestedResumeId).toBeNull();
    expect(result?.resumeReason).toBeNull();
  });

  it("rejects unsafe links and invalid emails", () => {
    const result = parseApplication(JSON.stringify({ ...valid, applyEmail: "not an email", applyLink: "javascript:alert(1)" }), ["r1"]);
    expect(result).toMatchObject({ applyEmail: null, applyLink: null });
  });

  it("applies defaults for bad enum values and missing fields", () => {
    const result = parseApplication(JSON.stringify({ subject: "Hi", body: "Hello", applyMethod: "fax" }), []);
    expect(result).toMatchObject({ isJobOpportunity: false, applyMethod: "unknown", skills: [], asksFor: { resume: false } });
  });

  it("returns null without a subject/body or for non-JSON", () => {
    expect(parseApplication(JSON.stringify({ ...valid, body: "" }), [])).toBeNull();
    expect(parseApplication("I can't help with that", [])).toBeNull();
  });
});

describe("buildApplicationPrompt", () => {
  it("includes profile facts and links, skips empty fields, and forbids invented facts", () => {
    const prompt = buildApplicationPrompt(profile, [{ id: "r1", label: "Frontend", excerpt: "React, Next.js" }]);
    expect(prompt).toContain("Portfolio: https://aalok.dev");
    expect(prompt).toContain("GitHub: https://github.com/alokera");
    expect(prompt).not.toContain("LinkedIn: https"); // the profile has no LinkedIn URL
    expect(prompt).not.toContain("Phone:");
    expect(prompt).toContain("[id: r1] Frontend");
    expect(prompt).toMatch(/Never invent/);
    expect(prompt).toContain("**Portfolio:** <url>");
    expect(prompt).toContain("Experience paragraph they like to use:\nI have 4+ years");
    expect(prompt).toMatch(/untrusted data/);
  });

  it("tells the model when there are no resumes", () => {
    expect(buildApplicationPrompt(profile, [])).toContain("(none uploaded");
  });
});

describe("cold applications", () => {
  it("uses the cold-email instructions and no Re: subject", () => {
    const prompt = buildApplicationPrompt(profile, [], "cold");
    expect(prompt).toMatch(/FIRST email/);
    expect(prompt).toMatch(/No 'Re:'/);
    expect(prompt).not.toMatch(/reply to ONE email/);
  });

  it("tells the model not to guess a company from a personal address", () => {
    expect(buildColdMessage({ to: "recruiter.jane@gmail.com" })).toMatch(/personal email address, so don't guess/);
    expect(buildColdMessage({ to: "jobs@acme.io" })).toContain("Company: (not given)");
    expect(buildColdMessage({ to: "jobs@acme.io", company: "Acme", role: "Frontend Engineer", jobDescription: "React + TS" })).toContain("<job_description>\nReact + TS\n</job_description>");
  });
});
