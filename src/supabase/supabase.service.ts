import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Company, CreateCompanyDto, UpdateCompanyDto, DatabaseError } from '../types/company.types';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Anon Key must be provided in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Supabase client initialized');
  }

  async createCompany(companyData: CreateCompanyDto): Promise<Company> {
    this.logger.log(`Creating company with QB ID: ${companyData.quickbooks_company_id}`);

    const { data, error } = await this.supabase
      .from('companies')
      .insert([{
        quickbooks_company_id: companyData.quickbooks_company_id,
        firs_business_id: companyData.firs_business_id,
        tin: companyData.tin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating company:', error);
      throw this.handleDatabaseError(error);
    }

    this.logger.log(`Company created successfully with ID: ${data.id}`);
    return data;
  }

  async getCompanyById(id: string): Promise<Company | null> {
    this.logger.log(`Fetching company with ID: ${id}`);

    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        this.logger.warn(`Company not found with ID: ${id}`);
        return null;
      }
      this.logger.error('Error fetching company:', error);
      throw this.handleDatabaseError(error);
    }

    return data;
  }

  async getCompanyByQuickBooksId(quickbooksId: string): Promise<Company | null> {
    this.logger.log(`Fetching company with QuickBooks ID: ${quickbooksId}`);

    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('quickbooks_company_id', quickbooksId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        this.logger.warn(`Company not found with QuickBooks ID: ${quickbooksId}`);
        return null;
      }
      this.logger.error('Error fetching company by QB ID:', error);
      throw this.handleDatabaseError(error);
    }

    return data;
  }

  async getAllCompanies(): Promise<Company[]> {
    this.logger.log('Fetching all companies');

    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching companies:', error);
      throw this.handleDatabaseError(error);
    }

    this.logger.log(`Fetched ${data?.length || 0} companies`);
    return data || [];
  }

  async updateCompany(id: string, updateData: UpdateCompanyDto): Promise<Company> {
    this.logger.log(`Updating company with ID: ${id}`);

    const { data, error } = await this.supabase
      .from('companies')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating company:', error);
      throw this.handleDatabaseError(error);
    }

    if (!data) {
      throw new Error(`Company with ID ${id} not found`);
    }

    this.logger.log(`Company updated successfully with ID: ${id}`);
    return data;
  }

  async deleteCompany(id: string): Promise<boolean> {
    this.logger.log(`Deleting company with ID: ${id}`);

    const { error } = await this.supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Error deleting company:', error);
      throw this.handleDatabaseError(error);
    }

    this.logger.log(`Company deleted successfully with ID: ${id}`);
    return true;
  }

  private handleDatabaseError(error: any): Error {
    const dbError: DatabaseError = {
      message: error.message || 'Database operation failed',
      details: error.details,
      hint: error.hint,
      code: error.code
    };

    // Map common Supabase/PostgreSQL errors to user-friendly messages
    switch (error.code) {
      case '23505': // unique_violation
        return new Error('A company with this QuickBooks ID or TIN already exists');
      case '23503': // foreign_key_violation
        return new Error('Invalid reference to related data');
      case '23514': // check_violation
        return new Error('Data validation failed');
      case 'PGRST116': // not found
        return new Error('Company not found');
      default:
        return new Error(dbError.message);
    }
  }

  // File upload methods
  async uploadQRCode(buffer: Buffer, fileName: string, bucketName: string = 'FIRS-QBO'): Promise<string> {
    this.logger.log(`Uploading QR code: ${fileName} to bucket: ${bucketName}`);

    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        this.logger.error('Error uploading QR code:', error);

        // Provide specific guidance for RLS policy errors
        if (error.message.includes('row-level security policy') || error.message.includes('RLS')) {
          throw new Error(`Failed to upload QR code due to Row Level Security policy. Please configure storage policies for bucket '${bucketName}'. See SETUP_GUIDE.md for instructions.`);
        }

        throw new Error(`Failed to upload QR code: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      this.logger.log(`QR code uploaded successfully: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      this.logger.error('Failed to upload QR code:', error);
      throw error;
    }
  }

  async deleteQRCode(fileName: string, bucketName: string = 'FIRS-QBO'): Promise<boolean> {
    this.logger.log(`Deleting QR code: ${fileName} from bucket: ${bucketName}`);

    try {
      const { error } = await this.supabase.storage
        .from(bucketName)
        .remove([fileName]);

      if (error) {
        this.logger.error('Error deleting QR code:', error);
        throw new Error(`Failed to delete QR code: ${error.message}`);
      }

      this.logger.log(`QR code deleted successfully: ${fileName}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete QR code:', error);
      throw error;
    }
  }

  async listQRCodes(bucketName: string = 'FIRS-QBO', folder?: string): Promise<any[]> {
    this.logger.log(`Listing QR codes from bucket: ${bucketName}`);

    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .list(folder);

      if (error) {
        this.logger.error('Error listing QR codes:', error);
        throw new Error(`Failed to list QR codes: ${error.message}`);
      }

      this.logger.log(`Found ${data?.length || 0} QR codes`);
      return data || [];
    } catch (error) {
      this.logger.error('Failed to list QR codes:', error);
      throw error;
    }
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('companies')
        .select('count', { count: 'exact', head: true });

      return !error;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }
}