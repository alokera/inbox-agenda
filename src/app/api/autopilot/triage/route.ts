import { z } from "zod";
import { triageEmail } from "@/lib/ai-jobs";
import { errorResponse } from "@/lib/api-errors";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getAuthorizedClient } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { getEmail, getReplyContext, threadActivity, toCandidate } from "@/lib/mailbox";
import { PreferencesSchema, ProfileSchema } from "@/lib/profile-schema";

export const maxDuration = 60;

const BodySchema = z.object({
  emailIds: z.array(z.string().regex(/^[a-zA-Z0-9]+$/)).min(1).max(10),
  profile: ProfileSchema,
  preferences: PreferencesSchema,
});

/**
 * Quick AI check per email (cheap model): is it a job, can you apply by email, and how
 * well does it fit? Also reports whether you've already replied in that thread.
 */
export async function POST(request: Request) {
  if (!isLLMConfigured()) return Response.json({ error: "XAI_API_KEY is not configured on the server." }, { status: 500 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { emailIds, profile, preferences } = parsed.data;

  try {
    const { client, session } = await getAuthorizedClient();
    const results = await mapWithConcurrency(emailIds, 4, async (emailId) => {
      try {
        const [email, reply] = await Promise.all([getEmail(client, emailId), getReplyContext(client, emailId)]);
        const [triage, activity] = await Promise.all([
          triageEmail(toCandidate(email), profile, preferences),
          threadActivity(client, reply.threadId, session.user.email, Date.parse(email.date)),
        ]);
        return { emailId, ok: triage !== null, triage, alreadyRepliedInThread: activity.fromMe, replyTo: reply.replyTo, subject: reply.subject };
      } catch (error) {
        console.error(`Triage of ${emailId} failed:`, error instanceof Error ? error.message : error);
        return { emailId, ok: false, triage: null, alreadyRepliedInThread: false, replyTo: "", subject: "" };
      }
    });
    return Response.json({ results });
  } catch (error) {
    return errorResponse(error, "Couldn't check these emails.");
  }
}
