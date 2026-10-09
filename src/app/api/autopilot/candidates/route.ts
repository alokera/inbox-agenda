import { z } from "zod";
import { errorResponse } from "@/lib/api-errors";
import { buildRecruiterQuery } from "@/lib/autopilot";
import { getAuthorizedClient } from "@/lib/google";
import { listMessageSummaries } from "@/lib/mailbox";

const BodySchema = z.object({
  days: z.number().int().min(1).max(30).catch(14),
  processedIds: z.array(z.string().regex(/^[a-zA-Z0-9]+$/)).max(5000).catch([]),
});

const MAX_CANDIDATES = 25;

/** Recruiter/job emails Autopilot hasn't looked at yet. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { days, processedIds } = parsed.data;
  try {
    const { client } = await getAuthorizedClient();
    return Response.json({ candidates: await listMessageSummaries(client, buildRecruiterQuery(days), new Set(processedIds), MAX_CANDIDATES) });
  } catch (error) {
    return errorResponse(error, "Couldn't search for job emails.");
  }
}
