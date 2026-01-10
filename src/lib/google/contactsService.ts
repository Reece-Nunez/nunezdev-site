// Google Contacts Service (People API)
// Bidirectional sync between NunezDev clients and Google Contacts

import { googleServiceFactory } from './googleServiceFactory';
import type {
  GoogleContact,
  ContactCreateInput,
  ContactSyncResult,
  ContactToClientMapping,
} from './types';

class ContactsService {
  private static instance: ContactsService;

  static getInstance(): ContactsService {
    if (!ContactsService.instance) {
      ContactsService.instance = new ContactsService();
    }
    return ContactsService.instance;
  }

  private async getClient() {
    return googleServiceFactory.getPeopleClient();
  }

  /**
   * Create a new contact in Google Contacts
   */
  async createContact(input: ContactCreateInput): Promise<ContactSyncResult> {
    try {
      const people = await this.getClient();
      if (!people) {
        return { success: false, error: 'Google Contacts not available' };
      }

      // Parse name into given/family name
      const nameParts = input.name.trim().split(' ');
      const givenName = nameParts[0] || '';
      const familyName = nameParts.slice(1).join(' ') || '';

      // Build contact resource
      const contactResource: any = {
        names: [
          {
            givenName,
            familyName,
            displayName: input.name,
          },
        ],
      };

      if (input.email) {
        contactResource.emailAddresses = [
          { value: input.email, type: 'work' },
        ];
      }

      if (input.phone) {
        contactResource.phoneNumbers = [
          { value: input.phone, type: 'work' },
        ];
      }

      if (input.company) {
        contactResource.organizations = [
          { name: input.company },
        ];
      }

      const response = await people.people.createContact({
        requestBody: contactResource,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,metadata',
      });

      const resourceName = response.data.resourceName;
      // Extract the contact ID from resourceName (format: "people/c1234567890")
      const googleContactId = resourceName?.replace('people/', '') || '';

      console.log(`Created Google Contact: ${resourceName}`);

      return {
        success: true,
        googleContactId,
        etag: response.data.etag,
      };
    } catch (error: any) {
      console.error('Failed to create Google Contact:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing contact in Google Contacts
   */
  async updateContact(
    googleContactId: string,
    input: ContactCreateInput,
    currentEtag?: string
  ): Promise<ContactSyncResult> {
    try {
      const people = await this.getClient();
      if (!people) {
        return { success: false, error: 'Google Contacts not available' };
      }

      const resourceName = googleContactId.startsWith('people/')
        ? googleContactId
        : `people/${googleContactId}`;

      // Parse name
      const nameParts = input.name.trim().split(' ');
      const givenName = nameParts[0] || '';
      const familyName = nameParts.slice(1).join(' ') || '';

      // Build update resource
      const contactResource: any = {
        etag: currentEtag,
        names: [
          {
            givenName,
            familyName,
            displayName: input.name,
          },
        ],
        emailAddresses: input.email ? [{ value: input.email, type: 'work' }] : [],
        phoneNumbers: input.phone ? [{ value: input.phone, type: 'work' }] : [],
        organizations: input.company ? [{ name: input.company }] : [],
      };

      const response = await people.people.updateContact({
        resourceName,
        updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations',
        requestBody: contactResource,
      });

      console.log(`Updated Google Contact: ${resourceName}`);

      return {
        success: true,
        googleContactId: googleContactId.replace('people/', ''),
        etag: response.data.etag,
      };
    } catch (error: any) {
      console.error('Failed to update Google Contact:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a contact from Google Contacts
   */
  async deleteContact(googleContactId: string): Promise<ContactSyncResult> {
    try {
      const people = await this.getClient();
      if (!people) {
        return { success: false, error: 'Google Contacts not available' };
      }

      const resourceName = googleContactId.startsWith('people/')
        ? googleContactId
        : `people/${googleContactId}`;

      await people.people.deleteContact({
        resourceName,
      });

      console.log(`Deleted Google Contact: ${resourceName}`);

      return { success: true };
    } catch (error: any) {
      console.error('Failed to delete Google Contact:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single contact by ID
   */
  async getContact(googleContactId: string): Promise<GoogleContact | null> {
    try {
      const people = await this.getClient();
      if (!people) return null;

      const resourceName = googleContactId.startsWith('people/')
        ? googleContactId
        : `people/${googleContactId}`;

      const response = await people.people.get({
        resourceName,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,metadata',
      });

      return response.data as GoogleContact;
    } catch (error: any) {
      console.error('Failed to get Google Contact:', error.message);
      return null;
    }
  }

  /**
   * List all contacts (with pagination)
   */
  async listContacts(
    pageSize: number = 100,
    pageToken?: string,
    syncToken?: string
  ): Promise<{
    contacts: GoogleContact[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }> {
    try {
      const people = await this.getClient();
      if (!people) {
        return { contacts: [] };
      }

      const params: any = {
        resourceName: 'people/me',
        personFields: 'names,emailAddresses,phoneNumbers,organizations,metadata',
        pageSize,
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await people.people.connections.list(params);

      const contacts = (response.data.connections || []) as GoogleContact[];

      return {
        contacts,
        nextPageToken: response.data.nextPageToken,
        nextSyncToken: response.data.nextSyncToken,
      };
    } catch (error: any) {
      // Handle sync token expiration
      if (error.code === 410) {
        console.log('Sync token expired, performing full sync');
        return this.listContacts(pageSize, undefined, undefined);
      }
      console.error('Failed to list Google Contacts:', error.message);
      return { contacts: [] };
    }
  }

  /**
   * Search contacts by query (name or email)
   */
  async searchContacts(query: string): Promise<GoogleContact[]> {
    try {
      const people = await this.getClient();
      if (!people) return [];

      const response = await people.people.searchContacts({
        query,
        readMask: 'names,emailAddresses,phoneNumbers,organizations',
        pageSize: 30,
      });

      return (response.data.results || []).map((r: any) => r.person) as GoogleContact[];
    } catch (error: any) {
      console.error('Failed to search Google Contacts:', error.message);
      return [];
    }
  }

  /**
   * Find a contact by email address
   */
  async findByEmail(email: string): Promise<GoogleContact | null> {
    try {
      const contacts = await this.searchContacts(email);
      return (
        contacts.find((c) =>
          c.emailAddresses?.some(
            (e) => e.value.toLowerCase() === email.toLowerCase()
          )
        ) || null
      );
    } catch (error: any) {
      console.error('Failed to find contact by email:', error.message);
      return null;
    }
  }

  /**
   * Convert Google Contact to client mapping format
   */
  contactToClientMapping(contact: GoogleContact): ContactToClientMapping {
    const name =
      contact.names?.[0]?.displayName ||
      `${contact.names?.[0]?.givenName || ''} ${contact.names?.[0]?.familyName || ''}`.trim() ||
      'Unknown';

    return {
      googleContactId: contact.resourceName.replace('people/', ''),
      googleContactEtag: contact.etag,
      name,
      email: contact.emailAddresses?.[0]?.value || null,
      phone: contact.phoneNumbers?.[0]?.value || null,
      company: contact.organizations?.[0]?.name || null,
    };
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return googleServiceFactory.isAvailable();
  }
}

export const contactsService = ContactsService.getInstance();
