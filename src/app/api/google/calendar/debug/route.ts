import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { googleServiceFactory } from "@/lib/google/googleServiceFactory";

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!googleServiceFactory.isAvailable()) {
    return NextResponse.json(
      { error: "Google Calendar not available" },
      { status: 503 }
    );
  }

  try {
    const calendar = await googleServiceFactory.getCalendarClient();
    if (!calendar) {
      return NextResponse.json(
        { error: "Failed to get calendar client" },
        { status: 500 }
      );
    }

    // List all calendars
    const calendarList = await calendar.calendarList.list();
    const calendars = calendarList.data.items || [];

    console.log(`[Calendar Debug] Found ${calendars.length} calendars`);

    // For each calendar, get events from Jan 1 to Jan 31, 2026
    const timeMin = new Date("2026-01-01T00:00:00Z");
    const timeMax = new Date("2026-01-31T23:59:59Z");

    const allEvents: any[] = [];

    for (const cal of calendars) {
      try {
        const eventsResponse = await calendar.events.list({
          calendarId: cal.id,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });

        const events = eventsResponse.data.items || [];
        console.log(`[Calendar Debug] Calendar "${cal.summary}" (${cal.id}): ${events.length} events`);

        for (const event of events) {
          allEvents.push({
            calendar: cal.summary,
            calendarId: cal.id,
            eventId: event.id,
            summary: event.summary,
            start: event.start,
            status: event.status,
            visibility: event.visibility,
            organizer: event.organizer?.email,
          });
        }
      } catch (err: any) {
        console.log(`[Calendar Debug] Error listing events for calendar ${cal.id}:`, err.message);
      }
    }

    return NextResponse.json({
      calendars: calendars.map((c: typeof calendars[number]) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary,
        accessRole: c.accessRole,
      })),
      events: allEvents,
    });
  } catch (error: any) {
    console.error("Calendar debug error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to debug calendar" },
      { status: 500 }
    );
  }
}
