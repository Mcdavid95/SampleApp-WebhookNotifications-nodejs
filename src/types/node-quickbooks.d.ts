declare module 'node-quickbooks' {
  function QuickBooks(
    clientId: string,
    clientSecret: string,
    accessToken: string,
    useProduction: boolean,
    realmId: string,
    useSandbox: boolean,
    debug: boolean,
    minorVersion: number,
    oauthVersion: string,
    refreshToken: string
  ): QuickBooksInstance;

  interface QuickBooksInstance {
    createCustomer(customer: any, callback: (err: any, result: any) => void): void;
    getCustomer(id: string, callback: (err: any, result: any) => void): void;
    getItem(id: string, callback: (err: any, result: any) => void): void;
    getInvoice(id: string, callback: (err: any, result: any) => void): void;
    getPayment(id: string, callback: (err: any, result: any) => void): void;
    getBill(id: string, callback: (err: any, result: any) => void): void;
    getVendor(id: string, callback: (err: any, result: any) => void): void;
    getEmployee(id: string, callback: (err: any, result: any) => void): void;
    getAccount(id: string, callback: (err: any, result: any) => void): void;
    getClass(id: string, callback: (err: any, result: any) => void): void;
    getDepartment(id: string, callback: (err: any, result: any) => void): void;
    getEstimate(id: string, callback: (err: any, result: any) => void): void;
    getPurchaseOrder(id: string, callback: (err: any, result: any) => void): void;
    getSalesReceipt(id: string, callback: (err: any, result: any) => void): void;
    getTimeActivity(id: string, callback: (err: any, result: any) => void): void;
    getJournalEntry(id: string, callback: (err: any, result: any) => void): void;
    [key: string]: any;
  }

  export = QuickBooks;
}