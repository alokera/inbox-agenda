import { describe, expect, it } from "vitest";
import { buildAlertQuery, buildScoringPrompt, canonicalJobUrl, detectSource, isSkipped, jobKey, numberLinks, parseExtractedJobs, parseScores } from "./job-feed";
import { emptyProfile } from "./profile-store";

const LI_URL = "https://www.linkedin.com/comm/jobs/view/3912345678/?trackingId=abc%3D%3D&refId=xyz&lipi=urn&midToken=t";

describe("buildAlertQuery", () => {
  it("searches job sites within the window", () => {
    const q = buildAlertQuery(7);
    expect(q).toContain("linkedin.com OR indeed.com OR naukri.com");
    expect(q).toContain("newer_than:7d");
  });
});

describe("numberLinks", () => {
  it("replaces job links with ids, reuses ids for the same URL, and drops noise links", () => {
    const html = `<a href="${LI_URL.replace(/&/g, "&amp;")}">Frontend Engineer</a> Acme · Pune <a href="${LI_URL.replace(/&/g, "&amp;")}">Acme</a>
      <a href="https://www.linkedin.com/comm/psettings/unsubscribe?x=1">Unsubscribe</a> <a href="mailto:a@b.c">Mail</a>`;
    const { text, links } = numberLinks(html, "");
    expect(text).toContain("Frontend Engineer [L1]");
    expect(text).toContain("Acme [L1]"); // same URL → same id
    expect(text).toContain("Unsubscribe");
    expect(text).not.toContain("[L2]");
    expect(links).toEqual({ L1: LI_URL });
    expect(text).not.toContain("http"); // no raw URLs sent to the AI
  });

  it("numbers bare URLs in plain-text emails", () => {
    const { text, links } = numberLinks("", "Backend Dev at X https://in.indeed.com/viewjob?jk=abc123");
    expect(text).toBe("Backend Dev at X [L1]");
    expect(links.L1).toBe("https://in.indeed.com/viewjob?jk=abc123");
  });
});

describe("canonicalJobUrl / jobKey", () => {
  it("shortens LinkedIn job links to their canonical form", () => {
    expect(canonicalJobUrl(LI_URL)).toBe("https://www.linkedin.com/jobs/view/3912345678/");
    expect(canonicalJobUrl("https://www.linkedin.com/jobs/search/?currentJobId=3912345678&keywords=react")).toBe("https://www.linkedin.com/jobs/view/3912345678/");
  });

  it("strips tracking parameters elsewhere but keeps the job id", () => {
    expect(canonicalJobUrl("https://in.indeed.com/viewjob?jk=abc123&utm_source=alert&from=ja#top")).toBe("https://in.indeed.com/viewjob?jk=abc123");
  });

  it("derives stable keys from site job ids, else company + title", () => {
    expect(jobKey({ url: canonicalJobUrl(LI_URL), company: "Acme", title: "Frontend Engineer" })).toBe("linkedin:3912345678");
    expect(jobKey({ url: "https://in.indeed.com/viewjob?jk=abc123", company: null, title: "x" })).toBe("indeed:abc123");
    expect(jobKey({ url: "https://www.naukri.com/job-listings-full-stack-developer-acme-pune-4-to-8-years-091024012345", company: null, title: "x" })).toBe("naukri:091024012345");
    expect(jobKey({ url: null, company: "Acme Inc.", title: "Full-Stack  Developer" })).toBe("job:acme inc|full stack developer");
  });

  it("detects the source from the URL or the sender", () => {
    expect(detectSource("https://www.linkedin.com/jobs/view/1/", "")).toBe("linkedin");
    expect(detectSource(null, "Naukri <jobalerts@naukri.com>")).toBe("naukri");
    expect(detectSource(null, "someone@example.com")).toBe("other");
    expect(detectSource("https://in.indeed.com/viewjob?jk=1", "jobalerts-noreply@linkedin.com")).toBe("indeed"); // link wins
  });
});

describe("isSkipped", () => {
  const prefs = { skipKeywords: "intern, senior manager", skipCompanies: "Bad Corp" };
  it("skips by title keyword or company, case-insensitively", () => {
    expect(isSkipped({ title: "Software Engineering Intern", company: "Acme" }, prefs)).toBe(true);
    expect(isSkipped({ title: "Frontend Engineer", company: "BAD CORP Pvt Ltd" }, prefs)).toBe(true);
    expect(isSkipped({ title: "Frontend Engineer", company: "Acme" }, prefs)).toBe(false);
    expect(isSkipped({ title: "Frontend Engineer", company: null }, { skipKeywords: "", skipCompanies: "" })).toBe(false);
  });
});

describe("parseExtractedJobs", () => {
  const email = { text: "", links: { L1: LI_URL, L2: "https://in.indeed.com/viewjob?jk=zz9&from=ja" } };
  const meta = { emailId: "m1", from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>" };

  it("maps link ids to canonical URLs and builds keys", () => {
    const jobs = parseExtractedJobs(JSON.stringify({ jobs: [{ title: "Frontend Engineer", company: "Acme", location: "Pune", linkId: "[L1]" }, { title: "Backend Developer", company: "Beta", linkId: "L2" }] }), email, meta);
    expect(jobs[0]).toMatchObject({ key: "linkedin:3912345678", url: "https://www.linkedin.com/jobs/view/3912345678/", source: "linkedin", alertEmailId: "m1", salary: null });
    expect(jobs[1]).toMatchObject({ key: "indeed:zz9", url: "https://in.indeed.com/viewjob?jk=zz9", source: "indeed" });
  });

  it("ignores link ids the AI made up and drops invalid jobs", () => {
    const jobs = parseExtractedJobs(JSON.stringify({ jobs: [{ title: "Data Engineer", company: "C", linkId: "L99" }, { title: "" }, { company: "no title" }] }), email, meta);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].url).toBeNull();
    expect(jobs[0].key).toBe("job:c|data engineer");
  });

  it("returns [] for unusable replies", () => {
    expect(parseExtractedJobs("not json", email, meta)).toEqual([]);
  });
});

describe("parseScores", () => {
  it("clamps scores, trims lists, and ignores ids that weren't asked about", () => {
    const raw = JSON.stringify({ scores: [{ id: "a", score: 130, reasons: ["1", "2", "3", "4"], concerns: [] }, { id: "zzz", score: 50 }, { id: "b", score: "high" }] });
    const scores = parseScores(raw, ["a", "b"]);
    expect(scores.get("a")).toEqual({ score: 100, reasons: ["1", "2", "3"], concerns: [] });
    expect(scores.get("b")?.score).toBe(0);
    expect(scores.has("zzz")).toBe(false);
  });
});

describe("buildScoringPrompt", () => {
  it("includes preferences and the candidate's experience", () => {
    const profile = { ...emptyProfile("Alok", "a@x.com"), headline: "Full Stack Developer", pitch: "4+ years with React and Node." };
    const prompt = buildScoringPrompt(profile, { roles: "Full Stack, Frontend", locations: "Pune", remoteOk: true, experienceYears: "4", minSalary: "15 LPA", skipKeywords: "", skipCompanies: "" });
    expect(prompt).toContain("Target roles: Full Stack, Frontend");
    expect(prompt).toContain("Locations: Pune · remote is fine");
    expect(prompt).toContain("Experience: 4+ years with React and Node.");
    expect(prompt).toMatch(/untrusted data/);
  });
});
