// Google Service Factory
// Central authentication factory for all Google Workspace APIs with domain-wide delegation

type GoogleApiClient = {
  people: any;
  calendar: any;
  drive: any;
  sheets: any;
  tasks: any;
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
    try {
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const impersonationEmail = process.env.GOOGLE_IMPERSONATION_EMAIL;

      if (!serviceAccountKey) {
        console.log('Google Workspace integration disabled - no service account key');
        return;
      }

      if (!impersonationEmail) {
        console.log('Google Workspace integration disabled - no impersonation email');
        return;
      }

      // Dynamic import to prevent build issues
      const { google } = await import('googleapis');
      this.googleModule = google;

      // Parse service account credentials
      const credentials = JSON.parse(serviceAccountKey);

      // Create JWT auth client with domain-wide delegation (impersonation)
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: getAllScopes(),
        subject: impersonationEmail, // This enables domain-wide delegation
      });

      // Authorize the client
      await auth.authorize();

      this.authClient = auth;
      this.isInitialized = true;

      console.log('Google Workspace integration initialized successfully');
      console.log(`Impersonating: ${impersonationEmail}`);
    } catch (error: any) {
      console.error('Failed to initialize Google Workspace:', error.message);
      this.isInitialized = false;
      throw error;
    }
  }

  async getClient<T extends ServiceName>(serviceName: T): Promise<any | null> {
    try {
      await this.initialize();

      if (!this.authClient || !this.googleModule) {
        return null;
      }

      // Return cached client if available
      if (this.clients[serviceName]) {
        return this.clients[serviceName];
      }

      // Create new client
      const config = SERVICE_CONFIGS[serviceName];
      const client = this.googleModule[serviceName]({
        version: config.version,
        auth: this.authClient,
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

  // Check if a specific service is available
  isAvailable(): boolean {
    return !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_IMPERSONATION_EMAIL
    );
  }

  // Get initialization status
  getStatus(): { initialized: boolean; available: boolean } {
    return {
      initialized: this.isInitialized,
      available: this.isAvailable(),
    };
  }

  // Reset for testing
  reset(): void {
    this.clients = {};
    this.googleModule = null;
    this.authClient = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}

export const googleServiceFactory = GoogleServiceFactory.getInstance();
