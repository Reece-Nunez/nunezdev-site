// Google Workspace Integration
// Central export for all Google services

export { googleServiceFactory, getAllScopes } from './googleServiceFactory';
export { contactsService } from './contactsService';
export { calendarService } from './calendarService';
export { driveService } from './driveService';
export { sheetsService } from './sheetsService';
export { tasksService } from './tasksService';
export { syncEngine } from './syncEngine';

// Re-export types
export type {
  // Contact types
  GoogleContact,
  ContactCreateInput,
  ContactSyncResult,
  ContactToClientMapping,
  // Calendar types
  CalendarEvent,
  CalendarEventResponse,
  CalendarSyncResult,
  // Drive types
  DriveFile,
  DriveFolder,
  DriveUploadResult,
  // Sheets types
  SheetExportResult,
  SheetData,
  // Tasks types
  GoogleTask,
  TaskList,
  TaskSyncResult,
  // Sync types
  SyncDirection,
  SyncStatus,
  EntityType,
  ServiceType,
  SyncLogEntry,
  SyncWatermark,
  SyncResult,
  ClientToContactMapping,
} from './types';
