import { z } from "zod";
import { draftApplication } from "@/lib/ai-application";
import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { getEmail, getReplyContext, toCandidate } from "@/lib/mailbox";
import { ProfileSchema, ResumeSummarySchema } from "@/lib/profile-schema";

const BodySchema = z.object({
  emailId: z.string().regex(/^[a-zA-Z0-9]+$/),
  profile: ProfileSchema,
  resumes: z.array(ResumeSummarySchema).max(10),
});

/** Analyses a job email and writes a tailored application draft (nothing is saved or sent). */
export async function POST(request: Request) {
  if (!isLLMConfigured()) return Response.json({ error: "XAI_API_KEY is not configured on the server." }, { status: 500 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { emailId, profile, resumes } = parsed.data;

  try {
    const { client } = await getAuthorizedClient();
    const [email, reply] = await Promise.all([getEmail(client, emailId), getReplyContext(client, emailId)]);
    const analysis = await draftApplication(toCandidate(email), profile, resumes);
    return Response.json({ analysis, replyTo: reply.replyTo, originalSubject: reply.subject });
  } catch (error) {
    return errorResponse(error, "Couldn't draft the application.");
  }
}
