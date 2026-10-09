import { describe, expect, it } from "vitest";
import { emptyProfile } from "./profile-store";
import { DEFAULT_TEMPLATES, fillTemplate, findPlaceholders, templateValues } from "./templates";

const profile = { ...emptyProfile("Aalok Upadhyay", "aalok@example.com"), headline: "a full-stack developer", portfolioUrl: "https://aalok.dev", githubUrl: "https://github.com/alokera", signature: "Best,\nAalok" };

describe("fillTemplate", () => {
  it("fills variables and uses fallbacks for empty ones", () => {
    expect(fillTemplate("Apply for {{role|a developer role}} at {{company}}", { role: "", company: "Acme" })).toBe("Apply for a developer role at Acme");
    expect(fillTemplate("Apply for {{role|a developer role}}", { role: "Frontend Engineer" })).toBe("Apply for Frontend Engineer");
  });

  it("removes a line whose variable is empty and has no fallback", () => {
    expect(fillTemplate("Hi\nPhone: {{phone}}\nBye", { phone: "" })).toBe("Hi\nBye");
  });

  it("collapses the blank lines left behind", () => {
    expect(fillTemplate("A\n\n{{links}}\n\nB", { links: "" })).toBe("A\n\nB");
  });

  it("keeps unknown variables visible and is case/space tolerant", () => {
    expect(fillTemplate("{{ Name }} {{nmae}}", { name: "Aalok" })).toBe("Aalok {{nmae}}");
  });
});

describe("default templates", () => {
  it("produce a complete email from a profile, with links and signature", () => {
    const values = templateValues(profile, { company: "Acme", role: "Frontend Engineer" });
    const body = fillTemplate(DEFAULT_TEMPLATES[0].body, values);
    expect(fillTemplate(DEFAULT_TEMPLATES[0].subject, values)).toBe("Application – Frontend Engineer – Aalok Upadhyay");
    expect(body).toContain("apply for Frontend Engineer at Acme");
    expect(body).toContain("Portfolio: https://aalok.dev\nGitHub: https://github.com/alokera");
    expect(body.endsWith("Best,\nAalok")).toBe(true);
    expect(body).not.toMatch(/\{\{/);
  });

  it("read naturally when company, role and location are unknown", () => {
    const values = templateValues(profile);
    for (const template of DEFAULT_TEMPLATES) {
      const body = fillTemplate(template.body, values);
      expect(body).not.toMatch(/\{\{|\bat\s*\.|for\s*\./);
      expect(fillTemplate(template.subject, values)).not.toMatch(/\{\{|–\s*–/);
    }
    // The introduction must survive missing details (a dropped line would lose the whole sentence).
    expect(fillTemplate(DEFAULT_TEMPLATES[0].body, values)).toContain("I'm Aalok Upadhyay, a full-stack developer, and I'd like to apply for a developer role at your company.");
  });
});

describe("findPlaceholders", () => {
  it("finds unfinished bracketed notes but not short brackets", () => {
    expect(findPlaceholders("Hi\n[Add 1–2 lines on why you fit]\nSee [1]")).toEqual(["[Add 1–2 lines on why you fit]"]);
    expect(findPlaceholders("All done")).toEqual([]);
  });
});
