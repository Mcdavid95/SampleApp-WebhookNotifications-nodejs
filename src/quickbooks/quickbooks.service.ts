import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as queryString from 'query-string';
import * as request from 'request';
const QuickBooks = require('node-quickbooks');
import * as json2csv from 'json2csv';
import * as Tokens from 'csrf';
import { QuickBooksConfig, WebhookEventNotification, NotificationRecord } from '../types/quickbooks.types';
import { FirsService, FirsCompanyConfig } from '../firs/firs.service';
import { FirsApiResponse, FirsParty } from '../types/firs.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class QuickBooksService {
  private config: QuickBooksConfig;
  private tokenJson: string;
  private realmId: string;
  private webhookPayload: any;
  private csrf = new (Tokens as any)();
  private readonly logger = new Logger(QuickBooksService.name);

  constructor(
    private readonly firsService: FirsService,
    private readonly supabaseService: SupabaseService
  ) {
    this.loadConfig();
    this.loadTokensFromFile();
  }

  // Method to manually set tokens for testing (if you have valid ones)
  setTokensForTesting(accessToken: string, refreshToken: string, realmId: string) {
    const tokenData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
      created_at: Date.now()
    };
    this.tokenJson = JSON.stringify(tokenData, null, 2);
    this.realmId = realmId;
    this.saveTokensToFile(tokenData, realmId);
    this.logger.log('Tokens set for testing - webhook will now fetch full data');
  }

  private loadTokensFromFile() {
    try {
      const tokenPath = path.join(process.cwd(), 'tokens.json');
      if (fs.existsSync(tokenPath)) {
        const tokenFile = fs.readFileSync(tokenPath, 'utf8');
        const tokenData = JSON.parse(tokenFile);

        // Check if tokens are still valid (within expiry)
        if (this.areTokensValid(tokenData.tokens)) {
          this.tokenJson = JSON.stringify(tokenData.tokens, null, 2);
          this.realmId = tokenData.realmId;
          this.logger.log('Loaded valid tokens from file');
        } else {
          this.logger.log('Stored tokens are expired, will need to refresh');
          // Try to refresh the tokens
          this.refreshStoredTokens(tokenData);
        }
      } else {
        this.logger.log('No stored tokens found');
      }
    } catch (error) {
      this.logger.error('Error loading tokens from file:', error.message);
    }
  }

  private saveTokensToFile(tokens: any, realmId: string) {
    try {
      const tokenPath = path.join(process.cwd(), 'tokens.json');
      const tokenData = {
        tokens: tokens,
        realmId: realmId,
        saved_at: new Date().toISOString()
      };
      fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
      this.logger.log('Tokens saved to file');
    } catch (error) {
      this.logger.error('Error saving tokens to file:', error.message);
    }
  }

  private areTokensValid(tokens: any): boolean {
    if (!tokens || !tokens.created_at || !tokens.expires_in) {
      return false;
    }

    const expiryTime = tokens.created_at + (tokens.expires_in * 1000);
    const currentTime = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    return currentTime < (expiryTime - bufferTime);
  }

  private async refreshStoredTokens(tokenData: any) {
    if (!tokenData.tokens.refresh_token) {
      this.logger.log('No refresh token available, need new OAuth flow');
      return;
    }

    try {
      this.logger.log('Attempting to refresh expired tokens...');
      const refreshedTokens = await this.refreshAccessToken(tokenData.tokens.refresh_token);

      if (refreshedTokens) {
        this.tokenJson = JSON.stringify(refreshedTokens, null, 2);
        this.realmId = tokenData.realmId;
        this.saveTokensToFile(refreshedTokens, tokenData.realmId);
        this.logger.log('Successfully refreshed tokens');
      }
    } catch (error) {
      this.logger.error('Failed to refresh tokens:', error.message);
      this.logger.log('Will need new OAuth flow');
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<any> {
    const auth = Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64');
    const postBody = {
      url: this.config.token_endpoint,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + auth,
      },
      form: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }
    };

    return new Promise((resolve, reject) => {
      request.post(postBody, (err: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Token refresh failed with status ${res.statusCode}: ${res.body}`));
          return;
        }

        const accessToken = JSON.parse(res.body);
        accessToken.created_at = Date.now();
        resolve(accessToken);
      });
    });
  }

  private loadConfig() {
    const configPath = path.join(process.cwd(), 'config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configFile);
  }

  getTokenJson(): string {
    return this.tokenJson;
  }

  getWebhookPayload(): any {
    return this.webhookPayload;
  }

  generateAuthUrl(session: any): string {
    session.secret = this.csrf.secretSync();
    const state = this.csrf.create(session.secret);

    const redirecturl = this.config.authorization_endpoint +
      '?client_id=' + this.config.clientId +
      '&redirect_uri=' + encodeURIComponent(this.config.redirectUri) +
      '&scope=' + this.config.scopes.connect_to_quickbooks[0] +
      '&response_type=code' +
      '&state=' + state;

    return redirecturl;
  }

  async handleCallback(req: Request): Promise<void> {
    const parsedUri = queryString.parse(req.originalUrl);
    this.realmId = parsedUri.realmId as string;

    const auth = Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64');
    const postBody = {
      url: this.config.token_endpoint,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + auth,
      },
      form: {
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: this.config.redirectUri
      }
    };

    return new Promise((resolve, reject) => {
      request.post(postBody, (err: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`OAuth callback failed with status ${res.statusCode}: ${res.body}`));
          return;
        }

        const accessToken = JSON.parse(res.body);
        accessToken.created_at = Date.now(); // Add timestamp for expiry tracking

        this.tokenJson = JSON.stringify(accessToken, null, 2);
        this.saveTokensToFile(accessToken, this.realmId);

        this.logger.log('OAuth flow completed successfully - tokens saved');
        resolve();
      });
    });
  }

  async handleWebhook(req: Request, body: WebhookEventNotification): Promise<{ status: number; message: string }> {
    const webhookPayload = JSON.stringify(body);
    const signature = req.get('intuit-signature');

    if (!signature) {
      return { status: 401, message: 'FORBIDDEN' };
    }

    if (!webhookPayload) {
      return { status: 200, message: 'success' };
    }

    const hash = crypto.createHmac('sha256', this.config.webhooksVerifier)
      .update(webhookPayload)
      .digest('base64');

    if (signature === hash) {
      await this.processWebhookNotifications(body);
      return { status: 200, message: 'SUCCESS' };
    }

    return { status: 401, message: 'FORBIDDEN' };
  }

  private async ensureValidTokens(): Promise<void> {
    if (!this.tokenJson) {
      this.logger.log('No tokens available, cannot fetch entity data');
      return;
    }

    try {
      const currentTokens = JSON.parse(this.tokenJson);

      // Check if current tokens are still valid
      if (!this.areTokensValid(currentTokens)) {
        this.logger.log('Current tokens are expired, attempting refresh...');

        if (currentTokens.refresh_token) {
          const refreshedTokens = await this.refreshAccessToken(currentTokens.refresh_token);
          if (refreshedTokens) {
            this.tokenJson = JSON.stringify(refreshedTokens, null, 2);
            this.saveTokensToFile(refreshedTokens, this.realmId);
            this.logger.log('Tokens refreshed successfully');
          } else {
            this.logger.log('Token refresh failed, will skip API calls');
            this.tokenJson = null;
          }
        } else {
          this.logger.log('No refresh token available, need new OAuth flow');
          this.tokenJson = null;
        }
      } else {
        this.logger.log('Current tokens are still valid');
      }
    } catch (error) {
      this.logger.error('Error validating tokens:', error.message);
      this.tokenJson = null;
    }
  }

  private async processWebhookNotifications(body: WebhookEventNotification): Promise<void> {
    const enrichedNotifications: NotificationRecord[] = [];

    for (const eventNotification of body.eventNotifications) {
      const entities = eventNotification.dataChangeEvent.entities;
      const realmID = eventNotification.realmId;

      for (const entity of entities) {
        const baseNotification: NotificationRecord = {
          realmId: realmID,
          name: entity.name,
          id: entity.id,
          operation: entity.operation,
          lastUpdated: entity.lastUpdated,
          entityType: entity.name,
          fetchStatus: 'skipped'
        };

        // Ensure we have valid tokens before attempting API calls
        await this.ensureValidTokens();

        // Only fetch full data for non-delete operations
        if (entity.operation !== 'Delete' && this.tokenJson) {
          try {
            const fullData = await this.fetchEntityData(entity.name, entity.id, realmID);
            baseNotification.fullData = fullData;
            baseNotification.fetchStatus = 'success';
            this.logger.log(`Successfully fetched full data for ${entity.name} ID: ${entity.id}`);

            // Submit to FIRS if this is an Invoice
            if (entity.name === 'Invoice') {
              await this.submitInvoiceToFirs(fullData, entity.operation, realmID);
            }
          } catch (error) {
            baseNotification.fetchStatus = 'failed';
            baseNotification.errorMessage = error.message;
            this.logger.error(`Failed to fetch full data for ${entity.name} ID: ${entity.id}`, error.message);
          }
        } else if (entity.operation === 'Delete') {
          baseNotification.fetchStatus = 'skipped';
          this.logger.log(`Skipped fetching data for deleted ${entity.name} ID: ${entity.id}`);

          // Handle deleted invoices in FIRS
          if (entity.name === 'Invoice') {
            await this.handleDeletedInvoiceInFirs(entity.id);
          }
        }

        enrichedNotifications.push(baseNotification);
        this.logger.log('Enriched notification:', baseNotification);
      }
    }

    await this.writeEnrichedNotificationsToCsv(enrichedNotifications);
  }

  private async fetchEntityData(entityName: string, entityId: string, realmId: string): Promise<any> {
    if (!this.tokenJson) {
      throw new Error('No access token available');
    }

    const token = JSON.parse(this.tokenJson);
    const qbo = new QuickBooks(
      this.config.clientId,
      this.config.clientSecret,
      token.access_token,
      false,
      realmId,
      true,
      true,
      4,
      '2.0',
      token.refresh_token
    );

    return new Promise((resolve, reject) => {
      // Map entity names to QuickBooks API methods
      const entityMethods = {
        'Customer': 'getCustomer',
        'Item': 'getItem',
        'Invoice': 'getInvoice',
        'Payment': 'getPayment',
        'Bill': 'getBill',
        'Vendor': 'getVendor',
        'Employee': 'getEmployee',
        'Account': 'getAccount',
        'Class': 'getClass',
        'Department': 'getDepartment',
        'Estimate': 'getEstimate',
        'PurchaseOrder': 'getPurchaseOrder',
        'SalesReceipt': 'getSalesReceipt',
        'TimeActivity': 'getTimeActivity',
        'JournalEntry': 'getJournalEntry'
      };

      const methodName = entityMethods[entityName];
      if (!methodName || typeof qbo[methodName] !== 'function') {
        reject(new Error(`Unsupported entity type: ${entityName}`));
        return;
      }

      qbo[methodName](entityId, (err: any, data: any) => {
        if (err) {
          reject(new Error(`QuickBooks API error: ${err.message || err}`));
        } else {
          resolve(data);
        }
      });
    });
  }

  private async writeEnrichedNotificationsToCsv(notifications: NotificationRecord[]): Promise<void> {
    const fields = [
      'realmId', 'entityType', 'id', 'operation', 'lastUpdated',
      'fetchStatus', 'errorMessage', 'fullDataJSON'
    ];
    const newLine = '\r\n';

    const csvData = notifications.map(notification => ({
      realmId: notification.realmId,
      entityType: notification.entityType,
      id: notification.id,
      operation: notification.operation,
      lastUpdated: notification.lastUpdated,
      fetchStatus: notification.fetchStatus,
      errorMessage: notification.errorMessage || '',
      fullDataJSON: notification.fullData ? JSON.stringify(notification.fullData) : ''
    }));

    const toCsv = {
      data: csvData,
      fields: fields
    };

    try {
      await fs.promises.stat('file.csv');
      const csv = json2csv(toCsv) + newLine;
      await fs.promises.appendFile('file.csv', csv);
      this.logger.log('Enriched notification data appended to CSV file');
    } catch (err) {
      this.logger.log('Creating new CSV file with enriched data headers');
      const headerLine = fields.join(',') + newLine;
      await fs.promises.writeFile('file.csv', headerLine);

      if (csvData.length > 0) {
        const csv = json2csv(toCsv) + newLine;
        await fs.promises.appendFile('file.csv', csv);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async writeNotificationToCsv(body: WebhookEventNotification): Promise<void> {
    const fields = ['realmId', 'name', 'id', 'operation', 'lastUpdated'];
    const newLine = '\r\n';
    const appendThis: NotificationRecord[] = [];

    for (let i = 0; i < body.eventNotifications.length; i++) {
      const entities = body.eventNotifications[i].dataChangeEvent.entities;
      const realmID = body.eventNotifications[i].realmId;

      for (let j = 0; j < entities.length; j++) {
        const notification = {
          realmId: realmID,
          name: entities[j].name,
          id: entities[j].id,
          operation: entities[j].operation,
          lastUpdated: entities[j].lastUpdated
        };
        appendThis.push(notification);
      }
    }

    const toCsv = {
      data: appendThis,
      fields: fields
    };

    try {
      await fs.promises.stat('file.csv');
      const csv = json2csv(toCsv) + newLine;
      await fs.promises.appendFile('file.csv', csv);
      this.logger.log('The "data to append" was appended to file!');
    } catch (err) {
      this.logger.log('New file, just writing headers');
      const headerLine = fields.join(',') + newLine;
      await fs.promises.writeFile('file.csv', headerLine);
    }
  }

  async createCustomer(displayName: string): Promise<any> {
    const token = JSON.parse(this.tokenJson);

    const qbo = new QuickBooks(
      this.config.clientId,
      this.config.clientSecret,
      token.access_token,
      false,
      this.realmId,
      true,
      true,
      4,
      '2.0',
      token.refresh_token
    );

    return new Promise((resolve, reject) => {
      qbo.createCustomer({ DisplayName: displayName }, (err: any, customer: any) => {
        if (err) {
          this.logger.error(err);
          reject(err);
        } else {
          this.logger.log('The response is:', JSON.stringify(customer, null, 2));
          resolve(customer);
        }
      });
    });
  }

  private async submitInvoiceToFirs(invoiceData: any, operation: string, realmId: string): Promise<void> {
    try {
      this.logger.log(`Submitting invoice to FIRS: ${invoiceData.Id}, Operation: ${operation}`);

      // Fetch company configuration from Supabase
      const company = await this.supabaseService.getCompanyByQuickBooksId(realmId);
      if (!company) {
        this.logger.warn(`No company configuration found for QuickBooks ID: ${realmId}`);
        return;
      }

      // Get supplier info from QuickBooks Company API
      const companyInfo = await this.fetchCompanyInfo(realmId);
      const supplierParty = this.transformCompanyInfoToFirsParty(companyInfo, company);

      const companyConfig: FirsCompanyConfig = {
        businessId: company.firs_business_id,
        tin: company.tin,
        supplierParty: supplierParty
      };

      let firsResponse: FirsApiResponse;
      if (operation === 'Create') {
        firsResponse = await this.firsService.submitInvoice(invoiceData, companyConfig);
      } else if (operation === 'Update') {
        // For updates, we need to check if we have the IRN stored somewhere
        // For now, we'll treat updates as new submissions
        firsResponse = await this.firsService.submitInvoice(invoiceData, companyConfig);
      }

      if (firsResponse && firsResponse.code >= 200 && firsResponse.code < 300) {
        this.logger.log(`FIRS submission successful: ${firsResponse.code || firsResponse.message || firsResponse}`);

        // Generate IRN for successful FIRS submission
        const irn = this.firsService.generateIRN(invoiceData.DocNumber || invoiceData.Id, invoiceData.TxnDate || invoiceData.TxnDate);

        // Update invoice with FIRS IRN custom field
        try {
          const irnFieldSuccess = await this.updateInvoiceCustomField(
            invoiceData.Id,
            'FIRS IRN',
            irn,
            realmId
          );

          if (irnFieldSuccess) {
            this.logger.log(`FIRS IRN custom field updated for invoice ${invoiceData.Id} with IRN: ${irn}`);
          } else {
            this.logger.log(`Failed to update FIRS IRN custom field for invoice ${invoiceData.Id}`);
          }
        } catch (irnFieldError) {
          this.logger.error('Failed to update FIRS IRN custom field:', irnFieldError.message);
        }

        // Generate and upload QR code after successful FIRS submission
        try {
          if (firsResponse.code === 201) {
            const qrResult = await this.firsService.generateAndUploadQRCode(
              irn,
              invoiceData.Id || 'unknown',
              firsResponse
            );

            if (qrResult) {
              this.logger.log(`QR code generated and uploaded successfully: ${qrResult.qrCodeUrl}`);

              // Upload QR code as attachment to QuickBooks invoice
              try {
                const attachmentSuccess = await this.uploadQRCodeAsAttachment(
                  invoiceData.Id,
                  qrResult.qrCodeBuffer,
                  qrResult.fileName,
                  realmId
                );

                if (attachmentSuccess) {
                  this.logger.log(`QR code attached to QuickBooks invoice ${invoiceData.Id} successfully`);
                } else {
                  this.logger.log(`Failed to attach QR code to QuickBooks invoice ${invoiceData.Id}`);
                }
              } catch (attachError) {
                this.logger.error('Failed to attach QR code to QuickBooks invoice:', attachError.message);
              }

              // Set E-invoice QRCode custom field with Supabase public URL
              try {
                const customFieldSuccess = await this.updateInvoiceCustomField(
                  invoiceData.Id,
                  'E-invoice QRCode',
                  qrResult.qrCodeUrl,
                  realmId
                );

                if (customFieldSuccess) {
                  this.logger.log(`E-invoice QRCode custom field updated for invoice ${invoiceData.Id}`);
                } else {
                  this.logger.log(`Failed to update E-invoice QRCode custom field for invoice ${invoiceData.Id}`);
                }
              } catch (customFieldError) {
                this.logger.error('Failed to update E-invoice QRCode custom field:', customFieldError.message);
              }
            } else {
              this.logger.log('QR code generation skipped (missing configuration)');
            }
          }
        } catch (qrError) {
          this.logger.error('Failed to generate QR code:', qrError.message);
          // Don't fail the whole process if QR code generation fails
        }
      } else {
        this.logger.error(`FIRS submission failed: ${firsResponse?.message || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error(`Error submitting invoice to FIRS:`, error.message);
    }
  }

  private async handleDeletedInvoiceInFirs(invoiceId: string): Promise<void> {
    try {
      this.logger.log(`Handling deleted invoice in FIRS: ${invoiceId}`);

      // In a real implementation, you would:
      // 1. Look up the IRN for this invoice from your database
      // 2. Submit a cancellation request to FIRS using updateInvoice with negative values

      // For now, we'll just log the event
      this.logger.log(`Invoice ${invoiceId} was deleted - would need to cancel in FIRS with proper IRN`);
    } catch (error) {
      this.logger.error(`Error handling deleted invoice in FIRS:`, error.message);
    }
  }

  private async fetchCompanyInfo(realmId: string): Promise<any> {
    if (!this.tokenJson) {
      throw new Error('No access token available for QuickBooks Company API');
    }

    const token = JSON.parse(this.tokenJson);
    const qbo = new QuickBooks(
      this.config.clientId,
      this.config.clientSecret,
      token.access_token,
      false,
      realmId,
      true,
      true,
      4,
      '2.0',
      token.refresh_token
    );

    return new Promise((resolve, reject) => {
      qbo.getCompanyInfo(realmId, (err: any, data: any) => {
        if (err) {
          reject(new Error(`QuickBooks Company API error: ${err.message || err}`));
        } else {
          resolve(data);
        }
      });
    });
  }

  private transformCompanyInfoToFirsParty(companyInfo: any, company: any): FirsParty {
    const qbCompany = companyInfo?.QueryResponse?.CompanyInfo?.[0] || {};

    return {
      party_name: qbCompany.CompanyName || 'Company Name',
      tin: company.tin,
      email: qbCompany.Email?.Address || 'company@example.com',
      telephone: qbCompany.PrimaryPhone?.FreeFormNumber || '+2341234567890',
      business_description: qbCompany.CompanyName || 'Business Description',
      postal_address: {
        street_name: qbCompany.CompanyAddr?.Line1 || '123 Business Street',
        city_name: qbCompany.CompanyAddr?.City || 'Lagos',
        postal_zone: qbCompany.CompanyAddr?.PostalCode || '100001',
        country: qbCompany.CompanyAddr?.CountrySubDivisionCode || 'NG'
      }
    };
  }

  async uploadQRCodeAsAttachment(invoiceId: string, qrCodeBuffer: Buffer, fileName: string, realmId: string): Promise<boolean> {
    try {
      this.logger.log(`Uploading QR code as attachment to invoice ${invoiceId} using direct API`);

      if (!this.tokenJson) {
        this.logger.error('No access token available for attachment upload');
        return false;
      }

      const token = JSON.parse(this.tokenJson);

      // Determine the correct base URL based on environment
      const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';

      const uploadUrl = `${baseUrl}/v3/company/${realmId}/upload?minorversion=75`;

      // Create the attachable metadata as per QB API spec
      const attachableMetadata = {
        AttachableRef: [{
          IncludeOnSend: true,
          EntityRef: {
            type: 'Invoice',
            value: invoiceId
          }
        }],
        Note: 'QR Code for E-invoice',
        ContentType: 'image/png',
        FileName: fileName
      };

      // Create form data
      const FormData = require('form-data');
      const form = new FormData();

      // Add the metadata as file_metadata_01
      form.append('file_metadata_01', JSON.stringify(attachableMetadata), {
        contentType: 'application/json'
      });

      // Add the file content as file_content_01
      form.append('file_content_01', qrCodeBuffer, {
        filename: fileName,
        contentType: 'image/png'
      });

      // Make the API request
      const axios = require('axios');
      const response = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token.access_token}`,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (response.status === 200) {
        this.logger.log(`QR code attachment uploaded successfully to invoice ${invoiceId}`);
        this.logger.log('Upload response:', JSON.stringify(response.data, null, 2));
        return true;
      } else {
        this.logger.error(`Unexpected response status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error(`Error uploading QR code attachment to invoice ${invoiceId}:`, error.message);

      if (error.response) {
        this.logger.error('Response status:', error.response.status);
        this.logger.error('Response headers:', error.response.headers);
        this.logger.error('Response data:', error.response.data);
      }

      return false;
    }
  }

  async updateInvoiceCustomField(invoiceId: string, fieldName: string, fieldValue: string, realmId: string): Promise<boolean> {
    try {
      this.logger.log(`Updating custom field '${fieldName}' for invoice ${invoiceId}`);

      if (!this.tokenJson) {
        this.logger.error('No access token available for invoice update');
        return false;
      }

      const token = JSON.parse(this.tokenJson);
      const qbo = new QuickBooks(
        this.config.clientId,
        this.config.clientSecret,
        token.access_token,
        false,
        realmId,
        true,
        true,
        4,
        '2.0',
        token.refresh_token
      );

      return new Promise((resolve) => {
        // First, get the current invoice to get the SyncToken
        qbo.getInvoice(invoiceId, (err: any, invoice: any) => {
          if (err) {
            this.logger.error(`Error fetching invoice ${invoiceId}:`, err.message);
            resolve(false);
            return;
          }

          this.logger.log('Invoice data:=====>>', invoice);

          // Prepare the updated invoice with custom field
          const updatedInvoice = {
            ...invoice,
            CustomField: [
              ...(invoice.CustomField || []).filter((cf: any) => cf.Name !== fieldName),
              {
                Name: fieldName,
                Type: 'StringType',
                StringValue: fieldValue
              }
            ]
          };

          // Update the invoice
          qbo.updateInvoice(updatedInvoice, (updateErr: any) => {
            if (updateErr) {
              this.logger.error(`Error updating invoice ${invoiceId} custom field:`, updateErr.message);
              resolve(false);
            } else {
              this.logger.log(`Successfully updated custom field '${fieldName}' for invoice ${invoiceId}`);
              resolve(true);
            }
          });
        });
      });
    } catch (error) {
      this.logger.error(`Error updating custom field for invoice ${invoiceId}:`, error.message);
      return false;
    }
  }

  async testWebhookProcessing(body: WebhookEventNotification): Promise<void> {
    this.logger.log('Testing webhook processing with FIRS integration...');
    await this.processWebhookNotifications(body);
  }
}