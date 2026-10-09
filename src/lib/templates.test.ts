import { describe, expect, it } from "vitest";
import { emptyProfile } from "./profile-store";
import { DEFAULT_TEMPLATES, fillTemplate, findPlaceholders, templateValues } from "./templates";

const profile = {
  ...emptyProfile("Alok Upadhyay", "alok@example.com"),
  headline: "Full Stack Developer",
  pitch: "I have 4+ years of experience building full-stack web applications.",
  portfolioUrl: "https://aalok.dev",
  githubUrl: "https://github.com/alokera",
  signature: "Best regards,\n**Alok Upadhyay**",
};

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
  it("produce the standard format: intro, pitch, bold links, signature", () => {
    const values = templateValues(profile, { company: "Acme", role: "Frontend Engineer" });
    expect(fillTemplate(DEFAULT_TEMPLATES[0].subject, values)).toBe("Application – Frontend Engineer – Alok Upadhyay");
    expect(fillTemplate(DEFAULT_TEMPLATES[0].body, values)).toBe(
      [
        "Hi,",
        "",
        "I'm Alok Upadhyay, and I'd like to apply for the Frontend Engineer role at Acme.",
        "",
        "I have 4+ years of experience building full-stack web applications.",
        "",
        "I've attached my resume for your consideration. You can explore my work here:",
        "",
        "**Portfolio:** https://aalok.dev",
        "**GitHub:** https://github.com/alokera",
        "",
        "I'd welcome the opportunity to discuss how my experience and skills could contribute to your team. Thank you for your time and consideration.",
        "",
        "Best regards,",
        "**Alok Upadhyay**",
      ].join("\n"),
    );
  });

  it("use the headline as the role and 'your company' when they aren't given", () => {
    const body = fillTemplate(DEFAULT_TEMPLATES[0].body, templateValues(profile));
    expect(body).toContain("apply for the Full Stack Developer role at your company.");
  });

  it("read naturally even with an almost empty profile", () => {
    const values = templateValues(emptyProfile("Alok Upadhyay", "a@x.com"));
    for (const template of DEFAULT_TEMPLATES) {
      const body = fillTemplate(template.body, values);
      expect(body).not.toMatch(/\{\{|the\s+role|\bat\s*\./);
      expect(fillTemplate(template.subject, values)).not.toMatch(/\{\{|–\s*–/);
    }
    // Without a pitch, the standard template leaves a clear note to personalise.
    expect(fillTemplate(DEFAULT_TEMPLATES[0].body, values)).toMatch(/\[Add 2–3 lines/);
  });
});

describe("findPlaceholders", () => {
  it("finds unfinished bracketed notes but not short brackets", () => {
    expect(findPlaceholders("Hi\n[Add 1–2 lines on why you fit]\nSee [1]")).toEqual(["[Add 1–2 lines on why you fit]"]);
    expect(findPlaceholders("All done")).toEqual([]);
  });
});
