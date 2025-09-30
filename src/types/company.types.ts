export interface Company {
  id?: string;
  quickbooks_company_id: string;
  firs_business_id: string;
  tin: string;
  service_id: string;
  entity_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCompanyDto {
  quickbooks_company_id: string;
  entity_id: string;
}

export interface CreateCompanyDataDto {
  quickbooks_company_id: string;
  firs_business_id: string;
  tin: string;
  service_id: string;
  entity_id: string;
}

export interface UpdateCompanyDto {
  quickbooks_company_id?: string;
  firs_business_id?: string;
  tin?: string;
  service_id?: string;
  entity_id?: string;
}

export interface CompanyResponse {
  success: boolean;
  data?: Company;
  error?: string;
  message?: string;
}

export interface CompaniesResponse {
  success: boolean;
  data?: Company[];
  error?: string;
  message?: string;
}

export interface DatabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface FirsEntityResponse {
  code: number;
  data: {
    id: string;
    reference: string;
    custom_settings: any;
    created_at: string;
    updated_at: string;
    businesses: FirsBusiness[];
    is_active: boolean;
    app_reference: string;
  };
}

export interface FirsBusiness {
  id: string;
  reference: string;
  name: string;
  custom_settings: any;
  created_at: string;
  updated_at: string;
  tin: string;
  sector: string;
  annual_turnover: string;
  support_peppol: boolean;
  is_realtime_reporting: boolean;
  notification_channels: string;
  erp_system: string;
  irn_template: string;
  is_active: boolean;
}