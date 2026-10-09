import { connection } from "next/server";
import { isGoogleConfigured } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { getSession } from "@/lib/session";

/** Who is signed in (never the tokens), plus whether the server is configured. */
export async function GET() {
  // Always run per request. Without this, a build without credentials would prerender
  // a permanent "signed out / not configured" response.
  await connection();
  const configured = { google: isGoogleConfigured(), ai: isLLMConfigured() };
  const session = configured.google ? await getSession() : null;
  return Response.json({ user: session?.user ?? null, configured });
}
