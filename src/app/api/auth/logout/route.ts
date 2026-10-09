import { createOAuthClient } from "@/lib/google";
import { clearSession, getSession } from "@/lib/session";

/** Signs out and revokes the app's access at Google, so the tokens stop working everywhere. */
export async function POST() {
  const session = await getSession();
  if (session) {
    const token = session.tokens.refreshToken ?? session.tokens.accessToken;
    await createOAuthClient()
      .revokeToken(token)
      .catch((error) => console.warn("Token revoke failed (it may already be invalid):", error?.message));
  }
  await clearSession();
  return Response.json({ ok: true });
}
