import "server-only";
import { OAuth2Client } from "google-auth-library";
import { getSession, saveSession, type Session } from "./session";

/** Read-only access to exactly what the app needs, nothing more. */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export const SCOPES = ["openid", "email", "profile", GMAIL_SCOPE, CALENDAR_SCOPE];

// Refresh a little early so a token can't expire in the middle of a scan.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

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
    if (!session.tokens.refreshToken) throw new NotSignedInError("Session expired, please sign in again");
    try {
      const { credentials } = await client.refreshAccessToken();
      session.tokens.accessToken = credentials.access_token!;
      session.tokens.expiresAt = credentials.expiry_date ?? Date.now() + 3600_000;
      // Google only sometimes rotates the refresh token; keep the old one otherwise.
      if (credentials.refresh_token) session.tokens.refreshToken = credentials.refresh_token;
      await saveSession(session);
    } catch {
      // Revoked access, or (for apps in Testing mode) the refresh token's 7-day lifetime ran out.
      throw new NotSignedInError("Google access expired or was revoked, please sign in again");
    }
  }
  return { client, session };
}
