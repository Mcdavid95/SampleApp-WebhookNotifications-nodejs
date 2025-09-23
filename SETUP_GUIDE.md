# Company API Setup Guide

## Quick Start

This guide will help you set up the Company Management API that saves and manages company information with QuickBooks Company ID, FIRS Business ID, and TIN.

## 🚀 Setup Steps

### 1. Database Setup (Supabase)

1. **Create a Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Create a free account
   - Create a new project

2. **Run Database Migration**
   - In your Supabase dashboard, go to SQL Editor
   - Copy and paste the contents of `database/migration.sql`
   - Run the migration

3. **Get API Credentials**
   - Go to Settings → API in your Supabase dashboard
   - Copy the Project URL and anon/public key

4. **Create Storage Bucket for QR Codes**
   - Go to Storage in your Supabase dashboard
   - Create a new bucket named `FIRS-QBO`
   - Set it to public (so QR codes can be accessed via URL)

   **Configure Storage Policies:**
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `database/storage-policies.sql`
   - Run the SQL to create the necessary policies
   - This allows public upload/download of QR codes in the `FIRS-QBO` bucket

### 2. Environment Configuration

1. **Create Environment File**
   ```bash
   cp .env.example .env
   ```

2. **Add Supabase Credentials**
   ```bash
   # Add these to your .env file
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Add FIRS QR Code Configuration (Optional)**
   ```bash
   # Add these to your .env file for encrypted QR code generation
   FIRS_PUBLIC_KEY=your-firs-public-key-here
   FIRS_CERTIFICATE=your-firs-certificate-here
   ```

   **To get your FIRS keys:**
   1. Login to your FIRS e-invoicing dashboard
   2. Navigate to "My Account" tab
   3. Click "Manage Cryptographic Keys"
   4. Download the `crypto_keys.txt` file
   5. Extract the `public_key` and `certificate` values

   *Note: If not configured, the system will generate basic QR codes instead of encrypted ones*

### 3. Start the Application

```bash
npm install
npm run start:dev
```

The API will be available at `http://localhost:8443/companies`

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/companies` | Create a new company |
| GET | `/companies` | Get all companies |
| GET | `/companies/{id}` | Get company by ID |
| GET | `/companies/search?qb_id={id}` | Search by QuickBooks ID |
| PUT | `/companies/{id}` | Update company |
| DELETE | `/companies/{id}` | Delete company |
| GET | `/companies/health/check` | Health check |

## 🧪 Testing

### Option 1: Use the Test Script
```bash
node test-company-api.js
```

### Option 2: Manual Testing with cURL

**Create a company:**
```bash
curl -X POST http://localhost:8443/companies \
  -H "Content-Type: application/json" \
  -d '{
    "quickbooks_company_id": "9341455357036451",
    "firs_business_id": "BID123456789",
    "tin": "12345678-0001"
  }'
```

**Get all companies:**
```bash
curl http://localhost:8443/companies
```

**Search by QuickBooks ID:**
```bash
curl "http://localhost:8443/companies/search?qb_id=9341455357036451"
```

## 📊 Database Schema

```sql
CREATE TABLE companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quickbooks_company_id TEXT NOT NULL UNIQUE,
    firs_business_id TEXT NOT NULL,
    tin TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🎯 QR Code Attachment Feature

The system automatically:
1. **Generates QR codes** containing encrypted invoice data (FIRS compliant)
2. **Uploads to Supabase** storage for external access
3. **Attaches to QuickBooks invoice** as a file attachment
4. **Sets custom field** "E-invoice QRCode" with the Supabase public URL

This provides triple access to QR codes:
- **In QuickBooks**: As invoice attachments
- **Custom Field**: Direct URL link in "E-invoice QRCode" field
- **Via URL**: From Supabase storage bucket

## 🔗 Integration Example

Here's how to integrate the Company API with your existing FIRS webhook:

```typescript
// In your webhook processing service
async processInvoiceWebhook(realmId: string, invoiceData: any) {
  // Look up company configuration
  const company = await this.supabaseService.getCompanyByQuickBooksId(realmId);

  if (company) {
    // Use company-specific FIRS configuration
    const firsSubmission = {
      business_id: company.firs_business_id,
      supplier_tin: company.tin,
      // ... rest of invoice data
    };

    await this.firsService.submitInvoice(firsSubmission);
  } else {
    console.warn(`No company configuration found for QuickBooks ID: ${realmId}`);
  }
}
```

## 📁 Files Created

```
src/
├── company/
│   ├── company.controller.ts    # API endpoints
│   └── company.module.ts        # NestJS module
├── supabase/
│   ├── supabase.service.ts      # Database operations
│   └── supabase.module.ts       # Supabase module
└── types/
    └── company.types.ts         # TypeScript interfaces

database/
└── migration.sql               # Database setup

test-company-api.js             # Test script
COMPANY_API.md                  # Detailed API documentation
```

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Database migration run successfully
- [ ] Environment variables configured
- [ ] Application builds without errors (`npm run build`)
- [ ] Application starts successfully (`npm run start:dev`)
- [ ] Health check endpoint responds (`curl http://localhost:8443/companies/health/check`)
- [ ] Can create a company via API
- [ ] Can retrieve companies via API

## 🛠 Troubleshooting

**Error: "Supabase URL and Anon Key must be provided"**
- Check that your `.env` file contains `SUPABASE_URL` and `SUPABASE_ANON_KEY`

**Error: "relation 'companies' does not exist"**
- Run the database migration script in Supabase SQL Editor

**Error: "Cannot connect to database"**
- Verify your Supabase URL and API key are correct
- Check that your Supabase project is active

**Port 8443 already in use**
- Stop other NestJS processes: `pkill -f "nest start"`
- Or change the port in `src/main.ts`

**Error: "new row violates row-level security policy"**
- This happens when uploading QR codes to Supabase storage
- Go to Storage → Policies in your Supabase dashboard
- Create the storage policies shown above for the `FIRS-QBO` bucket
- Or temporarily disable RLS for testing: `ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;`

## 🎯 Next Steps

1. **Security**: Enable Row Level Security (RLS) in Supabase for production
2. **Validation**: Add more robust input validation
3. **Caching**: Consider adding Redis caching for frequently accessed companies
4. **Monitoring**: Add logging and monitoring for production use
5. **Rate Limiting**: Implement API rate limiting

## 📞 Support

For issues or questions:
- Check the detailed API documentation in `COMPANY_API.md`
- Review the database schema in `database/migration.sql`
- Test with the provided test script: `node test-company-api.js`