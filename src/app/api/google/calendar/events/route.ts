import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { calendarService } from "@/lib/google";

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!calendarService.isAvailable()) {
    return NextResponse.json(
      { error: "Google Calendar not available" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  try {
    const options: any = {
      maxResults: 250,
      singleEvents: true,
      orderBy: "startTime" as const,
    };

    if (startDate) {
      options.timeMin = new Date(startDate);
    }
    if (endDate) {
      options.timeMax = new Date(endDate);
    }

    console.log(`[Calendar API] Fetching events with options:`, {
      timeMin: options.timeMin?.toISOString(),
      timeMax: options.timeMax?.toISOString(),
      calendarId: 'primary',
    });

    const result = await calendarService.listEvents(options);

    console.log(`[Calendar API] Fetched ${result.events.length} events from Google Calendar`);

    // Transform events to a format the frontend expects
    const events = result.events.map((event) => ({
      id: event.id,
      title: event.summary || "No title",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      url: event.htmlLink,
      extendedProps: {
        status: event.status,
        hangoutLink: event.hangoutLink,
        description: event.description,
        location: event.location,
        attendees: event.attendees?.map((a: any) => a.email),
      },
    }));

    console.log(`[Calendar API] Returning ${events.length} events:`, events.slice(0, 3).map(e => ({ title: e.title, start: e.start })));

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("Failed to fetch calendar events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!calendarService.isAvailable()) {
    return NextResponse.json(
      { error: "Google Calendar not available" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { title, description, start, end, attendees, location, createMeet } = body;

    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "Title, start, and end are required" },
        { status: 400 }
      );
    }

    // If createMeet is true, use the special method
    if (createMeet) {
      const result = await calendarService.createMeetingWithMeet(
        title,
        new Date(start),
        new Date(end),
        attendees || [],
        description
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        eventId: result.eventId,
        htmlLink: result.htmlLink,
      });
    }

    // Regular event creation
    const event = {
      summary: title,
      description,
      location,
      start: {
        dateTime: new Date(start).toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: new Date(end).toISOString(),
        timeZone: "America/New_York",
      },
      attendees: attendees?.map((email: string) => ({ email })),
    };

    const result = await calendarService.createEvent(event);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      htmlLink: result.htmlLink,
    });
  } catch (error: any) {
    console.error("Failed to create calendar event:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create event" },
      { status: 500 }
    );
  }
}
