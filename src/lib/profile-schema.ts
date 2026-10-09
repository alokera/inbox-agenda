import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).catch("");
const url = z
  .string()
  .trim()
  .max(300)
  .catch("")
  .transform((s) => (/^https?:\/\/\S+$/i.test(s) ? s : ""));

/** Server-side bounds for the profile the browser sends (it's user input). */
export const ProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Add your name in Job profile").max(120),
  email: text(200),
  phone: text(40),
  location: text(120),
  headline: text(160),
  portfolioUrl: url,
  githubUrl: url,
  linkedinUrl: url,
  otherUrl: url,
  summary: text(4000),
  pitch: text(1500),
  signature: text(600),
  tone: z.enum(["professional", "friendly"]).catch("professional"),
});

export const ResumeSummarySchema = z.object({
  id: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  excerpt: z.string().max(2500),
});

export const PreferencesSchema = z.object({
  roles: text(300),
  locations: text(300),
  remoteOk: z.boolean().catch(true),
  experienceYears: text(40),
  minSalary: text(60),
  skipKeywords: text(500),
  skipCompanies: text(500),
});
