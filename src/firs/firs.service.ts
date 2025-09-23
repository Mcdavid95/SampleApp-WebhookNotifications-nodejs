import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as QRCode from 'qrcode';
import { FirsInvoiceRequest, FirsApiResponse, FirsParty } from '../types/firs.types';
import { SupabaseService } from '../supabase/supabase.service';

export interface FirsCompanyConfig {
  businessId: string;
  tin: string;
  supplierParty: FirsParty;
}

@Injectable()
export class FirsService {
  private readonly logger = new Logger(FirsService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly supabaseService: SupabaseService) {
    this.baseUrl = process.env.FIRS_API_BASE_URL || 'https://api.firs.gov.ng';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async submitInvoice(invoiceData: any, companyConfig: FirsCompanyConfig): Promise<FirsApiResponse> {
    try {
      this.logger.log(`Submitting invoice to FIRS: ${invoiceData.Id || 'Unknown'}`);

      const firsInvoice = this.transformQBInvoiceToFirs(invoiceData, companyConfig);

      const response = await this.httpClient.post('/api/Firs/SignInvoice', firsInvoice);

      this.logger.log(`FIRS submission successful for invoice ${invoiceData.Id}: ${response.data.reference}`);
      return response.data;
    } catch (error) {
      this.logger.error(`FIRS submission failed for invoice ${invoiceData.Id || 'Unknown'}:`, error.response?.data || error.message);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        code: 500,
        message: `Internal error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateInvoice(invoiceData: any, irn: string, companyConfig: FirsCompanyConfig): Promise<FirsApiResponse> {
    try {
      this.logger.log(`Updating invoice in FIRS: ${irn}`);

      const firsInvoice = this.transformQBInvoiceToFirs(invoiceData, companyConfig, true);

      const response = await this.httpClient.patch(`/api/Firs/UpdateInvoice/${irn}`, firsInvoice);

      this.logger.log(`FIRS update successful for invoice ${irn}: ${response.data.reference}`);
      return response.data;
    } catch (error) {
      this.logger.error(`FIRS update failed for invoice ${irn}:`, error.response?.data || error.message);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        code: 500,
        message: `Internal error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private transformQBInvoiceToFirs(qbInvoice: any, companyConfig: FirsCompanyConfig, isUpdate: boolean = false): FirsInvoiceRequest {
    const issueDate = this.formatDate(qbInvoice.TxnDate || new Date().toISOString());
    const dueDate = this.formatDate(qbInvoice.DueDate || this.addDaysToDate(issueDate, 30));
    const irn = this.generateIRN(qbInvoice.DocNumber || qbInvoice.Id, issueDate);

    // Calculate totals
    const lineExtensionAmount = parseFloat(qbInvoice.TotalAmt || 0);
    const taxAmount = this.calculateTaxAmount(qbInvoice);
    const taxExclusiveAmount = lineExtensionAmount - taxAmount;
    const payableAmount = lineExtensionAmount;

    const firsInvoice: FirsInvoiceRequest = {
      business_id: companyConfig.businessId,
      irn: irn,
      issue_date: issueDate,
      due_date: dueDate,
      issue_time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      invoice_type_code: '380', // Commercial Invoice
      payment_status: this.mapPaymentStatus(qbInvoice.Balance),
      note: qbInvoice.PrivateNote || `QuickBooks Invoice ${qbInvoice.DocNumber || qbInvoice.Id}`,
      tax_point_date: issueDate,
      document_currency_code: qbInvoice.CurrencyRef?.value || 'NGN',
      tax_currency_code: qbInvoice.CurrencyRef?.value || 'NGN',
      accounting_cost: '',
      buyer_reference: '',
      order_reference: '',
      accounting_supplier_party: companyConfig.supplierParty,
      accounting_customer_party: this.transformCustomerToFirsParty(qbInvoice.CustomerRef),
      actual_delivery_date: issueDate,
      payment_means: [{
        payment_means_code: '30', // Credit Transfer
        payment_due_date: dueDate
      }],
      payment_terms_note: qbInvoice.SalesTermRef?.name || 'Net 30 days',
      allowance_charge: [],
      tax_total: [{
        tax_amount: isUpdate ? -taxAmount : taxAmount,
        tax_subtotal: [{
          taxable_amount: isUpdate ? -taxExclusiveAmount : taxExclusiveAmount,
          tax_amount: isUpdate ? -taxAmount : taxAmount,
          tax_category: {
            id: 'STANDARD_VAT',
            percent: 7.5
          }
        }]
      }],
      legal_monetary_total: {
        line_extension_amount: isUpdate ? -taxExclusiveAmount : taxExclusiveAmount,
        tax_exclusive_amount: isUpdate ? -taxExclusiveAmount : taxExclusiveAmount,
        tax_inclusive_amount: isUpdate ? -payableAmount : payableAmount,
        payable_amount: isUpdate ? -payableAmount : payableAmount
      },
      invoice_line: this.transformInvoiceLines(qbInvoice.Line || [], isUpdate)
    };

    if (isUpdate) {
      firsInvoice.payment_status = 'REJECTED';
      firsInvoice.note = `CANCELLED: ${firsInvoice.note}`;
    }

    return firsInvoice;
  }

  private transformCustomerToFirsParty(customerRef: any): FirsParty {
    // In a real implementation, you would fetch the full customer data
    // For now, we'll use placeholder data
    return {
      party_name: customerRef?.name || 'Customer Name',
      tin: '98765432-0001', // This should come from QB customer data
      email: 'customer@example.com',
      telephone: '+2347012345678',
      business_description: 'Customer Business',
      postal_address: {
        street_name: '456 Customer Street',
        city_name: 'Lagos',
        postal_zone: '100001',
        country: 'NG'
      }
    };
  }

  private transformInvoiceLines(qbLines: any[], isUpdate: boolean = false): any[] {
    if (!Array.isArray(qbLines)) {
      return [];
    }

    return qbLines
      .filter(line => line.DetailType === 'SalesItemLineDetail')
      .map((line, index) => {
        const amount = parseFloat(line.Amount || 0);
        const quantity = parseFloat(line.SalesItemLineDetail?.Qty || 1);
        const unitPrice = quantity > 0 ? amount / quantity : amount;

        // Ensure HSN code is at least 2 characters and properly formatted
        const rawHsnCode = line.SalesItemLineDetail?.ItemRef?.value || `ITEM${String(index + 1).padStart(2, '0')}`;
        const hsnCode = rawHsnCode.length < 2 ? `${rawHsnCode}00`.substring(0, 8) : rawHsnCode;

        return {
          hsn_code: hsnCode,
          product_category: 'General Services',
          discount_rate: 0,
          discount_amount: 0,
          fee_rate: 0,
          fee_amount: 0,
          invoiced_quantity: isUpdate ? -quantity : quantity,
          line_extension_amount: isUpdate ? -amount : amount,
          item: {
            name: line.SalesItemLineDetail?.ItemRef?.name || 'Service Item',
            description: line.Description || 'Service description',
            sellers_item_identification: line.SalesItemLineDetail?.ItemRef?.value || `ITEM-${index + 1}`
          },
          price: {
            price_amount: unitPrice,
            base_quantity: 1,
            price_unit: 'EA'
          }
        };
      });
  }

  private calculateTaxAmount(qbInvoice: any): number {
    // Calculate tax based on QB tax lines or use 7.5% VAT
    const totalAmount = parseFloat(qbInvoice.TotalAmt || 0);
    const taxRate = 0.075; // 7.5% VAT
    return totalAmount * taxRate / (1 + taxRate);
  }

  private mapPaymentStatus(balance: number | string): string {
    const balanceNum = parseFloat(balance?.toString() || '0');
    return balanceNum > 0 ? 'PENDING' : 'PAID';
  }

  public generateIRN(docNumber: string, issueDate: string): string {
    const dateStr = issueDate.replace(/-/g, '');
    return `${docNumber}-94019CE5-${dateStr}`;
  }

  private formatDate(dateInput: string | Date): string {
    const date = new Date(dateInput);
    return date.toISOString().split('T')[0];
  }

  private addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }

  async generateAndUploadQRCode(irn: string, invoiceId: string, firsResponse: FirsApiResponse): Promise<{ qrCodeUrl: string; qrCodeDataUrl: string; qrCodeBuffer: Buffer; fileName: string; encryptedData?: string } | null> {
    try {
      this.logger.log(`Generating encrypted QR code for IRN: ${irn}`);

      // Get FIRS public key and certificate from environment
      const publicKeyBase64 = process.env.FIRS_PUBLIC_KEY;
      const certificate = process.env.FIRS_CERTIFICATE;

      if (!publicKeyBase64 || !certificate) {
        this.logger.warn('FIRS_PUBLIC_KEY or FIRS_CERTIFICATE not configured - generating basic QR code');
        return await this.generateBasicQRCode(irn, invoiceId, firsResponse);
      }

      // Generate encrypted QR code data using FIRS encryption process
      const encryptedData = await this.encryptIRNWithFIRS(irn, certificate, publicKeyBase64);

      if (!encryptedData) {
        this.logger.warn('Failed to encrypt IRN - generating basic QR code');
        return await this.generateBasicQRCode(irn, invoiceId, firsResponse);
      }

      // Generate QR code from encrypted data
      const qrCodeBuffer = await QRCode.toBuffer(encryptedData, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const qrCodeDataUrl = await QRCode.toDataURL(encryptedData, {
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Generate unique filename for the QR code
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `invoice-${invoiceId}-${timestamp}.png`;

      // Upload QR code to Supabase storage
      const qrCodeUrl = await this.supabaseService.uploadQRCode(
        qrCodeBuffer,
        fileName
      );

      this.logger.log(`Encrypted QR code generated and uploaded successfully for IRN: ${irn} at ${qrCodeUrl}`);
      return {
        qrCodeUrl: qrCodeUrl,
        qrCodeDataUrl: qrCodeDataUrl,
        qrCodeBuffer: qrCodeBuffer,
        fileName: fileName,
        encryptedData: encryptedData
      };
    } catch (error) {
      this.logger.error(`Failed to generate and upload QR code for IRN ${irn}:`, error.message);
      return null;
    }
  }

  private async generateBasicQRCode(irn: string, invoiceId: string, firsResponse: FirsApiResponse): Promise<{ qrCodeUrl: string; qrCodeDataUrl: string; qrCodeBuffer: Buffer; fileName: string } | null> {
    try {
      // Create basic QR code data (fallback)
      const qrData = JSON.stringify({
        irn: irn,
        reference: firsResponse.reference,
        timestamp: new Date().toISOString(),
        invoiceId: invoiceId
      });

      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `invoice-${invoiceId}-${timestamp}.png`;

      const qrCodeUrl = await this.supabaseService.uploadQRCode(
        qrCodeBuffer,
        fileName
      );

      return {
        qrCodeUrl: qrCodeUrl,
        qrCodeDataUrl: qrCodeDataUrl,
        qrCodeBuffer: qrCodeBuffer,
        fileName: fileName
      };
    } catch (error) {
      this.logger.error(`Failed to generate basic QR code:`, error.message);
      return null;
    }
  }

  private async encryptIRNWithFIRS(irn: string, certificate: string, publicKeyBase64: string): Promise<string | null> {
    try {
      const crypto = require('crypto');

      // Create IRN with timestamp (as per FIRS requirements)
      const timestamp = Math.floor(Date.now() / 1000); // UNIX timestamp
      const irnWithTimestamp = `${irn}.${timestamp}`;

      // Prepare data to encrypt (IRN + certificate)
      const dataToEncrypt = JSON.stringify({
        irn: irnWithTimestamp,
        certificate: certificate
      });

      // Decode the base64 public key
      const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf8');

      // Encrypt the data using RSA public key
      const encryptedBuffer = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(dataToEncrypt, 'utf8')
      );

      // Convert to base64
      const encryptedBase64 = encryptedBuffer.toString('base64');

      this.logger.log(`Successfully encrypted IRN: ${irn} with timestamp: ${timestamp}`);
      return encryptedBase64;
    } catch (error) {
      this.logger.error(`Failed to encrypt IRN with FIRS keys:`, error.message);
      return null;
    }
  }
}