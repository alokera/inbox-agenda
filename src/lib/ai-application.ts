import "server-only";
import { buildApplicationPrompt, buildColdMessage, buildJobEmailMessage, parseApplication, type ColdApplicationDetails } from "./application";
import { getLLMClient, LLM_MODEL } from "./llm";
import type { EmailCandidate, JobAnalysis, JobProfile, ResumeSummary } from "./types";

/** Reply to a job email. */
export function draftApplication(email: EmailCandidate, profile: JobProfile, resumes: ResumeSummary[]): Promise<JobAnalysis> {
  return complete(buildApplicationPrompt(profile, resumes, "reply"), buildJobEmailMessage(email), resumes);
}

/** A first email when all you have is an address (plus optional company, role, job description). */
export function draftColdApplication(details: ColdApplicationDetails, profile: JobProfile, resumes: ResumeSummary[]): Promise<JobAnalysis> {
  return complete(buildApplicationPrompt(profile, resumes, "cold"), buildColdMessage(details), resumes);
}

async function complete(system: string, user: string, resumes: ResumeSummary[]): Promise<JobAnalysis> {
  const completion = await getLLMClient().chat.completions.create({
    model: LLM_MODEL,
    temperature: 0.4, // a little variety, so "Regenerate" gives a different draft
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const analysis = parseApplication(completion.choices[0]?.message?.content ?? "", resumes.map((r) => r.id));
  if (!analysis) throw new Error("The AI returned an unusable draft. Please try again.");
  return analysis;
}
