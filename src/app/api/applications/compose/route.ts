import { z } from "zod";
import { draftColdApplication } from "@/lib/ai-application";
import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { ProfileSchema, ResumeSummarySchema } from "@/lib/profile-schema";

const BodySchema = z.object({
  to: z.string().trim().regex(/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/, "Enter a valid recipient email"),
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(160).optional(),
  jobDescription: z.string().trim().max(8000).optional(),
  profile: ProfileSchema,
  resumes: z.array(ResumeSummarySchema).max(10),
});

/** Writes a first application email from just a recipient address (and optional details). Nothing is sent. */
export async function POST(request: Request) {
  if (!isLLMConfigured()) return Response.json({ error: "XAI_API_KEY is not configured on the server." }, { status: 500 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { profile, resumes, ...details } = parsed.data;

  try {
    await getAuthorizedClient(); // signed-in users only (this spends AI credits)
    return Response.json({ analysis: await draftColdApplication(details, profile, resumes) });
  } catch (error) {
    return errorResponse(error, "Couldn't write the application.");
  }
}
