import { describe, expect, it } from "vitest";
import { emptyPreferences, mergeFoundJobs, trimFeed, type FeedJob } from "./job-store";
import type { ScoredJob } from "./types";

const found = (key: string, extra: Partial<ScoredJob> = {}): ScoredJob => ({
  key,
  title: "Full Stack Developer",
  company: "Acme",
  location: "Pune",
  salary: null,
  experience: null,
  url: null,
  source: "linkedin",
  snippet: null,
  posted: null,
  alertEmailId: "m1",
  ...extra,
});

describe("mergeFoundJobs", () => {
  it("adds new jobs as 'new'", () => {
    const [job] = mergeFoundJobs([], [found("a", { score: 80 })], 1000);
    expect(job).toMatchObject({ key: "a", status: "new", score: 80, foundAt: 1000 });
  });

  it("keeps the status of known jobs and only fills in missing details", () => {
    const existing: FeedJob[] = [{ ...found("a", { score: 70 }), status: "applied", foundAt: 1, statusChangedAt: 2 }];
    const [job] = mergeFoundJobs(existing, [found("a", { score: 95, url: "https://x.com/job/1", salary: "20 LPA" })]);
    expect(job).toMatchObject({ status: "applied", score: 70, url: "https://x.com/job/1", salary: "20 LPA", foundAt: 1 });
  });
});

describe("trimFeed", () => {
  it("drops the oldest untouched jobs but never tracked ones", () => {
    const jobs: FeedJob[] = Array.from({ length: 1005 }, (_, i) => ({ ...found(`k${i}`), status: i === 0 ? "applied" : "new", foundAt: i, statusChangedAt: i }));
    const trimmed = trimFeed(jobs);
    expect(trimmed).toHaveLength(1000);
    expect(trimmed.some((j) => j.key === "k0")).toBe(true); // tracked, despite being oldest
    expect(trimmed.some((j) => j.key === "k1")).toBe(false); // oldest untouched
  });
});

describe("emptyPreferences", () => {
  it("starts target roles from the profile headline", () => {
    expect(emptyPreferences({ headline: "Full Stack Developer" } as never).roles).toBe("Full Stack Developer");
    expect(emptyPreferences().remoteOk).toBe(true);
  });
});
