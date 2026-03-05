// Google Service Factory
// Central authentication factory for all Google Workspace APIs with domain-wide delegation

type GoogleApiClient = {
  people: any;
  calendar: any;
  drive: any;
  sheets: any;
  tasks: any;
  analyticsdata: any;
};

type ServiceName = keyof GoogleApiClient;

interface ServiceConfig {
  version: string;
  scopes: string[];
}

const SERVICE_CONFIGS: Record<ServiceName, ServiceConfig> = {
  people: {
    version: 'v1',
    scopes: [
      'https://www.googleapis.com/auth/contacts',
    ],
  },
  calendar: {
    version: 'v3',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  drive: {
    version: 'v3',
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  },
  sheets: {
    version: 'v4',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  },
  tasks: {
    version: 'v1',
    scopes: ['https://www.googleapis.com/auth/tasks'],
  },
  analyticsdata: {
    version: 'v1beta',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  },
};

// Get all scopes needed for domain-wide delegation
export function getAllScopes(): string[] {
  const allScopes = new Set<string>();
  Object.values(SERVICE_CONFIGS).forEach((config) => {
    config.scopes.forEach((scope) => allScopes.add(scope));
  });
  return Array.from(allScopes);
}

class GoogleServiceFactory {
  private static instance: GoogleServiceFactory;
  private clients: Partial<GoogleApiClient> = {};
  private googleModule: any = null;
  private authClient: any = null;
  private analyticsAuthClient: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  static getInstance(): GoogleServiceFactory {
    if (!GoogleServiceFactory.instance) {
      GoogleServiceFactory.instance = new GoogleServiceFactory();
    }
    return GoogleServiceFactory.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    await this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const impersonationEmail = process.env.GOOGLE_IMPERSONATION_EMAIL;

    if (!serviceAccountKey) {
      console.log('Google integration disabled - no service account key');
      return;
    }

    // Dynamic import to prevent build issues
    const { google } = await import('googleapis');
    this.googleModule = google;

    const credentials = JSON.parse(serviceAccountKey);

    // 1. Create analytics auth client WITHOUT impersonation
    // Analytics Data API uses direct service account access, not domain-wide delegation
    try {
      const analyticsAuth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SERVICE_CONFIGS.analyticsdata.scopes,
      });

      await analyticsAuth.authorize();
      this.analyticsAuthClient = analyticsAuth;
      console.log('Google Analytics auth initialized successfully');
    } catch (error: any) {
      console.error('Failed to initialize Analytics auth:', error.message);
    }

    // 2. Create Workspace auth client WITH domain-wide delegation (impersonation)
    // Used for Calendar, Drive, Contacts, Sheets, Tasks
    if (impersonationEmail) {
      try {
        const auth = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: getAllScopes(),
          subject: impersonationEmail,
        });

        await auth.authorize();
        this.authClient = auth;
        console.log(`Google Workspace auth initialized (impersonating: ${impersonationEmail})`);
      } catch (error: any) {
        console.error('Failed to initialize Workspace auth:', error.message);
      }
    }

    this.isInitialized = true;
  }

  async getClient<T extends ServiceName>(serviceName: T): Promise<any | null> {
    try {
      await this.initialize();

      if (!this.googleModule) {
        return null;
      }

      // Use the non-delegated auth client for Analytics Data API
      const authForService = serviceName === 'analyticsdata' ? this.analyticsAuthClient : this.authClient;
      if (!authForService) {
        console.error(`No auth client available for ${serviceName}`);
        return null;
      }

      if (this.clients[serviceName]) {
        return this.clients[serviceName];
      }

      const config = SERVICE_CONFIGS[serviceName];
      const client = this.googleModule[serviceName]({
        version: config.version,
        auth: authForService,
      });

      this.clients[serviceName] = client;
      return client;
    } catch (error: any) {
      console.error(`Failed to get ${serviceName} client:`, error.message);
      return null;
    }
  }

  // Convenience methods for each service
  async getPeopleClient() {
    return this.getClient('people');
  }

  async getCalendarClient() {
    return this.getClient('calendar');
  }

  async getDriveClient() {
    return this.getClient('drive');
  }

  async getSheetsClient() {
    return this.getClient('sheets');
  }

  async getTasksClient() {
    return this.getClient('tasks');
  }

  async getAnalyticsDataClient() {
    return this.getClient('analyticsdata');
  }

  isAvailable(): boolean {
    return !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_IMPERSONATION_EMAIL
    );
  }

  getStatus(): { initialized: boolean; available: boolean } {
    return {
      initialized: this.isInitialized,
      available: this.isAvailable(),
    };
  }

  reset(): void {
    this.clients = {};
    this.googleModule = null;
    this.authClient = null;
    this.analyticsAuthClient = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}

export const googleServiceFactory = GoogleServiceFactory.getInstance();
