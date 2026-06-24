// Google Service Factory
// Central authentication factory for all Google Workspace APIs with domain-wide delegation

type GoogleApiClient = {
  people: any;
  calendar: any;
  drive: any;
  sheets: any;
  tasks: any;
  analyticsdata: any;
  analyticsadmin: any;
  searchconsole: any;
  gmail: any;
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
  // GA4 Admin API — used to auto-discover a client's property by matching its
  // data-stream URL to the client's website. analytics.readonly already covers
  // the Admin API's read methods, so no new delegation scope is required.
  analyticsadmin: {
    version: 'v1beta',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  },
  // Search Console — uses DIRECT service-account access (not domain-wide
  // delegation): the SA must be added as a user on each client's Search Console
  // property. webmasters.readonly therefore rides on the non-delegated JWT and
  // is deliberately kept OUT of getAllScopes() (the delegated Workspace JWT) so
  // existing Calendar/Drive/Gmail auth is unaffected.
  searchconsole: {
    version: 'v1',
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  },
  // gmail.readonly powers leadgen reply detection (cron/leadgen-reply-sync).
  // Read-only — we only search for prospect replies, never send from here.
  // NOTE: this scope must be authorized for the service account in the Google
  // Workspace Admin console (Security → API controls → Domain-wide delegation)
  // alongside the others, or the impersonated client 403s at call time.
  gmail: {
    version: 'v1',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },
};

// Services authenticated via DIRECT service-account access (their own JWT),
// NOT domain-wide delegation. Their scopes must NOT leak into the delegated
// Workspace JWT — an unauthorized scope there fails authorize() for ALL
// Workspace APIs.
const NON_DELEGATED_SERVICES: ReadonlySet<ServiceName> = new Set([
  'analyticsdata',
  'analyticsadmin',
  'searchconsole',
]);

// Scopes for the delegated (impersonation) Workspace JWT — excludes the
// direct-access services above.
export function getAllScopes(): string[] {
  const allScopes = new Set<string>();
  (Object.entries(SERVICE_CONFIGS) as [ServiceName, ServiceConfig][]).forEach(([name, config]) => {
    if (NON_DELEGATED_SERVICES.has(name)) return;
    config.scopes.forEach((scope) => allScopes.add(scope));
  });
  return Array.from(allScopes);
}

// Scopes for the non-delegated (direct service-account) JWT.
function getNonDelegatedScopes(): string[] {
  const scopes = new Set<string>();
  NON_DELEGATED_SERVICES.forEach((name) => {
    SERVICE_CONFIGS[name].scopes.forEach((scope) => scopes.add(scope));
  });
  return Array.from(scopes);
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
        // Covers GA4 Data + Admin and Search Console (all direct-access APIs).
        scopes: getNonDelegatedScopes(),
      });

      await analyticsAuth.authorize();
      this.analyticsAuthClient = analyticsAuth;
      console.log('Google direct-access (Analytics + Search Console) auth initialized successfully');
    } catch (error: any) {
      console.error('Failed to initialize direct-access auth:', error.message);
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

      // Direct-access services (Analytics Data/Admin, Search Console) use the
      // non-delegated JWT; everything else uses domain-wide delegation.
      const authForService = NON_DELEGATED_SERVICES.has(serviceName) ? this.analyticsAuthClient : this.authClient;
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

  async getAnalyticsAdminClient() {
    return this.getClient('analyticsadmin');
  }

  async getSearchConsoleClient() {
    return this.getClient('searchconsole');
  }

  async getGmailClient() {
    return this.getClient('gmail');
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
