import "server-only";
import { buildApplicationPrompt, buildJobEmailMessage, parseApplication } from "./application";
import { getLLMClient, LLM_MODEL } from "./llm";
import type { EmailCandidate, JobAnalysis, JobProfile, ResumeSummary } from "./types";

export async function draftApplication(email: EmailCandidate, profile: JobProfile, resumes: ResumeSummary[]): Promise<JobAnalysis> {
  const completion = await getLLMClient().chat.completions.create({
    model: LLM_MODEL,
    temperature: 0.4, // a little variety, so "Regenerate" gives a different draft
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildApplicationPrompt(profile, resumes) },
      { role: "user", content: buildJobEmailMessage(email) },
    ],
  });
  const analysis = parseApplication(completion.choices[0]?.message?.content ?? "", resumes.map((r) => r.id));
  if (!analysis) throw new Error("The AI returned an unusable draft. Please try again.");
  return analysis;
}
