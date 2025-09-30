export interface BankStatementRow {
  date?: string;
  description?: string;
  amount?: number;
  balance?: number;
  reference?: string;
  [key: string]: any;
}

export interface BankStatementFileMessage {
  fileUrl: string;
  fileName: string;
  companyId?: string;
  uploadedAt: string;
}

export interface BankStatementRowMessage {
  row: BankStatementRow;
  rowNumber: number;
  fileName: string;
  fileUrl: string;
  companyId?: string;
}
