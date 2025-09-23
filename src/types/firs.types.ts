export interface FirsInvoiceRequest {
  business_id: string;
  irn: string;
  issue_date: string;
  due_date: string;
  issue_time: string;
  invoice_type_code: string;
  payment_status: string;
  note: string;
  tax_point_date: string;
  document_currency_code: string;
  tax_currency_code: string;
  accounting_cost?: string;
  buyer_reference?: string;
  order_reference?: string;
  accounting_supplier_party: FirsParty;
  accounting_customer_party: FirsParty;
  actual_delivery_date: string;
  payment_means: FirsPaymentMeans[];
  payment_terms_note?: string;
  allowance_charge: any[];
  tax_total: FirsTaxTotal[];
  legal_monetary_total: FirsMonetaryTotal;
  invoice_line: FirsInvoiceLine[];
}

export interface FirsParty {
  party_name: string;
  tin: string;
  email: string;
  telephone: string;
  business_description: string;
  postal_address: FirsAddress;
}

export interface FirsAddress {
  street_name: string;
  city_name: string;
  postal_zone: string;
  country: string;
}

export interface FirsPaymentMeans {
  payment_means_code: string;
  payment_due_date: string;
}

export interface FirsTaxTotal {
  tax_amount: number;
  tax_subtotal: FirsTaxSubtotal[];
}

export interface FirsTaxSubtotal {
  taxable_amount: number;
  tax_amount: number;
  tax_category: FirsTaxCategory;
}

export interface FirsTaxCategory {
  id: string;
  percent: number;
}

export interface FirsMonetaryTotal {
  line_extension_amount: number;
  tax_exclusive_amount: number;
  tax_inclusive_amount: number;
  payable_amount: number;
}

export interface FirsInvoiceLine {
  hsn_code: string;
  product_category: string;
  discount_rate: number;
  discount_amount: number;
  fee_rate: number;
  fee_amount: number;
  invoiced_quantity: number;
  line_extension_amount: number;
  item: FirsItem;
  price: FirsPrice;
}

export interface FirsItem {
  name: string;
  description: string;
  sellers_item_identification: string;
}

export interface FirsPrice {
  price_amount: number;
  base_quantity: number;
  price_unit: string;
}

export interface FirsApiResponse {
  code: number;
  message: string;
  reference?: string;
  irn?: string;
  status?: string;
  timestamp: string;
  errors?: FirsApiError[];
}

export interface FirsApiError {
  field: string;
  message: string;
}

export interface FirsConfig {
  baseUrl: string;
  businessId: string;
  defaultSupplierTin: string;
  defaultSupplierParty: FirsParty;
}