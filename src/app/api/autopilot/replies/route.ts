import { z } from "zod";
import { errorResponse } from "@/lib/api-errors";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getAuthorizedClient } from "@/lib/google";
import { threadActivity } from "@/lib/mailbox";

const BodySchema = z.object({
  threads: z.array(z.object({ threadId: z.string().regex(/^[a-zA-Z0-9]+$/), sentAt: z.number() })).max(100),
});

/** Which of your sent applications got a reply from someone else. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { client, session } = await getAuthorizedClient();
    const replies = await mapWithConcurrency(parsed.data.threads, 6, async ({ threadId, sentAt }) => {
      const activity = await threadActivity(client, threadId, session.user.email, sentAt).catch(() => null);
      return activity?.fromOthers ? { threadId, ...activity.fromOthers } : null;
    });
    return Response.json({ replies: replies.filter(Boolean) });
  } catch (error) {
    return errorResponse(error, "Couldn't check for replies.");
  }
}
