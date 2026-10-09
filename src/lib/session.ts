import "server-only";
import { cookies } from "next/headers";
import { seal, unseal } from "./crypto";

const SESSION_COOKIE = "ia_session";
const OAUTH_COOKIE = "ia_oauth";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const OAUTH_MAX_AGE = 60 * 10; // the login round-trip must finish within 10 minutes

export interface SessionUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface Session {
  user: SessionUser;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    /** Epoch milliseconds. */
    expiresAt: number;
    /** Scopes the user actually granted (they can untick some on Google's consent screen). */
    scopes?: string[];
  };
}

/** Short-lived values that tie the OAuth callback to the browser that started the login. */
export interface OAuthFlowState {
  state: string;
  codeVerifier: string;
  /** Same-site path to return to after sign-in (e.g. back to an email). */
  returnTo?: string;
}

const secret = () => process.env.SESSION_SECRET ?? "";

const cookieOptions = (maxAge: number) => ({
  httpOnly: true, // not readable from JavaScript, so XSS can't steal tokens
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, // sent on the top-level redirect back from Google
  path: "/",
  maxAge,
});

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return unseal<Session>(store.get(SESSION_COOKIE)?.value, secret());
}

export async function saveSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await seal({ ...session }, secret(), SESSION_MAX_AGE), cookieOptions(SESSION_MAX_AGE));
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function saveOAuthState(flow: OAuthFlowState): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_COOKIE, await seal({ ...flow }, secret(), OAUTH_MAX_AGE), cookieOptions(OAUTH_MAX_AGE));
}

/** Reads and deletes the flow state, so a callback URL can't be replayed. */
export async function takeOAuthState(): Promise<OAuthFlowState | null> {
  const store = await cookies();
  const flow = await unseal<OAuthFlowState>(store.get(OAUTH_COOKIE)?.value, secret());
  store.delete(OAUTH_COOKIE);
  return flow;
}
