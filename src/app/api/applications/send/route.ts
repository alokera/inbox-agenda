import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient, GMAIL_COMPOSE_SCOPE, hasScope } from "@/lib/google";
import { sendMessage } from "@/lib/mailbox";
import { buildRawMessage, OutgoingSchema } from "@/lib/outgoing";

/** Sends an application right away. The UI only calls this after the user confirms. */
export async function POST(request: Request) {
  const parsed = OutgoingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  try {
    const { client, session } = await getAuthorizedClient();
    if (!hasScope(session, GMAIL_COMPOSE_SCOPE)) {
      return Response.json({ error: "InboxAgenda needs permission to send email.", needsPermission: true }, { status: 403 });
    }
    const { raw, threadId } = await buildRawMessage(client, session, parsed.data);
    return Response.json({ ok: true, ...(await sendMessage(client, raw, threadId)) });
  } catch (error) {
    return errorResponse(error, "Couldn't send the email.");
  }
}
