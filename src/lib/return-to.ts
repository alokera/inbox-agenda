/**
 * Accepts only same-site paths like "/inbox?id=abc" for post-login redirects.
 * Rejects "//evil.com", "/\evil.com" (browsers treat \ as /) and absolute URLs,
 * which would otherwise make sign-in an open redirect.
 */
export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || value.length > 500) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (/[\r\n\t]/.test(value)) return undefined;
  return value;
}
