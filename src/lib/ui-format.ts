/** Gmail-style list dates: "4:31 PM" today, "Oct 3" this year, "10/3/24" before that. */
export function formatListDate(iso: string, now: Date): string {
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: "short", day: "numeric" });
  return date.toLocaleDateString([], { day: "numeric", month: "numeric", year: "2-digit" });
}

/** "Thu, Oct 9, 2026, 4:31 PM (2 hours ago)", like Gmail's message header. */
export function formatReaderDate(iso: string, now: Date): string {
  const date = new Date(iso);
  const absolute = date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const relative = timeAgo(date, now);
  return relative ? `${absolute} (${relative})` : absolute;
}

/** Relative time for the last month ("just now", "5 minutes ago", "3 days ago"), else empty. */
export function timeAgo(date: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return "";
  if (seconds < 60) return "just now";
  const plural = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"} ago`;
  if (seconds < 3600) return plural(Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return plural(Math.floor(seconds / 3600), "hour");
  const days = Math.floor(seconds / 86_400);
  return days <= 30 ? plural(days, "day") : "";
}

/** Splits a raw address header on commas that aren't inside quoted names. */
function splitAddresses(raw: string): string[] {
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function shortName(address: string): string {
  const named = address.match(/^"?([^"<]+?)"?\s*</);
  return named ? named[1].trim() : address.replace(/[<>]/g, "").split("@")[0];
}

/** Display names for an address list: `"Asha" <a@x.com>, b@y.com` → "Asha, b". */
export function shortNames(raw: string): string {
  return splitAddresses(raw).map(shortName).join(", ");
}

/** Gmail's "to me, Asha": the signed-in user's address becomes "me", listed first. */
export function recipientsLabel(raw: string, myEmail: string): string {
  const parts = splitAddresses(raw);
  const isMe = (part: string) => part.toLowerCase().includes(myEmail.toLowerCase());
  return [...(parts.some(isMe) ? ["me"] : []), ...parts.filter((p) => !isMe(p)).map(shortName)].join(", ");
}

/** Up to two initials for an avatar. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

/** Same sender → same color, every time. */
export function avatarColor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export type TextSegment = { type: "text" | "link"; value: string };

/** Splits plain text into text and http(s) link segments, so links can be rendered as anchors without HTML injection. */
export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = /https?:\/\/[^\s<>"'()[\]]+[^\s<>"'()[\].,;:!?]/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ type: "text", value: text.slice(last, match.index) });
    segments.push({ type: "link", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

/** "Re: <subject>" for replies, without doubling an existing "Re:". */
export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
