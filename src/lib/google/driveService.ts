// Google Drive Service
// File storage and management for client documents

import { googleServiceFactory } from './googleServiceFactory';
import type { DriveFile, DriveFolder, DriveUploadResult } from './types';
import { Readable } from 'stream';

// Root folder name for all NunezDev documents
const ROOT_FOLDER_NAME = 'NunezDev';
const CLIENTS_FOLDER_NAME = 'Clients';

class DriveService {
  private static instance: DriveService;
  private rootFolderId: string | null = null;
  private clientsFolderId: string | null = null;

  static getInstance(): DriveService {
    if (!DriveService.instance) {
      DriveService.instance = new DriveService();
    }
    return DriveService.instance;
  }

  private async getClient() {
    return googleServiceFactory.getDriveClient();
  }

  /**
   * Ensure the root folder structure exists: /NunezDev/Clients/
   */
  async ensureRootFolders(): Promise<{ rootId: string; clientsId: string } | null> {
    try {
      if (this.rootFolderId && this.clientsFolderId) {
        return { rootId: this.rootFolderId, clientsId: this.clientsFolderId };
      }

      const drive = await this.getClient();
      if (!drive) return null;

      // Find or create NunezDev folder
      this.rootFolderId = await this.findOrCreateFolder(ROOT_FOLDER_NAME);
      if (!this.rootFolderId) return null;

      // Find or create Clients subfolder
      this.clientsFolderId = await this.findOrCreateFolder(
        CLIENTS_FOLDER_NAME,
        this.rootFolderId
      );
      if (!this.clientsFolderId) return null;

      console.log(`Drive folders ready: /NunezDev/Clients/`);

      return { rootId: this.rootFolderId, clientsId: this.clientsFolderId };
    } catch (error: any) {
      console.error('Failed to ensure root folders:', error.message);
      return null;
    }
  }

  /**
   * Find or create a folder by name
   */
  private async findOrCreateFolder(
    name: string,
    parentId?: string
  ): Promise<string | null> {
    try {
      const drive = await this.getClient();
      if (!drive) return null;

      // Search for existing folder
      let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      const searchResponse = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (searchResponse.data.files?.length > 0) {
        return searchResponse.data.files[0].id;
      }

      // Create new folder
      const createResponse = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId ? [parentId] : undefined,
        },
        fields: 'id',
      });

      console.log(`Created folder: ${name}`);
      return createResponse.data.id;
    } catch (error: any) {
      console.error(`Failed to find/create folder ${name}:`, error.message);
      return null;
    }
  }

  /**
   * Ensure a client-specific folder exists: /NunezDev/Clients/{ClientName}/
   */
  async ensureClientFolder(clientName: string): Promise<string | null> {
    try {
      const roots = await this.ensureRootFolders();
      if (!roots) return null;

      // Sanitize client name for folder
      const safeName = clientName.replace(/[<>:"/\\|?*]/g, '-');

      return this.findOrCreateFolder(safeName, roots.clientsId);
    } catch (error: any) {
      console.error(`Failed to ensure client folder for ${clientName}:`, error.message);
      return null;
    }
  }

  /**
   * Upload a file to a specific folder
   */
  async uploadFile(
    fileName: string,
    mimeType: string,
    content: Buffer | Readable,
    folderId: string
  ): Promise<DriveUploadResult> {
    try {
      const drive = await this.getClient();
      if (!drive) {
        return { success: false, error: 'Google Drive not available' };
      }

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType,
          body: content instanceof Buffer ? Readable.from(content) : content,
        },
        fields: 'id, webViewLink, webContentLink',
      });

      console.log(`Uploaded file: ${fileName} (${response.data.id})`);

      return {
        success: true,
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
      };
    } catch (error: any) {
      console.error('Failed to upload file:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload a file to a client's folder
   */
  async uploadToClientFolder(
    clientName: string,
    fileName: string,
    mimeType: string,
    content: Buffer | Readable
  ): Promise<DriveUploadResult> {
    const folderId = await this.ensureClientFolder(clientName);
    if (!folderId) {
      return { success: false, error: 'Failed to create client folder' };
    }

    return this.uploadFile(fileName, mimeType, content, folderId);
  }

  /**
   * List files in a folder
   */
  async listFiles(
    folderId: string,
    pageSize: number = 100,
    pageToken?: string
  ): Promise<{
    files: DriveFile[];
    nextPageToken?: string;
  }> {
    try {
      const drive = await this.getClient();
      if (!drive) {
        return { files: [] };
      }

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)',
        pageSize,
        pageToken,
        orderBy: 'modifiedTime desc',
      });

      return {
        files: (response.data.files || []) as DriveFile[],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error: any) {
      console.error('Failed to list files:', error.message);
      return { files: [] };
    }
  }

  /**
   * List files for a specific client
   */
  async listClientFiles(clientName: string): Promise<DriveFile[]> {
    const folderId = await this.ensureClientFolder(clientName);
    if (!folderId) return [];

    const result = await this.listFiles(folderId);
    return result.files;
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<DriveFile | null> {
    try {
      const drive = await this.getClient();
      if (!drive) return null;

      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, parents, createdTime, modifiedTime',
      });

      return response.data as DriveFile;
    } catch (error: any) {
      console.error('Failed to get file:', error.message);
      return null;
    }
  }

  /**
   * Download a file's content
   */
  async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      const drive = await this.getClient();
      if (!drive) return null;

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error: any) {
      console.error('Failed to download file:', error.message);
      return null;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const drive = await this.getClient();
      if (!drive) return false;

      await drive.files.delete({ fileId });
      console.log(`Deleted file: ${fileId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to delete file:', error.message);
      return false;
    }
  }

  /**
   * Move file to trash (recoverable)
   */
  async trashFile(fileId: string): Promise<boolean> {
    try {
      const drive = await this.getClient();
      if (!drive) return false;

      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
      });

      console.log(`Trashed file: ${fileId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to trash file:', error.message);
      return false;
    }
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, newName: string): Promise<boolean> {
    try {
      const drive = await this.getClient();
      if (!drive) return false;

      await drive.files.update({
        fileId,
        requestBody: { name: newName },
      });

      console.log(`Renamed file ${fileId} to: ${newName}`);
      return true;
    } catch (error: any) {
      console.error('Failed to rename file:', error.message);
      return false;
    }
  }

  /**
   * Move a file to a different folder
   */
  async moveFile(fileId: string, newFolderId: string): Promise<boolean> {
    try {
      const drive = await this.getClient();
      if (!drive) return false;

      // Get current parents
      const file = await this.getFile(fileId);
      if (!file) return false;

      const previousParents = file.parents?.join(',') || '';

      await drive.files.update({
        fileId,
        addParents: newFolderId,
        removeParents: previousParents,
      });

      console.log(`Moved file ${fileId} to folder ${newFolderId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to move file:', error.message);
      return false;
    }
  }

  /**
   * Search for files
   */
  async searchFiles(query: string, maxResults: number = 50): Promise<DriveFile[]> {
    try {
      const drive = await this.getClient();
      if (!drive) return [];

      const response = await drive.files.list({
        q: `name contains '${query}' and trashed=false`,
        fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)',
        pageSize: maxResults,
        orderBy: 'modifiedTime desc',
      });

      return (response.data.files || []) as DriveFile[];
    } catch (error: any) {
      console.error('Failed to search files:', error.message);
      return [];
    }
  }

  /**
   * Get storage quota info
   */
  async getStorageInfo(): Promise<{
    limit: number;
    usage: number;
    usageInDrive: number;
  } | null> {
    try {
      const drive = await this.getClient();
      if (!drive) return null;

      const response = await drive.about.get({
        fields: 'storageQuota',
      });

      const quota = response.data.storageQuota;
      return {
        limit: parseInt(quota.limit || '0', 10),
        usage: parseInt(quota.usage || '0', 10),
        usageInDrive: parseInt(quota.usageInDrive || '0', 10),
      };
    } catch (error: any) {
      console.error('Failed to get storage info:', error.message);
      return null;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return googleServiceFactory.isAvailable();
  }
}

export const driveService = DriveService.getInstance();
