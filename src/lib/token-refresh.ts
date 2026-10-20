export interface RefreshResult {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** The resolved refresh token: Google's rotated one, or the old one if it didn't rotate. */
  refreshToken: string;
}

/**
 * In-flight (and briefly cached) refreshes, keyed by the refresh token that started them.
 *
 * On page load several API routes call getAuthorizedClient at once. When the access token is
 * within the refresh margin, each would otherwise hit Google's token endpoint with the same
 * refresh token. Google *sometimes rotates* refresh tokens, so the first exchange invalidates
 * the token the others are still holding, and those lose with `invalid_grant` — surfacing as a
 * spurious 401 that signs the user out. Sharing one refresh per token avoids the race, and all
 * callers end up writing the same new tokens to the session cookie, so the cookie write is
 * idempotent rather than a last-writer-wins stomp. Cache lives only within a process (fine for
 * the dev server and a warm serverless instance; a cold instance just refreshes once).
 */
const refreshesByToken = new Map<string, Promise<RefreshResult>>();

/** How long a completed refresh result stays reusable for stragglers that still hold the old token. */
const REFRESH_CACHE_MS = 60 * 1000;

/**
 * Single-flight a token refresh keyed by the current (soon-to-be-replaced) refresh token.
 * Concurrent callers with the same key share one `doRefresh()`; the result is cached briefly
 * so a straggler still holding the old token reuses it instead of re-spending a rotated token.
 * A rejected refresh is dropped immediately so the next caller can retry.
 */
export function sharedRefresh(oldRefreshToken: string, doRefresh: () => Promise<RefreshResult>): Promise<RefreshResult> {
  const existing = refreshesByToken.get(oldRefreshToken);
  if (existing) return existing;

  const pending = doRefresh();
  refreshesByToken.set(oldRefreshToken, pending);
  pending.then(
    () => {
      const timer = setTimeout(() => refreshesByToken.delete(oldRefreshToken), REFRESH_CACHE_MS);
      timer.unref?.();
    },
    () => refreshesByToken.delete(oldRefreshToken),
  );
  return pending;
}
