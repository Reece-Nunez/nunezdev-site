// Calendar service that loads Google APIs only when needed
// This prevents memory issues during build by using conditional imports

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
  private googleCalendar: any = null;
  private isInitialized: boolean = false;

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  private async initializeGoogleCalendar() {
    if (this.isInitialized) {
      return this.googleCalendar;
    }

    try {
      // Only load googleapis if we have credentials
      const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (!keyFile && !serviceAccountKey) {
        console.log('Google Calendar integration disabled - no credentials provided');
        return null;
      }

      // Temporarily disabled to resolve build issues
      throw new Error('Google Calendar integration temporarily disabled during deployment');

      /* TODO: Re-enable when build issues are resolved
      const { google } = await import('googleapis');

      let auth;

      if (serviceAccountKey) {
        // Use credentials from environment variable (production)
        const credentials = JSON.parse(serviceAccountKey);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
          ],
        });
      } else if (keyFile) {
        // Use key file (development)
        auth = new google.auth.GoogleAuth({
          keyFile: keyFile,
          scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
          ],
        });
      }

      this.googleCalendar = google.calendar({ version: 'v3', auth });
      */
      this.isInitialized = true;

      console.log('Google Calendar integration initialized successfully');
      return this.googleCalendar;

    } catch (error: any) {
      console.error('Failed to initialize Google Calendar:', error.message);
      return null;
    }
  }

  async createEvent(event: CalendarEvent): Promise<CalendarResponse | null> {
    try {
      const calendar = await this.initializeGoogleCalendar();

      if (!calendar) {
        console.log('Google Calendar not available - skipping event creation');
        return null;
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'none',
      });

      console.log('Calendar event created successfully with ID:', response.data.id);

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink
      };

    } catch (error: any) {
      console.error('Failed to create calendar event:', error.message);
      return null;
    }
  }

  isAvailable(): boolean {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    return !!(keyFile || serviceAccountKey);
  }
}

export const calendarService = CalendarService.getInstance();