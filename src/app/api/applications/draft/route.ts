import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient, GMAIL_COMPOSE_SCOPE, hasScope } from "@/lib/google";
import { createDraft } from "@/lib/mailbox";
import { buildRawMessage, OutgoingSchema } from "@/lib/outgoing";

/** Saves an application as a Gmail draft (threaded when it replies to a job email). */
export async function POST(request: Request) {
  const parsed = OutgoingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  try {
    const { client, session } = await getAuthorizedClient();
    if (!hasScope(session, GMAIL_COMPOSE_SCOPE)) {
      return Response.json({ error: "InboxAgenda needs permission to create drafts and send email.", needsPermission: true }, { status: 403 });
    }
    const { raw, threadId } = await buildRawMessage(client, session, parsed.data);
    return Response.json({ ok: true, ...(await createDraft(client, raw, threadId)) });
  } catch (error) {
    return errorResponse(error, "Couldn't create the Gmail draft.");
  }
}
