// Google Sheets Service
// Export data to Google Sheets

import { googleServiceFactory } from './googleServiceFactory';
import type { SheetExportResult, SheetData } from './types';

class SheetsService {
  private static instance: SheetsService;

  static getInstance(): SheetsService {
    if (!SheetsService.instance) {
      SheetsService.instance = new SheetsService();
    }
    return SheetsService.instance;
  }

  private async getClient() {
    return googleServiceFactory.getSheetsClient();
  }

  private async getDriveClient() {
    return googleServiceFactory.getDriveClient();
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(
    title: string,
    sheetTitles: string[] = ['Sheet1']
  ): Promise<SheetExportResult> {
    try {
      const sheets = await this.getClient();
      if (!sheets) {
        return { success: false, error: 'Google Sheets not available' };
      }

      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: sheetTitles.map((sheetTitle) => ({
            properties: { title: sheetTitle },
          })),
        },
      });

      console.log(`Created spreadsheet: ${title}`);

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
      };
    } catch (error: any) {
      console.error('Failed to create spreadsheet:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Write data to a spreadsheet
   */
  async writeData(
    spreadsheetId: string,
    range: string,
    data: SheetData
  ): Promise<boolean> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return false;

      // Combine headers and rows
      const values = [data.headers, ...data.rows];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });

      console.log(`Wrote ${data.rows.length} rows to ${range}`);
      return true;
    } catch (error: any) {
      console.error('Failed to write data:', error.message);
      return false;
    }
  }

  /**
   * Append data to a spreadsheet
   */
  async appendData(
    spreadsheetId: string,
    range: string,
    rows: (string | number | boolean | null)[][]
  ): Promise<boolean> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return false;

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows },
      });

      console.log(`Appended ${rows.length} rows to ${range}`);
      return true;
    } catch (error: any) {
      console.error('Failed to append data:', error.message);
      return false;
    }
  }

  /**
   * Read data from a spreadsheet
   */
  async readData(
    spreadsheetId: string,
    range: string
  ): Promise<(string | number | boolean | null)[][] | null> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return null;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error: any) {
      console.error('Failed to read data:', error.message);
      return null;
    }
  }

  /**
   * Clear a range in a spreadsheet
   */
  async clearRange(spreadsheetId: string, range: string): Promise<boolean> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return false;

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });

      console.log(`Cleared range: ${range}`);
      return true;
    } catch (error: any) {
      console.error('Failed to clear range:', error.message);
      return false;
    }
  }

  /**
   * Export clients to a new spreadsheet
   */
  async exportClients(
    clients: Array<{
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      status: string;
      totalInvoiced: number;
      totalPaid: number;
      balance: number;
    }>
  ): Promise<SheetExportResult> {
    const title = `NunezDev Clients Export - ${new Date().toLocaleDateString()}`;

    // Create spreadsheet
    const createResult = await this.createSpreadsheet(title, ['Clients']);
    if (!createResult.success || !createResult.spreadsheetId) {
      return createResult;
    }

    // Prepare data
    const data: SheetData = {
      headers: [
        'Name',
        'Email',
        'Phone',
        'Company',
        'Status',
        'Total Invoiced',
        'Total Paid',
        'Balance Due',
      ],
      rows: clients.map((c) => [
        c.name,
        c.email || '',
        c.phone || '',
        c.company || '',
        c.status,
        c.totalInvoiced / 100, // Convert cents to dollars
        c.totalPaid / 100,
        c.balance / 100,
      ]),
    };

    // Write data
    const writeSuccess = await this.writeData(
      createResult.spreadsheetId,
      'Clients!A1',
      data
    );

    if (!writeSuccess) {
      return { success: false, error: 'Failed to write client data' };
    }

    // Format the spreadsheet
    await this.formatExportSheet(createResult.spreadsheetId);

    return createResult;
  }

  /**
   * Export invoices to a new spreadsheet
   */
  async exportInvoices(
    invoices: Array<{
      invoiceNumber: string;
      clientName: string;
      status: string;
      issuedAt: string | null;
      dueAt: string | null;
      totalCents: number;
      paidCents: number;
      balanceCents: number;
    }>
  ): Promise<SheetExportResult> {
    const title = `NunezDev Invoices Export - ${new Date().toLocaleDateString()}`;

    // Create spreadsheet
    const createResult = await this.createSpreadsheet(title, ['Invoices']);
    if (!createResult.success || !createResult.spreadsheetId) {
      return createResult;
    }

    // Prepare data
    const data: SheetData = {
      headers: [
        'Invoice #',
        'Client',
        'Status',
        'Issued Date',
        'Due Date',
        'Total',
        'Paid',
        'Balance',
      ],
      rows: invoices.map((i) => [
        i.invoiceNumber,
        i.clientName,
        i.status,
        i.issuedAt || '',
        i.dueAt || '',
        i.totalCents / 100,
        i.paidCents / 100,
        i.balanceCents / 100,
      ]),
    };

    // Write data
    const writeSuccess = await this.writeData(
      createResult.spreadsheetId,
      'Invoices!A1',
      data
    );

    if (!writeSuccess) {
      return { success: false, error: 'Failed to write invoice data' };
    }

    // Format the spreadsheet
    await this.formatExportSheet(createResult.spreadsheetId);

    return createResult;
  }

  /**
   * Apply basic formatting to export sheets
   */
  private async formatExportSheet(spreadsheetId: string): Promise<boolean> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return false;

      // Get the sheet ID (first sheet)
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId;
      if (sheetId === undefined) return false;

      // Apply formatting: bold header row, freeze first row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            // Bold the header row
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
            // Freeze header row
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            // Auto-resize columns
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 10,
                },
              },
            },
          ],
        },
      });

      return true;
    } catch (error: any) {
      console.error('Failed to format sheet:', error.message);
      return false;
    }
  }

  /**
   * Move a spreadsheet to a specific Drive folder
   */
  async moveToFolder(spreadsheetId: string, folderId: string): Promise<boolean> {
    try {
      const drive = await this.getDriveClient();
      if (!drive) return false;

      // Get current parents
      const file = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'parents',
      });

      const previousParents = file.data.parents?.join(',') || '';

      // Move to new folder
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: folderId,
        removeParents: previousParents,
      });

      console.log(`Moved spreadsheet to folder: ${folderId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to move spreadsheet:', error.message);
      return false;
    }
  }

  /**
   * Get spreadsheet info
   */
  async getSpreadsheet(spreadsheetId: string): Promise<{
    title: string;
    sheets: string[];
    url: string;
  } | null> {
    try {
      const sheets = await this.getClient();
      if (!sheets) return null;

      const response = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      return {
        title: response.data.properties?.title || '',
        sheets:
          response.data.sheets?.map((s: any) => s.properties?.title || '') || [],
        url: response.data.spreadsheetUrl || '',
      };
    } catch (error: any) {
      console.error('Failed to get spreadsheet:', error.message);
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

export const sheetsService = SheetsService.getInstance();
