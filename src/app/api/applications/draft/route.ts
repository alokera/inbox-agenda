import { z } from "zod";
import { errorResponse } from "@/lib/api-errors";
import { getAuthorizedClient, GMAIL_COMPOSE_SCOPE, hasScope } from "@/lib/google";
import { createDraft, getReplyContext } from "@/lib/mailbox";
import { buildMime, encodeHeaderText, toBase64Url } from "@/lib/mime";

// ~3 MB file → ~4 MB base64, under typical serverless request limits (Vercel: 4.5 MB).
const MAX_ATTACHMENT_BASE64 = 4_200_000;

const BodySchema = z.object({
  emailId: z.string().regex(/^[a-zA-Z0-9]+$/),
  to: z.string().trim().regex(/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/, "Enter a valid recipient email"),
  subject: z.string().trim().min(1, "Add a subject").max(200),
  body: z.string().trim().min(1, "The email is empty").max(10_000),
  fromName: z.string().trim().max(120).optional(),
  attachment: z
    .object({
      filename: z.string().min(1).max(200),
      base64: z.string().max(MAX_ATTACHMENT_BASE64, "Resume is too large (max ~3 MB)").regex(/^[A-Za-z0-9+/=\s]+$/, "Invalid attachment"),
    })
    .nullish(),
});

/**
 * Creates a Gmail draft replying in the job email's thread, with the resume attached.
 * It never sends: the user reviews the draft and presses Send in Gmail.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { emailId, to, subject, body, fromName, attachment } = parsed.data;

  try {
    const { client, session } = await getAuthorizedClient();
    if (!hasScope(session, GMAIL_COMPOSE_SCOPE)) {
      return Response.json({ error: "InboxAgenda needs permission to create drafts.", needsPermission: true }, { status: 403 });
    }

    const reply = await getReplyContext(client, emailId);
    const mime = buildMime({
      from: fromName ? `${encodeHeaderText(fromName.replace(/["\\<>]/g, ""))} <${session.user.email}>` : session.user.email,
      to,
      subject,
      body,
      inReplyTo: reply.messageId,
      references: reply.references,
      attachment: attachment ? { filename: attachment.filename, mimeType: "application/pdf", base64: attachment.base64 } : null,
    });
    const draft = await createDraft(client, toBase64Url(mime), reply.threadId);
    return Response.json({ ok: true, ...draft });
  } catch (error) {
    return errorResponse(error, "Couldn't create the Gmail draft.");
  }
}
