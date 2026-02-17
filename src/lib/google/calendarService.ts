// Google Calendar Service
// Bidirectional sync for calendar events

import { googleServiceFactory } from './googleServiceFactory';
import type {
  CalendarEvent,
  CalendarEventResponse,
  CalendarSyncResult,
} from './types';

class CalendarService {
  private static instance: CalendarService;

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  private async getClient() {
    return googleServiceFactory.getCalendarClient();
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    event: CalendarEvent,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'none'
  ): Promise<CalendarSyncResult> {
    try {
      const calendar = await this.getClient();
      if (!calendar) {
        return { success: false, error: 'Google Calendar not available' };
      }

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates,
        conferenceDataVersion: event.conferenceData ? 1 : 0,
      });

      console.log(`Created calendar event: ${response.data.id}`);

      return {
        success: true,
        eventId: response.data.id,
        etag: response.data.etag,
        htmlLink: response.data.htmlLink,
      };
    } catch (error: any) {
      console.error('Failed to create calendar event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'none'
  ): Promise<CalendarSyncResult> {
    try {
      const calendar = await this.getClient();
      if (!calendar) {
        return { success: false, error: 'Google Calendar not available' };
      }

      const response = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates,
      });

      console.log(`Updated calendar event: ${eventId}`);

      return {
        success: true,
        eventId: response.data.id,
        etag: response.data.etag,
        htmlLink: response.data.htmlLink,
      };
    } catch (error: any) {
      console.error('Failed to update calendar event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'none'
  ): Promise<CalendarSyncResult> {
    try {
      const calendar = await this.getClient();
      if (!calendar) {
        return { success: false, error: 'Google Calendar not available' };
      }

      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates,
      });

      console.log(`Deleted calendar event: ${eventId}`);

      return { success: true, eventId };
    } catch (error: any) {
      console.error('Failed to delete calendar event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEventResponse | null> {
    try {
      const calendar = await this.getClient();
      if (!calendar) return null;

      const response = await calendar.events.get({
        calendarId,
        eventId,
      });

      return response.data as CalendarEventResponse;
    } catch (error: any) {
      console.error('Failed to get calendar event:', error.message);
      return null;
    }
  }

  /**
   * List events with optional filters
   */
  async listEvents(options: {
    calendarId?: string;
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    pageToken?: string;
    syncToken?: string;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
    q?: string;
  } = {}): Promise<{
    events: CalendarEventResponse[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }> {
    try {
      const calendar = await this.getClient();
      if (!calendar) {
        return { events: [] };
      }

      const params: any = {
        calendarId: options.calendarId || 'primary',
        maxResults: options.maxResults || 100,
        singleEvents: options.singleEvents !== false,
        orderBy: options.orderBy || 'startTime',
      };

      if (options.syncToken) {
        params.syncToken = options.syncToken;
      } else {
        if (options.timeMin) {
          params.timeMin = options.timeMin.toISOString();
        }
        if (options.timeMax) {
          params.timeMax = options.timeMax.toISOString();
        }
      }

      if (options.pageToken) {
        params.pageToken = options.pageToken;
      }

      if (options.q) {
        params.q = options.q;
      }

      const response = await calendar.events.list(params);

      return {
        events: (response.data.items || []) as CalendarEventResponse[],
        nextPageToken: response.data.nextPageToken,
        nextSyncToken: response.data.nextSyncToken,
      };
    } catch (error: any) {
      // Handle sync token expiration
      if (error.code === 410) {
        console.log('Calendar sync token expired, performing full sync');
        return this.listEvents({ ...options, syncToken: undefined });
      }
      console.error('Failed to list calendar events:', error.message);
      return { events: [] };
    }
  }

  /**
   * Get upcoming events for the next N days
   */
  async getUpcomingEvents(days: number = 7): Promise<CalendarEventResponse[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const result = await this.listEvents({
      timeMin: now,
      timeMax: future,
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return result.events;
  }

  /**
   * Create a Google Meet event
   */
  async createMeetingWithMeet(
    summary: string,
    startTime: Date,
    endTime: Date,
    attendees: string[] = [],
    description?: string
  ): Promise<CalendarSyncResult> {
    const event: CalendarEvent = {
      summary,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    return this.createEvent(event, 'primary', 'all');
  }

  /**
   * Quick add event using natural language
   */
  async quickAdd(text: string, calendarId: string = 'primary'): Promise<CalendarSyncResult> {
    try {
      const calendar = await this.getClient();
      if (!calendar) {
        return { success: false, error: 'Google Calendar not available' };
      }

      const response = await calendar.events.quickAdd({
        calendarId,
        text,
      });

      return {
        success: true,
        eventId: response.data.id,
        etag: response.data.etag,
        htmlLink: response.data.htmlLink,
      };
    } catch (error: any) {
      console.error('Failed to quick add event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return googleServiceFactory.isAvailable();
  }
}

export const calendarService = CalendarService.getInstance();
