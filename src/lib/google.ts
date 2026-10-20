import "server-only";
import { OAuth2Client } from "google-auth-library";
import { clearSession, getSession, saveSession, type Session } from "./session";
import { sharedRefresh, type RefreshResult } from "./token-refresh";

/** Read access to mail and calendar, plus draft creation for job applications. */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
/**
 * Needed to create drafts. Google's compose scope would also allow sending, but the
 * app only ever calls drafts.create — the user reviews and presses Send in Gmail.
 */
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
export const SCOPES = ["openid", "email", "profile", GMAIL_SCOPE, CALENDAR_SCOPE, GMAIL_COMPOSE_SCOPE];

export function hasScope(session: Session, scope: string): boolean {
  return session.tokens.scopes?.includes(scope) ?? false;
}

// Refresh a little early so a token can't expire in the middle of a scan.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Exchange the refresh token for a fresh access token, shared across concurrent callers. */
function refreshTokens(client: OAuth2Client, oldRefreshToken: string): Promise<RefreshResult> {
  return sharedRefresh(oldRefreshToken, async () => {
    const { credentials } = await client.refreshAccessToken();
    return {
      accessToken: credentials.access_token!,
      expiresAt: credentials.expiry_date ?? Date.now() + 3600_000,
      // Google only sometimes rotates the refresh token; keep the old one otherwise.
      refreshToken: credentials.refresh_token ?? oldRefreshToken,
    };
  });
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET);
}

export function redirectUri(): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/callback/google`;
}

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri(),
  });
}

export class NotSignedInError extends Error {
  constructor(message = "Not signed in") {
    super(message);
  }
}

/**
 * Returns an OAuth client authorized as the signed-in user, refreshing the
 * access token first if it's about to expire (and saving the new one).
 * Must run before a streaming response starts, since it may set a cookie.
 */
export async function getAuthorizedClient(): Promise<{ client: OAuth2Client; session: Session }> {
  const session = await getSession();
  if (!session) throw new NotSignedInError();

  const client = createOAuthClient();
  client.setCredentials({
    access_token: session.tokens.accessToken,
    refresh_token: session.tokens.refreshToken,
    expiry_date: session.tokens.expiresAt,
  });

  if (session.tokens.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    if (!session.tokens.refreshToken) {
      // Nothing left to refresh with: drop the cookie so the user lands on the signed-out page
      // instead of /api/me reporting them signed in and bouncing them back into the app.
      await clearSession();
      throw new NotSignedInError("Session expired, please sign in again");
    }
    try {
      // Shared across concurrent requests holding the same refresh token (see refreshTokens).
      const refreshed = await refreshTokens(client, session.tokens.refreshToken);
      session.tokens.accessToken = refreshed.accessToken;
      session.tokens.expiresAt = refreshed.expiresAt;
      session.tokens.refreshToken = refreshed.refreshToken;
      // Apply to this request's client too: it may have piggybacked on another request's refresh.
      client.setCredentials({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        expiry_date: refreshed.expiresAt,
      });
      // Each request persists the same values to its own cookie; the write is idempotent.
      await saveSession(session);
    } catch {
      // Revoked access, or (for apps in Testing mode) the refresh token's 7-day lifetime ran out.
      // The session can never recover, so clear it: the user is now signed out and the next
      // /api/me returns null, so the client's redirect lands on the main (signed-out) page.
      await clearSession();
      throw new NotSignedInError("Google access expired or was revoked, please sign in again");
    }
  }
  return { client, session };
}
