export interface Company {
  id?: string;
  quickbooks_company_id: string;
  firs_business_id: string;
  tin: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCompanyDto {
  quickbooks_company_id: string;
  firs_business_id: string;
  tin: string;
}

export interface UpdateCompanyDto {
  quickbooks_company_id?: string;
  firs_business_id?: string;
  tin?: string;
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