/**
 * Emails are written in a tiny markdown subset:
 *   **bold**   [label](https://… | mailto:…)   bare https:// URLs
 * and sent as both HTML (so Gmail shows bold labels and links) and plain text.
 * HTML is escaped first, so nothing the user (or the AI) types can inject markup.
 */

const BOLD = /\*\*([^*\n]+?)\*\*/g;
const LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g;
const BARE_URL = /https?:\/\/[^\s<>"'()[\]]+[^\s<>"'()[\].,;:!?]/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Plain-text version: no asterisks; links become "label (url)" unless the label already is the address. */
export function toPlainText(text: string): string {
  return text
    .replace(LINK, (_m, label: string, url: string) => {
      const address = url.replace(/^mailto:/i, "");
      return label === url || label === address ? label : `${label} (${address})`;
    })
    .replace(BOLD, "$1");
}

/** HTML version for the email's text/html part (and the in-app preview). */
export function toHtml(text: string): string {
  // Pull out explicit links first so the bare-URL pass doesn't double-link them.
  const links: string[] = [];
  const withTokens = text.replace(LINK, (_m, label: string, url: string) => {
    links.push(`<a href="${escapeHtml(url)}">${escapeHtml(label).replace(BOLD, "<strong>$1</strong>")}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });

  const html = escapeHtml(withTokens)
    .replace(BARE_URL, (url) => `<a href="${url}">${url}</a>`)
    .replace(BOLD, "<strong>$1</strong>")
    .replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)])
    .replace(/\r?\n/g, "<br>\n");

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">\n${html}\n</div>`;
}
