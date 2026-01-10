// Google Workspace Integration Types

// ============================================
// Contact Types (People API)
// ============================================

export interface GoogleContact {
  resourceName: string;
  etag: string;
  names?: Array<{
    displayName?: string;
    givenName?: string;
    familyName?: string;
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
  }>;
  metadata?: {
    sources?: Array<{
      type: string;
      id: string;
      updateTime?: string;
    }>;
  };
}

export interface ContactCreateInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

export interface ContactSyncResult {
  success: boolean;
  googleContactId?: string;
  etag?: string;
  error?: string;
}

// ============================================
// Calendar Types
// ============================================

export interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    };
  };
}

export interface CalendarEventResponse {
  id: string;
  etag: string;
  htmlLink?: string;
  hangoutLink?: string;
  status: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  etag?: string;
  htmlLink?: string;
  error?: string;
}

// ============================================
// Drive Types
// ============================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  error?: string;
}

// ============================================
// Sheets Types
// ============================================

export interface SheetExportResult {
  success: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  error?: string;
}

export interface SheetData {
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

// ============================================
// Tasks Types
// ============================================

export interface GoogleTask {
  id: string;
  etag: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
}

export interface TaskList {
  id: string;
  etag: string;
  title: string;
}

export interface TaskSyncResult {
  success: boolean;
  taskId?: string;
  etag?: string;
  error?: string;
}

// ============================================
// Sync Types
// ============================================

export type SyncDirection = 'to_google' | 'from_google';
export type SyncStatus = 'success' | 'conflict' | 'error' | 'skipped';
export type EntityType = 'contact' | 'calendar' | 'task' | 'document' | 'sheet';
export type ServiceType = 'contacts' | 'calendar' | 'tasks' | 'drive';

export interface SyncLogEntry {
  orgId: string;
  entityType: EntityType;
  entityId: string;
  googleId: string;
  syncDirection: SyncDirection;
  syncStatus: SyncStatus;
  conflictResolution?: string;
  errorMessage?: string;
  localData?: Record<string, unknown>;
  googleData?: Record<string, unknown>;
}

export interface SyncWatermark {
  orgId: string;
  service: ServiceType;
  syncToken?: string;
  lastFullSyncAt?: Date;
  lastIncrementalSyncAt?: Date;
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}

// ============================================
// Client Mapping Types
// ============================================

export interface ClientToContactMapping {
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  googleContactId: string | null;
  googleContactEtag: string | null;
}

export interface ContactToClientMapping {
  googleContactId: string;
  googleContactEtag: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}
