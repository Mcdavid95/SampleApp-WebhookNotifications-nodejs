import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpException,
  Logger,
  Query
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyResponse,
  CompaniesResponse
} from '../types/company.types';

@Controller('companies')
export class CompanyController {
  private readonly logger = new Logger(CompanyController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Post()
  async createCompany(@Body() createCompanyDto: CreateCompanyDto): Promise<CompanyResponse> {
    try {
      this.logger.log(`Creating company for QB ID: ${createCompanyDto.quickbooks_company_id}`);

      // Validate required fields
      if (!createCompanyDto.quickbooks_company_id || !createCompanyDto.firs_business_id || !createCompanyDto.tin) {
        throw new HttpException(
          'QuickBooks Company ID, FIRS Business ID, and TIN are required',
          HttpStatus.BAD_REQUEST
        );
      }

      const company = await this.supabaseService.createCompany(createCompanyDto);

      return {
        success: true,
        data: company,
        message: 'Company created successfully'
      };
    } catch (error) {
      this.logger.error('Failed to create company:', error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'Failed to create company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async getAllCompanies(): Promise<CompaniesResponse> {
    try {
      this.logger.log('Fetching all companies');

      const companies = await this.supabaseService.getAllCompanies();

      return {
        success: true,
        data: companies,
        message: `Found ${companies.length} companies`
      };
    } catch (error) {
      this.logger.error('Failed to fetch companies:', error.message);

      throw new HttpException(
        error.message || 'Failed to fetch companies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('search')
  async getCompanyByQuickBooksId(@Query('qb_id') qbId: string): Promise<CompanyResponse> {
    try {
      if (!qbId) {
        throw new HttpException(
          'QuickBooks ID query parameter is required',
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(`Searching for company with QB ID: ${qbId}`);

      const company = await this.supabaseService.getCompanyByQuickBooksId(qbId);

      if (!company) {
        return {
          success: false,
          message: `No company found with QuickBooks ID: ${qbId}`
        };
      }

      return {
        success: true,
        data: company,
        message: 'Company found successfully'
      };
    } catch (error) {
      this.logger.error('Failed to search company:', error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'Failed to search company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getCompanyById(@Param('id') id: string): Promise<CompanyResponse> {
    try {
      this.logger.log(`Fetching company with ID: ${id}`);

      if (!id) {
        throw new HttpException('Company ID is required', HttpStatus.BAD_REQUEST);
      }

      const company = await this.supabaseService.getCompanyById(id);

      if (!company) {
        throw new HttpException(
          `Company with ID ${id} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        data: company,
        message: 'Company found successfully'
      };
    } catch (error) {
      this.logger.error('Failed to fetch company:', error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'Failed to fetch company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id')
  async updateCompany(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto
  ): Promise<CompanyResponse> {
    try {
      this.logger.log(`Updating company with ID: ${id}`);

      if (!id) {
        throw new HttpException('Company ID is required', HttpStatus.BAD_REQUEST);
      }

      // Validate that at least one field is provided for update
      if (!updateCompanyDto.quickbooks_company_id &&
          !updateCompanyDto.firs_business_id &&
          !updateCompanyDto.tin) {
        throw new HttpException(
          'At least one field must be provided for update',
          HttpStatus.BAD_REQUEST
        );
      }

      const company = await this.supabaseService.updateCompany(id, updateCompanyDto);

      return {
        success: true,
        data: company,
        message: 'Company updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update company:', error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      if (error.message.includes('not found')) {
        throw new HttpException(
          `Company with ID ${id} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      throw new HttpException(
        error.message || 'Failed to update company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deleteCompany(@Param('id') id: string): Promise<CompanyResponse> {
    try {
      this.logger.log(`Deleting company with ID: ${id}`);

      if (!id) {
        throw new HttpException('Company ID is required', HttpStatus.BAD_REQUEST);
      }

      await this.supabaseService.deleteCompany(id);

      return {
        success: true,
        message: 'Company deleted successfully'
      };
    } catch (error) {
      this.logger.error('Failed to delete company:', error.message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || 'Failed to delete company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health/check')
  async healthCheck(): Promise<{ status: string; database: string }> {
    try {
      const isHealthy = await this.supabaseService.isHealthy();

      return {
        status: 'OK',
        database: isHealthy ? 'Connected' : 'Disconnected'
      };
    } catch (error) {
      this.logger.error('Health check failed:', error.message);

      return {
        status: 'ERROR',
        database: 'Disconnected'
      };
    }
  }
}