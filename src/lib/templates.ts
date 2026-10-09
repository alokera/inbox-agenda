import type { JobProfile } from "./types";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

/** Fill-ins a template can use. `{{name|fallback}}` uses the fallback when the value is empty. */
export const TEMPLATE_VARIABLES = ["name", "headline", "email", "phone", "location", "company", "role", "portfolio", "github", "linkedin", "links", "signature"] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "standard",
    name: "Standard application",
    subject: "Application – {{role|Developer role}} – {{name}}",
    body: `Hi,

I'm {{name}}, {{headline|a software developer}}, and I'd like to apply for {{role|a developer role}} at {{company|your company}}.

[Add 1–2 lines on why you're a good fit, e.g. a project or skill that matches the role.]

I've attached my resume. You can see my work here:
{{links}}

I'd welcome the chance to talk. Thank you for your time.

{{signature}}`,
  },
  {
    id: "short",
    name: "Short & direct",
    subject: "{{role|Job application}} – {{name}}",
    body: `Hi,

I'm interested in {{role|opportunities}} at {{company|your company}}. I'm {{headline|a software developer}}, and my resume is attached.

{{links}}

Happy to share more or jump on a call.

{{signature}}`,
  },
  {
    id: "fresher",
    name: "Fresher / internship",
    subject: "Application for {{role|internship / entry-level role}} – {{name}}",
    body: `Dear Hiring Team,

I'm {{name}}, {{headline|an aspiring software developer}}, and I'm excited to apply for {{role|an internship or entry-level role}} at {{company|your company}}.

[Mention your degree or a project you built, and what you'd like to learn.]

My resume is attached, and here are my projects:
{{links}}

I'm a quick learner and would love the opportunity to contribute. Thank you for considering my application.

{{signature}}`,
  },
  {
    id: "follow-up",
    name: "Follow-up",
    subject: "Following up – {{role|my application}} – {{name}}",
    body: `Hi,

I recently applied for {{role|a role}} at {{company|your company}} and wanted to follow up. I'm still very interested and would be glad to share anything else you need.

For reference, my resume is attached again, along with my work:
{{links}}

Thank you for your time.

{{signature}}`,
  },
];

export interface TemplateContext {
  company?: string;
  role?: string;
}

export function templateValues(profile: JobProfile, context: TemplateContext = {}): Record<TemplateVariable, string> {
  const links = [
    profile.portfolioUrl && `Portfolio: ${profile.portfolioUrl}`,
    profile.githubUrl && `GitHub: ${profile.githubUrl}`,
    profile.linkedinUrl && `LinkedIn: ${profile.linkedinUrl}`,
    profile.otherUrl && `More: ${profile.otherUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    name: profile.fullName.trim(),
    headline: profile.headline.trim(),
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    location: profile.location.trim(),
    company: context.company?.trim() ?? "",
    role: context.role?.trim() ?? "",
    portfolio: profile.portfolioUrl.trim(),
    github: profile.githubUrl.trim(),
    linkedin: profile.linkedinUrl.trim(),
    links,
    signature: (profile.signature || profile.fullName).trim(),
  };
}

const VARIABLE = /\{\{\s*([a-z]+)\s*(?:\|([^}]*))?\}\}/gi;

/**
 * Fills `{{variable}}` / `{{variable|fallback}}` placeholders.
 * A line containing an empty variable with no fallback is removed entirely
 * ("Phone: {{phone}}" disappears when there's no phone), then extra blank lines collapse.
 * Unknown variables are left as-is, so typos stay visible.
 */
export function fillTemplate(text: string, values: Record<string, string>): string {
  const lines = text.split("\n").flatMap((line) => {
    let dropLine = false;
    const filled = line.replace(VARIABLE, (match, rawName: string, fallback?: string) => {
      const name = rawName.toLowerCase();
      if (!(name in values)) return match;
      const value = values[name];
      if (value) return value;
      if (fallback !== undefined) return fallback.trim();
      dropLine = true;
      return "";
    });
    return dropLine ? [] : [filled];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Bracketed notes like "[Add 1–2 lines …]" left in a message, so the user doesn't send an unfinished template. */
export function findPlaceholders(text: string): string[] {
  return [...text.matchAll(/\[[^\]\n]{8,}\]/g)].map((m) => m[0]);
}
