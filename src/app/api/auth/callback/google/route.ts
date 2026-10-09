import { timingSafeEqual } from "node:crypto";
import { CALENDAR_SCOPE, createOAuthClient, GMAIL_SCOPE } from "@/lib/google";
import { saveSession, takeOAuthState } from "@/lib/session";

/** Step 2: Google redirects back here with a one-time code, which we exchange for tokens. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const home = (error?: string) => Response.redirect(new URL(error ? `/?error=${error}` : "/", url));

  const flow = await takeOAuthState();
  if (url.searchParams.get("error")) return home("access_denied"); // user clicked Cancel
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!flow || !code || !state || !safeEqual(state, flow.state)) return home("invalid_state");

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken({ code, codeVerifier: flow.codeVerifier });

    // Google lets users untick individual permissions on the consent screen.
    // Gmail and Calendar read access are required; draft access (compose) is optional.
    const granted = new Set((tokens.scope ?? "").split(" "));
    if (!granted.has(GMAIL_SCOPE) || !granted.has(CALENDAR_SCOPE)) return home("missing_scopes");

    // The ID token is signed by Google; verifying it proves who the user is.
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: process.env.GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    if (!profile?.email) return home("no_email");

    await saveSession({
      user: { email: profile.email, name: profile.name, picture: profile.picture },
      tokens: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
        scopes: [...granted],
      },
    });
    return Response.redirect(new URL(flow.returnTo ?? "/", url));
  } catch (error) {
    console.error("OAuth callback failed:", error);
    return home("oauth_failed");
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
