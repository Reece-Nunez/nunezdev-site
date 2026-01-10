// Legacy Calendar Service - redirects to new Google Workspace integration
// This file maintains backward compatibility with existing code

import { calendarService as newCalendarService } from './google';

interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

interface CalendarResponse {
  id: string;
  htmlLink?: string;
}

export class CalendarService {
  private static instance: CalendarService;

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  async createEvent(event: CalendarEvent): Promise<CalendarResponse | null> {
    const result = await newCalendarService.createEvent({
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
    });

    if (!result.success || !result.eventId) {
      return null;
    }

    return {
      id: result.eventId,
      htmlLink: result.htmlLink,
    };
  }

  isAvailable(): boolean {
    return newCalendarService.isAvailable();
  }
}

export const calendarService = CalendarService.getInstance();
