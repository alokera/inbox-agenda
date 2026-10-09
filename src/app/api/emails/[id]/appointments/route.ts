import { extractAppointments } from "@/lib/ai-extract";
import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { getEmail, toCandidate } from "@/lib/mailbox";
import { isValidTimezone } from "@/lib/timezone";

/** Runs the AI extractor on a single email ("Find appointments" in the reader). */
export async function POST(request: Request, ctx: RouteContext<"/api/emails/[id]/appointments">) {
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9]+$/.test(id)) return Response.json({ error: "Invalid email id" }, { status: 400 });
  if (!isLLMConfigured()) return Response.json({ error: "XAI_API_KEY is not configured on the server." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const timezone = isValidTimezone(body.timezone) ? (body.timezone as string) : "UTC";
  try {
    const { client } = await getAuthorizedClient();
    const email = await getEmail(client, id);
    const items = await extractAppointments(toCandidate(email), timezone);
    // Not compared against the calendar here, so don't claim anything is missing from it.
    return Response.json({ items: items.map((item) => ({ ...item, missingFromCalendar: false })) });
  } catch (error) {
    return errorResponse(error, "Couldn't analyse this email.");
  }
}
