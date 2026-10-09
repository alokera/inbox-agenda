/** Minimal shape of a Gmail API message part (gmail_v1.Schema$MessagePart). */
export interface MessagePart {
  mimeType?: string | null;
  filename?: string | null;
  headers?: { name?: string | null; value?: string | null }[] | null;
  body?: { data?: string | null } | null;
  parts?: MessagePart[] | null;
}

export const MAX_EMAIL_CHARS = 6000;

export function getHeader(part: MessagePart, name: string): string {
  const header = part.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

/** Gmail encodes bodies as base64url. */
export function decodeBody(data: string | null | undefined): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * Extracts readable text from a (possibly nested multipart) email.
 * Prefers text/plain; falls back to text/html converted to text.
 */
export function extractEmailText(payload: MessagePart, maxChars = MAX_EMAIL_CHARS): string {
  const plain: string[] = [];
  const html: string[] = [];

  const walk = (part: MessagePart) => {
    if (part.filename) return; // skip attachments
    if (part.mimeType === "text/plain") plain.push(decodeBody(part.body?.data));
    else if (part.mimeType === "text/html") html.push(decodeBody(part.body?.data));
    part.parts?.forEach(walk);
  };
  walk(payload);

  const text = plain.join("\n").trim() || htmlToText(html.join("\n"));
  return truncate(normalizeWhitespace(text), maxChars);
}

/** The raw HTML and plain-text bodies (no conversion), e.g. to keep links from job-alert emails. */
export function extractRawBodies(payload: MessagePart): { html: string; plain: string } {
  const html: string[] = [];
  const plain: string[] = [];
  const walk = (part: MessagePart) => {
    if (part.filename) return;
    if (part.mimeType === "text/html") html.push(decodeBody(part.body?.data));
    else if (part.mimeType === "text/plain") plain.push(decodeBody(part.body?.data));
    part.parts?.forEach(walk);
  };
  walk(payload);
  return { html: html.join("\n"), plain: plain.join("\n") };
}

/** File names of attachments anywhere in the message. */
export function listAttachments(payload: MessagePart): string[] {
  const names: string[] = [];
  const walk = (part: MessagePart) => {
    if (part.filename) names.push(part.filename);
    part.parts?.forEach(walk);
  };
  walk(payload);
  return names;
}

/** Parses `"Asha Rao" <asha@example.com>` (or a bare address) into name and email. */
export function parseAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const email = match[2].trim();
    return { name: match[1].trim() || email, email };
  }
  const email = raw.trim();
  return { name: email.split("@")[0] || email, email };
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      // Keep link targets: meeting links often only exist in an href.
      .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) =>
        href.startsWith("http") ? `${label} (${href})` : label,
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

export function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
