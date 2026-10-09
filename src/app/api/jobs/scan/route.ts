import { z } from "zod";
import { extractJobs, scoreJobs } from "@/lib/ai-jobs";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getAuthorizedClient, NotSignedInError } from "@/lib/google";
import { buildAlertQuery, isSkipped } from "@/lib/job-feed";
import { isLLMConfigured } from "@/lib/llm";
import { findAlertEmails } from "@/lib/mailbox";
import { PreferencesSchema, ProfileSchema } from "@/lib/profile-schema";
import type { FoundJob, JobScanEvent, ScoredJob } from "@/lib/types";

export const maxDuration = 120;

const MAX_ALERT_EMAILS = 15;
const MAX_JOBS_TO_SCORE = 120;
const SCORE_BATCH = 12;

const BodySchema = z.object({
  days: z.union([z.literal(3), z.literal(7), z.literal(14), z.literal(30)]).catch(7),
  profile: ProfileSchema,
  preferences: PreferencesSchema,
  /** Alert emails already processed in earlier scans (kept in the browser). */
  processedEmailIds: z.array(z.string().regex(/^[a-zA-Z0-9]+$/)).max(2000).catch([]),
  /** Jobs already in the feed: not re-scored. */
  knownJobKeys: z.array(z.string().max(300)).max(5000).catch([]),
});

/**
 * Finds job-alert emails (LinkedIn, Indeed, Naukri…), extracts each job with AI,
 * removes duplicates and skipped ones, and scores the rest against the profile.
 * Streams progress as newline-delimited JSON. Nothing is stored server-side.
 */
export async function POST(request: Request) {
  if (!isLLMConfigured()) return Response.json({ error: "XAI_API_KEY is not configured on the server." }, { status: 500 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { days, profile, preferences, processedEmailIds, knownJobKeys } = parsed.data;

  let auth;
  try {
    auth = await getAuthorizedClient(); // before streaming: may refresh the token cookie
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Not signed in", signInAgain: error instanceof NotSignedInError }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: JobScanEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "status", message: `Looking for job alerts from the last ${days} days…` });
        const emails = await findAlertEmails(auth.client, buildAlertQuery(days), new Set(processedEmailIds), MAX_ALERT_EMAILS);

        send({ type: "status", message: emails.length ? `Reading ${emails.length} job-alert emails…` : "No new job-alert emails." });
        let read = 0;
        const perEmail = await mapWithConcurrency(emails, 5, async (email) => {
          const jobs = await extractJobs(email);
          send({ type: "progress", done: ++read, total: emails.length });
          return { email, jobs };
        });
        const succeeded = perEmail.filter((r) => r.jobs !== null);

        // De-duplicate (the same job appears in several alerts), then apply the skip lists.
        const unique = new Map<string, FoundJob>();
        for (const job of succeeded.flatMap((r) => r.jobs!)) if (!unique.has(job.key)) unique.set(job.key, job);
        const all = [...unique.values()];
        const kept = all.filter((job) => !isSkipped(job, preferences));
        const known = new Set(knownJobKeys);
        const toScore = kept.filter((job) => !known.has(job.key)).slice(0, MAX_JOBS_TO_SCORE);

        const batches: FoundJob[][] = [];
        for (let i = 0; i < toScore.length; i += SCORE_BATCH) batches.push(toScore.slice(i, i + SCORE_BATCH));
        if (batches.length) send({ type: "status", message: `Scoring ${toScore.length} new jobs against your profile…` });
        let scoredBatches = 0;
        const scoreMaps = await mapWithConcurrency(batches, 3, async (batch) => {
          const scores = await scoreJobs(batch, profile, preferences);
          send({ type: "progress", done: ++scoredBatches, total: batches.length });
          return scores;
        });
        const scores = new Map(scoreMaps.flatMap((m) => [...m]));

        const jobs: ScoredJob[] = toScore.map((job) => ({ ...job, ...scores.get(job.key) }));
        send({
          type: "result",
          jobs,
          processedEmailIds: succeeded.map((r) => r.email.id), // failed ones are retried next scan
          stats: { alertEmails: emails.length, jobsFound: all.length, skipped: all.length - kept.length, scored: scores.size },
        });
      } catch (error) {
        console.error("Job scan failed:", error);
        const code = (error as { code?: number })?.code;
        const denied = code === 401 || code === 403;
        send({ type: "error", message: denied ? "Google denied access. Please sign in again." : "The job scan failed. Please try again.", signInAgain: denied });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
}
