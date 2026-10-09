import { extractAppointments } from "@/lib/ai-extract";
import { listUpcomingEvents } from "@/lib/calendar";
import { mapWithConcurrency } from "@/lib/concurrency";
import { findCandidateEmails } from "@/lib/gmail";
import { getAuthorizedClient, NotSignedInError } from "@/lib/google";
import { isLLMConfigured } from "@/lib/llm";
import { mergeAgenda } from "@/lib/merge";
import { isValidTimezone } from "@/lib/timezone";
import type { ScanEvent } from "@/lib/types";

// A scan reads up to 40 emails and makes one AI call per email.
export const maxDuration = 120;

const ALLOWED_DAYS = [7, 14, 30];
const AI_CONCURRENCY = 5;

/**
 * Scans the inbox and calendar, streaming progress as newline-delimited JSON
 * (one ScanEvent per line) so the UI can show what's happening.
 * Nothing is stored: emails are read, analysed and discarded within this request.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const days = ALLOWED_DAYS.includes(body.days) ? (body.days as number) : 30;
  const timezone = isValidTimezone(body.timezone) ? body.timezone : "UTC";

  if (!isLLMConfigured()) return Response.json({ error: "XAI_API_KEY is not configured on the server." }, { status: 500 });

  // Authorize (and refresh the token if needed) before streaming starts, because it may set a cookie.
  let auth;
  try {
    auth = await getAuthorizedClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not signed in";
    return Response.json({ error: message, signInAgain: error instanceof NotSignedInError }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ScanEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const now = new Date();
        const startOfToday = new Date(now.getTime() - 24 * 3600_000); // generous; the client groups by its own "today"

        send({ type: "status", message: "Reading your calendar…" });
        const calendarItems = await listUpcomingEvents(auth.client, startOfToday);

        send({ type: "status", message: `Searching the last ${days} days of email…` });
        const emails = await findCandidateEmails(auth.client, days, (done, total) => send({ type: "progress", done, total }));

        send({ type: "status", message: `Asking AI to find appointments in ${emails.length} emails…` });
        let analyzed = 0;
        const perEmail = await mapWithConcurrency(emails, AI_CONCURRENCY, async (email) => {
          const items = await extractAppointments(email, timezone);
          send({ type: "progress", done: ++analyzed, total: emails.length });
          return items;
        });
        const emailItems = perEmail.flat();

        const items = mergeAgenda(calendarItems, emailItems, now);
        send({
          type: "result",
          items,
          stats: {
            emailsMatched: emails.length,
            emailsAnalyzed: analyzed,
            calendarEvents: calendarItems.length,
            appointmentsInEmail: emailItems.length,
            missingFromCalendar: items.filter((i) => i.missingFromCalendar).length,
          },
        });
      } catch (error) {
        console.error("Scan failed:", error);
        const status = (error as { code?: number })?.code;
        send({
          type: "error",
          message: status === 401 || status === 403 ? "Google denied access. Please sign in again." : "The scan failed. Please try again.",
          signInAgain: status === 401 || status === 403,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
}
