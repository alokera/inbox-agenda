import "server-only";
import { calendar } from "@googleapis/calendar";
import type { OAuth2Client } from "google-auth-library";
import type { AgendaItem } from "./types";

export const CALENDAR_DAYS_AHEAD = 60;

/** Upcoming events from the user's primary calendar, as agenda items. */
export async function listUpcomingEvents(auth: OAuth2Client, from: Date): Promise<AgendaItem[]> {
  const api = calendar({ version: "v3", auth });
  const { data } = await api.events.list({
    calendarId: "primary",
    timeMin: from.toISOString(),
    timeMax: new Date(from.getTime() + CALENDAR_DAYS_AHEAD * 86_400_000).toISOString(),
    singleEvents: true, // expand recurring events into individual occurrences
    orderBy: "startTime",
    maxResults: 250,
  });

  return (data.items ?? [])
    .filter((event) => event.status !== "cancelled" && (event.start?.dateTime || event.start?.date))
    .map((event) => {
      const allDay = !event.start?.dateTime;
      const videoLink = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;
      return {
        id: `cal-${event.id}`,
        source: "calendar",
        title: event.summary || "(untitled event)",
        start: allDay ? `${event.start!.date}T00:00:00` : event.start!.dateTime!,
        end: allDay ? null : (event.end?.dateTime ?? null),
        allDay,
        location: event.location ?? null,
        meetingLink: videoLink,
        organizer: event.organizer?.displayName ?? event.organizer?.email ?? null,
        status: "scheduled",
        confidence: null,
        emailId: null,
        emailSubject: null,
        calendarLink: event.htmlLink ?? null,
        missingFromCalendar: false,
      } satisfies AgendaItem;
    });
}
