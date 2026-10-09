import { connection } from "next/server";
import { GMAIL_COMPOSE_SCOPE, hasScope, isGoogleConfigured } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { getSession } from "@/lib/session";

/** Who is signed in (never the tokens), whether the server is configured, and whether drafts are allowed. */
export async function GET() {
  // Always run per request. Without this, a build without credentials would prerender
  // a permanent "signed out / not configured" response.
  await connection();
  const configured = { google: isGoogleConfigured(), ai: isLLMConfigured() };
  const session = configured.google ? await getSession() : null;
  return Response.json({ user: session?.user ?? null, configured, canDraft: session ? hasScope(session, GMAIL_COMPOSE_SCOPE) : false });
}
