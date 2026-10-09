/**
 * Builds RFC 5322 / MIME messages for the Gmail API (`raw` must be base64url).
 * Header values come partly from the browser, so CR/LF are stripped to prevent
 * header injection (e.g. a subject that smuggles in a Bcc: line).
 */

export interface Attachment {
  filename: string;
  mimeType: string;
  /** Standard base64 (not base64url). */
  base64: string;
}

export interface MimeMessage {
  from?: string;
  to: string;
  subject: string;
  /** Plain-text body (always sent, for mail apps that don't show HTML). */
  body: string;
  /** Optional HTML version of the same body; sent as multipart/alternative. */
  html?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  attachment?: Attachment | null;
}

/** Removes characters that would break out of a header line. */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded-word for non-ASCII header text, e.g. names or subjects with "–" or accents. */
export function encodeHeaderText(value: string): string {
  const clean = sanitizeHeader(value);
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

/** Keeps filenames ASCII and quote-safe for the Content-Disposition header. */
export function safeFilename(name: string): string {
  const cleaned = sanitizeHeader(name).replace(/[^\w.\- ]+/g, "_").replace(/_+/g, "_").slice(0, 100);
  return cleaned || "attachment";
}

/** Base64 wrapped at 76 characters, as MIME requires. */
function wrap76(base64: string): string {
  return base64.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
}

export function buildMime(message: MimeMessage, boundary = `ia_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`): string {
  const headers = [
    ...(message.from ? [`From: ${sanitizeHeader(message.from)}`] : []),
    `To: ${sanitizeHeader(message.to)}`,
    `Subject: ${encodeHeaderText(message.subject)}`,
    ...(message.inReplyTo ? [`In-Reply-To: ${sanitizeHeader(message.inReplyTo)}`] : []),
    ...(message.inReplyTo || message.references
      ? [`References: ${sanitizeHeader([message.references, message.inReplyTo].filter(Boolean).join(" "))}`]
      : []),
    "MIME-Version: 1.0",
  ];

  const textPart = base64Part("text/plain; charset=UTF-8", message.body.replace(/\r?\n/g, "\r\n"));
  // With HTML, the readable body is a multipart/alternative: mail apps show the richest version they support.
  const bodyPart = message.html
    ? multipart("alternative", `${boundary}_alt`, [textPart, base64Part("text/html; charset=UTF-8", message.html)])
    : textPart;

  if (!message.attachment) return [...headers, bodyPart].join("\r\n");

  const filename = safeFilename(message.attachment.filename);
  const attachmentPart = [
    `Content-Type: ${sanitizeHeader(message.attachment.mimeType)}; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(message.attachment.base64.replace(/\s+/g, "")),
  ].join("\r\n");

  return [...headers, multipart("mixed", boundary, [bodyPart, attachmentPart]), ""].join("\r\n");
}

function base64Part(contentType: string, content: string): string {
  return [`Content-Type: ${contentType}`, "Content-Transfer-Encoding: base64", "", wrap76(Buffer.from(content, "utf8").toString("base64"))].join("\r\n");
}

/** A multipart entity: its own Content-Type header, then each part between boundaries. */
function multipart(subtype: "mixed" | "alternative", boundary: string, parts: string[]): string {
  return [`Content-Type: multipart/${subtype}; boundary="${boundary}"`, "", ...parts.flatMap((part) => [`--${boundary}`, part]), `--${boundary}--`].join("\r\n");
}

export function toBase64Url(mime: string): string {
  return Buffer.from(mime, "utf8").toString("base64url");
}
