import { randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { createOAuthClient, isGoogleConfigured, SCOPES } from "@/lib/google";
import { safeReturnTo } from "@/lib/return-to";
import { saveOAuthState } from "@/lib/session";

/**
 * Step 1 of the OAuth 2.0 authorization code flow: send the user to Google's consent screen.
 * - `state` (random, remembered in an encrypted cookie) stops attackers from forging callbacks (CSRF).
 * - PKCE (`code_challenge`) means a stolen authorization code is useless without our verifier.
 */
export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return Response.redirect(new URL("/?error=not_configured", request.url));
  }

  const client = createOAuthClient();
  const state = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  await saveOAuthState({ state, codeVerifier, returnTo: safeReturnTo(new URL(request.url).searchParams.get("returnTo")) });

  const url = client.generateAuthUrl({
    scope: SCOPES,
    access_type: "offline", // also return a refresh token, so scans work after the 1-hour access token expires
    prompt: "consent", // always show consent, so Google re-issues a refresh token
    include_granted_scopes: true,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
  return Response.redirect(url);
}
