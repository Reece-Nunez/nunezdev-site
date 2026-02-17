// Google Workspace Sync Engine
// Orchestrates bidirectional sync with conflict resolution

import { createClient } from '@supabase/supabase-js';
import { contactsService } from './contactsService';
import type {
  SyncResult,
  SyncLogEntry,
  SyncWatermark,
  ContactToClientMapping,
  ServiceType,
} from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ConflictResolution = 'newest_wins' | 'local_wins' | 'google_wins';

interface SyncOptions {
  orgId: string;
  conflictResolution?: ConflictResolution;
  fullSync?: boolean;
}

class SyncEngine {
  private static instance: SyncEngine;

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Log a sync operation
   */
  async logSync(entry: SyncLogEntry): Promise<void> {
    try {
      await supabase.from('google_sync_log').insert({
        org_id: entry.orgId,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        google_id: entry.googleId,
        sync_direction: entry.syncDirection,
        sync_status: entry.syncStatus,
        conflict_resolution: entry.conflictResolution,
        error_message: entry.errorMessage,
        local_data: entry.localData,
        google_data: entry.googleData,
      });
    } catch (error: any) {
      console.error('Failed to log sync:', error.message);
    }
  }

  /**
   * Get sync watermark for a service
   */
  async getWatermark(orgId: string, service: ServiceType): Promise<SyncWatermark | null> {
    const { data } = await supabase
      .from('google_sync_watermarks')
      .select('*')
      .eq('org_id', orgId)
      .eq('service', service)
      .maybeSingle();

    if (!data) return null;

    return {
      orgId: data.org_id,
      service: data.service,
      syncToken: data.sync_token,
      lastFullSyncAt: data.last_full_sync_at ? new Date(data.last_full_sync_at) : undefined,
      lastIncrementalSyncAt: data.last_incremental_sync_at
        ? new Date(data.last_incremental_sync_at)
        : undefined,
    };
  }

  /**
   * Update sync watermark
   */
  async updateWatermark(
    orgId: string,
    service: ServiceType,
    syncToken?: string,
    isFullSync: boolean = false
  ): Promise<void> {
    const now = new Date().toISOString();

    // Build update object - only include fields that should be updated
    const updateData: Record<string, unknown> = {
      org_id: orgId,
      service,
      last_incremental_sync_at: now,
      updated_at: now,
    };

    if (syncToken) {
      updateData.sync_token = syncToken;
    }

    if (isFullSync) {
      updateData.last_full_sync_at = now;
    }

    const { error } = await supabase.from('google_sync_watermarks').upsert(
      updateData,
      { onConflict: 'org_id,service' }
    );

    if (error) {
      console.error('[SyncEngine] Failed to update watermark:', error.message);
    } else {
      console.log(`[SyncEngine] Updated ${service} watermark - isFullSync: ${isFullSync}`);
    }
  }

  /**
   * Sync contacts bidirectionally
   */
  async syncContacts(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Get watermark for incremental sync
      const watermark = options.fullSync
        ? null
        : await this.getWatermark(options.orgId, 'contacts');

      // Step 1: Push local changes to Google
      const pushResult = await this.pushContactsToGoogle(options);
      result.created += pushResult.created;
      result.updated += pushResult.updated;
      result.errors.push(...pushResult.errors);

      // Step 2: Pull changes from Google
      const pullResult = await this.pullContactsFromGoogle(options, watermark?.syncToken);
      result.created += pullResult.created;
      result.updated += pullResult.updated;
      result.conflicts += pullResult.conflicts;
      result.errors.push(...pullResult.errors);

      // Update watermark (always update timestamp, optionally sync token)
      await this.updateWatermark(
        options.orgId,
        'contacts',
        pullResult.nextSyncToken,
        options.fullSync
      );

      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Push local clients to Google Contacts
   */
  private async pushContactsToGoogle(
    options: SyncOptions
  ): Promise<SyncResult & { nextSyncToken?: string }> {
    const result: SyncResult & { nextSyncToken?: string } = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
    };

    // Get clients that need syncing (no google_contact_id or modified since last sync)
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, email, phone, company, google_contact_id, google_contact_etag, updated_at')
      .eq('org_id', options.orgId);

    if (error) {
      result.errors.push(`Failed to fetch clients: ${error.message}`);
      return result;
    }

    for (const client of clients || []) {
      try {
        if (!client.google_contact_id) {
          // Create new contact in Google
          const createResult = await contactsService.createContact({
            name: client.name,
            email: client.email,
            phone: client.phone,
            company: client.company,
          });

          if (createResult.success && createResult.googleContactId) {
            // Update local record with Google ID
            await supabase
              .from('clients')
              .update({
                google_contact_id: createResult.googleContactId,
                google_contact_etag: createResult.etag,
                google_last_synced_at: new Date().toISOString(),
              })
              .eq('id', client.id);

            result.created++;

            await this.logSync({
              orgId: options.orgId,
              entityType: 'contact',
              entityId: client.id,
              googleId: createResult.googleContactId,
              syncDirection: 'to_google',
              syncStatus: 'success',
              localData: { name: client.name, email: client.email },
            });
          } else {
            result.errors.push(`Failed to create contact for ${client.name}: ${createResult.error}`);
          }
        } else {
          // Update existing contact
          const updateResult = await contactsService.updateContact(
            client.google_contact_id,
            {
              name: client.name,
              email: client.email,
              phone: client.phone,
              company: client.company,
            },
            client.google_contact_etag
          );

          if (updateResult.success) {
            await supabase
              .from('clients')
              .update({
                google_contact_etag: updateResult.etag,
                google_last_synced_at: new Date().toISOString(),
              })
              .eq('id', client.id);

            result.updated++;
          } else if (updateResult.error?.includes('etag')) {
            // Conflict detected
            result.conflicts++;
          } else {
            result.errors.push(`Failed to update contact for ${client.name}: ${updateResult.error}`);
          }
        }
      } catch (error: any) {
        result.errors.push(`Error syncing ${client.name}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Pull contacts from Google to local
   */
  private async pullContactsFromGoogle(
    options: SyncOptions,
    syncToken?: string
  ): Promise<SyncResult & { nextSyncToken?: string }> {
    const result: SyncResult & { nextSyncToken?: string } = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Fetch contacts from Google
      const { contacts, nextSyncToken } = await contactsService.listContacts(
        1000,
        undefined,
        syncToken
      );

      result.nextSyncToken = nextSyncToken;

      for (const contact of contacts) {
        try {
          const mapping = contactsService.contactToClientMapping(contact);

          // Check if we already have this contact
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id, name, email, phone, company, google_contact_etag, updated_at')
            .eq('org_id', options.orgId)
            .eq('google_contact_id', mapping.googleContactId)
            .maybeSingle();

          if (existingClient) {
            // Check for conflicts using etag
            if (existingClient.google_contact_etag !== mapping.googleContactEtag) {
              // Contact was modified in Google
              const shouldUpdate = this.resolveConflict(
                options.conflictResolution || 'newest_wins',
                existingClient.updated_at,
                contact.metadata?.sources?.[0]?.updateTime
              );

              if (shouldUpdate === 'google') {
                await supabase
                  .from('clients')
                  .update({
                    name: mapping.name,
                    email: mapping.email,
                    phone: mapping.phone,
                    company: mapping.company,
                    google_contact_etag: mapping.googleContactEtag,
                    google_last_synced_at: new Date().toISOString(),
                  })
                  .eq('id', existingClient.id);

                result.updated++;

                await this.logSync({
                  orgId: options.orgId,
                  entityType: 'contact',
                  entityId: existingClient.id,
                  googleId: mapping.googleContactId,
                  syncDirection: 'from_google',
                  syncStatus: 'success',
                  conflictResolution: 'google_wins',
                  googleData: mapping as unknown as Record<string, unknown>,
                });
              } else {
                result.conflicts++;
              }
            }
          } else if (mapping.email) {
            // Check if client exists by email (not yet linked)
            const { data: emailMatch } = await supabase
              .from('clients')
              .select('id')
              .eq('org_id', options.orgId)
              .eq('email', mapping.email)
              .is('google_contact_id', null)
              .maybeSingle();

            if (emailMatch) {
              // Link existing client to Google contact
              await supabase
                .from('clients')
                .update({
                  google_contact_id: mapping.googleContactId,
                  google_contact_etag: mapping.googleContactEtag,
                  google_last_synced_at: new Date().toISOString(),
                })
                .eq('id', emailMatch.id);

              result.updated++;
            } else {
              // Create new client from Google contact
              const { error: insertError } = await supabase.from('clients').insert({
                org_id: options.orgId,
                name: mapping.name,
                email: mapping.email,
                phone: mapping.phone,
                company: mapping.company,
                status: 'Lead',
                google_contact_id: mapping.googleContactId,
                google_contact_etag: mapping.googleContactEtag,
                google_last_synced_at: new Date().toISOString(),
              });

              if (!insertError) {
                result.created++;

                await this.logSync({
                  orgId: options.orgId,
                  entityType: 'contact',
                  entityId: mapping.googleContactId,
                  googleId: mapping.googleContactId,
                  syncDirection: 'from_google',
                  syncStatus: 'success',
                  googleData: mapping as unknown as Record<string, unknown>,
                });
              }
            }
          }
        } catch (error: any) {
          result.errors.push(`Error processing Google contact: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Failed to fetch Google contacts: ${error.message}`);
    }

    return result;
  }

  /**
   * Resolve sync conflict based on strategy
   */
  private resolveConflict(
    strategy: ConflictResolution,
    localUpdatedAt?: string,
    googleUpdatedAt?: string
  ): 'local' | 'google' {
    switch (strategy) {
      case 'local_wins':
        return 'local';
      case 'google_wins':
        return 'google';
      case 'newest_wins':
      default:
        if (!localUpdatedAt) return 'google';
        if (!googleUpdatedAt) return 'local';
        return new Date(localUpdatedAt) > new Date(googleUpdatedAt) ? 'local' : 'google';
    }
  }

  /**
   * Emit a real-time event for sync updates
   */
  async emitSyncEvent(
    orgId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      await supabase.from('realtime_events').insert({
        org_id: orgId,
        event_type: eventType,
        event_data: eventData,
      });
    } catch (error: any) {
      console.error('Failed to emit sync event:', error.message);
    }
  }

  /**
   * Get sync status for dashboard
   */
  async getSyncStatus(orgId: string): Promise<{
    contacts: SyncWatermark | null;
    calendar: SyncWatermark | null;
    tasks: SyncWatermark | null;
    drive: SyncWatermark | null;
    recentLogs: Array<{
      entityType: string;
      syncDirection: string;
      syncStatus: string;
      syncedAt: string;
    }>;
  }> {
    const [contacts, calendar, tasks, drive] = await Promise.all([
      this.getWatermark(orgId, 'contacts'),
      this.getWatermark(orgId, 'calendar'),
      this.getWatermark(orgId, 'tasks'),
      this.getWatermark(orgId, 'drive'),
    ]);

    // Get recent sync logs
    const { data: logs } = await supabase
      .from('google_sync_log')
      .select('entity_type, sync_direction, sync_status, synced_at')
      .eq('org_id', orgId)
      .order('synced_at', { ascending: false })
      .limit(20);

    return {
      contacts,
      calendar,
      tasks,
      drive,
      recentLogs: (logs || []).map((l) => ({
        entityType: l.entity_type,
        syncDirection: l.sync_direction,
        syncStatus: l.sync_status,
        syncedAt: l.synced_at,
      })),
    };
  }
}

export const syncEngine = SyncEngine.getInstance();
