import "server-only";
import { NotSignedInError } from "./google";

/** Maps auth and Google API failures to JSON responses the UI understands. */
export function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof NotSignedInError) {
    return Response.json({ error: error.message, signInAgain: true }, { status: 401 });
  }
  const code = (error as { code?: number })?.code;
  if (code === 401 || code === 403) {
    return Response.json({ error: "Google denied access. Please sign in again.", signInAgain: true }, { status: 401 });
  }
  if (code === 404) return Response.json({ error: "Email not found" }, { status: 404 });
  if (code === 429) return Response.json({ error: "Gmail is rate-limiting requests. Try again in a moment." }, { status: 429 });
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
