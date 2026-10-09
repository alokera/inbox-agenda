import "server-only";
import type { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { getReplyContext } from "./mailbox";
import { buildMime, encodeHeaderText, toBase64Url } from "./mime";
import { toHtml, toPlainText } from "./rich-text";
import type { Session } from "./session";

// ~3 MB file → ~4 MB base64, under typical serverless request limits (Vercel: 4.5 MB).
const MAX_ATTACHMENT_BASE64 = 4_200_000;

/** An application email from the browser: a reply to a job email (emailId) or a brand-new email. */
export const OutgoingSchema = z.object({
  emailId: z.string().regex(/^[a-zA-Z0-9]+$/).optional(),
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

export type Outgoing = z.infer<typeof OutgoingSchema>;

/** Builds the raw MIME message; replies get threading headers and the original thread id. */
export async function buildRawMessage(client: OAuth2Client, session: Session, input: Outgoing): Promise<{ raw: string; threadId?: string }> {
  const reply = input.emailId ? await getReplyContext(client, input.emailId) : null;
  const from = input.fromName ? `${encodeHeaderText(input.fromName.replace(/["\\<>]/g, ""))} <${session.user.email}>` : session.user.email;
  const mime = buildMime({
    from,
    to: input.to,
    subject: input.subject,
    // The editor's light formatting (**bold**, links) goes out as HTML, with a plain-text fallback.
    body: toPlainText(input.body),
    html: toHtml(input.body),
    inReplyTo: reply?.messageId,
    references: reply?.references,
    attachment: input.attachment ? { filename: input.attachment.filename, mimeType: "application/pdf", base64: input.attachment.base64 } : null,
  });
  return { raw: toBase64Url(mime), threadId: reply?.threadId };
}
