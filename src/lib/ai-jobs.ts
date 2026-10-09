import "server-only";
import { buildScoringInput, buildScoringPrompt, EXTRACT_PROMPT, numberLinks, parseExtractedJobs, parseScores } from "./job-feed";
import { getLLMClient, LLM_FAST_MODEL } from "./llm";
import type { AlertEmail } from "./mailbox";
import type { FoundJob, JobPreferences, JobProfile, JobScore } from "./types";

async function completeJson(system: string, user: string): Promise<string> {
  const completion = await getLLMClient().chat.completions.create({
    model: LLM_FAST_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Jobs listed in one alert email, or null if the AI call failed (so the email can be
 * retried on the next scan instead of being marked as processed).
 */
export async function extractJobs(email: AlertEmail): Promise<FoundJob[] | null> {
  const numbered = numberLinks(email.html, email.plain);
  if (!numbered.text) return [];
  try {
    const raw = await completeJson(EXTRACT_PROMPT, `From: ${email.from}\nSubject: ${email.subject}\n<email>\n${numbered.text}\n</email>`);
    return parseExtractedJobs(raw, numbered, { emailId: email.id, from: email.from });
  } catch (error) {
    console.error(`Job extraction failed for ${email.id}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Scores a batch of jobs; jobs the model skipped simply have no score. */
export async function scoreJobs(jobs: FoundJob[], profile: JobProfile, prefs: JobPreferences): Promise<Map<string, JobScore>> {
  try {
    const raw = await completeJson(buildScoringPrompt(profile, prefs), buildScoringInput(jobs));
    return parseScores(raw, jobs.map((j) => j.key));
  } catch (error) {
    console.error("Job scoring failed:", error instanceof Error ? error.message : error);
    return new Map();
  }
}
