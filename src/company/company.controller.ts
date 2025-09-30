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
import { FirsService } from '../firs/firs.service';
import {
  CreateCompanyDto,
  CreateCompanyDataDto,
  UpdateCompanyDto,
  CompanyResponse,
  CompaniesResponse
} from '../types/company.types';

@Controller('companies')
export class CompanyController {
  private readonly logger = new Logger(CompanyController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly firsService: FirsService
  ) {}

  @Post()
  async createCompany(@Body() createCompanyDto: CreateCompanyDto): Promise<CompanyResponse> {
    try {
      this.logger.log(`Creating company for QB ID: ${createCompanyDto.quickbooks_company_id} with Entity ID: ${createCompanyDto.entity_id}`);

      // Validate required fields
      if (!createCompanyDto.quickbooks_company_id || !createCompanyDto.entity_id) {
        throw new HttpException(
          'QuickBooks Company ID and Entity ID are required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Fetch entity data from FIRS
      const entityResponse = await this.firsService.getEntity(createCompanyDto.entity_id);

      if (!entityResponse || entityResponse.code !== 200) {
        throw new HttpException(
          'Failed to fetch entity from FIRS or entity not found',
          HttpStatus.BAD_REQUEST
        );
      }

      const business = entityResponse.data.businesses[0];
      if (!business) {
        throw new HttpException(
          'No business found in the entity',
          HttpStatus.BAD_REQUEST
        );
      }

      // Parse service_id from IRN template
      // Template format: "{{invoice_id(e.g:INV00XXX)}}-B06E99DC-{{YYYYMMDD(e.g:20250923)}}"
      // We want the second part: "B06E99DC"
      const irnTemplateParts = business.irn_template.split('-');
      const serviceId = irnTemplateParts.length >= 2 ? irnTemplateParts[1] : '';

      if (!serviceId) {
        throw new HttpException(
          'Could not extract service_id from IRN template',
          HttpStatus.BAD_REQUEST
        );
      }

      // Create company data object
      const companyData: CreateCompanyDataDto = {
        quickbooks_company_id: createCompanyDto.quickbooks_company_id,
        firs_business_id: business.id,
        tin: business.tin,
        service_id: serviceId,
        entity_id: createCompanyDto.entity_id
      };

      const company = await this.supabaseService.createCompany(companyData);

      return {
        success: true,
        data: company,
        message: 'Company created successfully with FIRS entity data'
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