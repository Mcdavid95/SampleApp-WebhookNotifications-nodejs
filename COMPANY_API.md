# Company Management API with Supabase

## Overview
This API provides complete CRUD (Create, Read, Update, Delete) operations for managing company information that links QuickBooks Company IDs with FIRS Business IDs and TIN numbers.

## Database Schema (Supabase)

### Table: `companies`

```sql
CREATE TABLE companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quickbooks_company_id TEXT NOT NULL UNIQUE,
    firs_business_id TEXT NOT NULL,
    tin TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_companies_quickbooks_company_id ON companies(quickbooks_company_id);
CREATE INDEX idx_companies_tin ON companies(tin);

-- Add unique constraint on TIN to prevent duplicates
ALTER TABLE companies ADD CONSTRAINT unique_tin UNIQUE (tin);
```

## Environment Setup

### Required Environment Variables

Add these to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### Getting Supabase Credentials

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API
4. Copy the Project URL and anon/public key

## API Endpoints

Base URL: `http://localhost:8443/companies`

### 1. Create Company
**POST** `/companies`

Creates a new company record.

**Request Body:**
```json
{
  "quickbooks_company_id": "9341455357036451",
  "firs_business_id": "BID123456789",
  "tin": "12345678-0001"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "quickbooks_company_id": "9341455357036451",
    "firs_business_id": "BID123456789",
    "tin": "12345678-0001",
    "created_at": "2025-09-21T19:30:00.000Z",
    "updated_at": "2025-09-21T19:30:00.000Z"
  },
  "message": "Company created successfully"
}
```

### 2. Get All Companies
**GET** `/companies`

Retrieves all company records.

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "quickbooks_company_id": "9341455357036451",
      "firs_business_id": "BID123456789",
      "tin": "12345678-0001",
      "created_at": "2025-09-21T19:30:00.000Z",
      "updated_at": "2025-09-21T19:30:00.000Z"
    }
  ],
  "message": "Found 1 companies"
}
```

### 3. Get Company by ID
**GET** `/companies/{id}`

Retrieves a specific company by its UUID.

**Parameters:**
- `id` (path): Company UUID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "quickbooks_company_id": "9341455357036451",
    "firs_business_id": "BID123456789",
    "tin": "12345678-0001",
    "created_at": "2025-09-21T19:30:00.000Z",
    "updated_at": "2025-09-21T19:30:00.000Z"
  },
  "message": "Company found successfully"
}
```

### 4. Search by QuickBooks ID
**GET** `/companies/search?qb_id={quickbooks_company_id}`

Finds a company by QuickBooks Company ID.

**Query Parameters:**
- `qb_id`: QuickBooks Company ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "quickbooks_company_id": "9341455357036451",
    "firs_business_id": "BID123456789",
    "tin": "12345678-0001",
    "created_at": "2025-09-21T19:30:00.000Z",
    "updated_at": "2025-09-21T19:30:00.000Z"
  },
  "message": "Company found successfully"
}
```

### 5. Update Company
**PUT** `/companies/{id}`

Updates an existing company record.

**Parameters:**
- `id` (path): Company UUID

**Request Body (partial updates allowed):**
```json
{
  "firs_business_id": "BID987654321",
  "tin": "98765432-0001"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "quickbooks_company_id": "9341455357036451",
    "firs_business_id": "BID987654321",
    "tin": "98765432-0001",
    "created_at": "2025-09-21T19:30:00.000Z",
    "updated_at": "2025-09-21T19:31:00.000Z"
  },
  "message": "Company updated successfully"
}
```

### 6. Delete Company
**DELETE** `/companies/{id}`

Deletes a company record.

**Parameters:**
- `id` (path): Company UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Company deleted successfully"
}
```

### 7. Health Check
**GET** `/companies/health/check`

Checks the health of the API and database connection.

**Success Response (200):**
```json
{
  "status": "OK",
  "database": "Connected"
}
```

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": "QuickBooks Company ID, FIRS Business ID, and TIN are required"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Company with ID 123e4567-e89b-12d3-a456-426614174000 not found"
}
```

**409 Conflict (Duplicate):**
```json
{
  "statusCode": 500,
  "message": "A company with this QuickBooks ID or TIN already exists"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Failed to create company"
}
```

## Testing the API

### Using cURL

1. **Create a Company:**
```bash
curl -X POST http://localhost:8443/companies \
  -H "Content-Type: application/json" \
  -d '{
    "quickbooks_company_id": "9341455357036451",
    "firs_business_id": "BID123456789",
    "tin": "12345678-0001"
  }'
```

2. **Get All Companies:**
```bash
curl http://localhost:8443/companies
```

3. **Search by QB ID:**
```bash
curl "http://localhost:8443/companies/search?qb_id=9341455357036451"
```

4. **Update Company:**
```bash
curl -X PUT http://localhost:8443/companies/{company-id} \
  -H "Content-Type: application/json" \
  -d '{
    "firs_business_id": "BID987654321"
  }'
```

5. **Delete Company:**
```bash
curl -X DELETE http://localhost:8443/companies/{company-id}
```

6. **Health Check:**
```bash
curl http://localhost:8443/companies/health/check
```

### Using Postman

Import this collection to test all endpoints:

```json
{
  "info": {
    "name": "Company API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Company",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"quickbooks_company_id\": \"9341455357036451\",\n  \"firs_business_id\": \"BID123456789\",\n  \"tin\": \"12345678-0001\"\n}"
        },
        "url": {
          "raw": "http://localhost:8443/companies",
          "host": ["http://localhost"],
          "port": "8443",
          "path": ["companies"]
        }
      }
    }
  ]
}
```

## Integration with Existing FIRS Webhook

The company API can be integrated with the existing FIRS webhook system to automatically look up FIRS Business ID and TIN for a given QuickBooks Company ID:

```typescript
// In your webhook processing
const company = await this.supabaseService.getCompanyByQuickBooksId(realmId);
if (company) {
  // Use company.firs_business_id and company.tin for FIRS submission
  const firsConfig = {
    businessId: company.firs_business_id,
    supplierTin: company.tin,
    // ... other config
  };
}
```

## Security Considerations

1. **Environment Variables**: Keep Supabase credentials secure
2. **Row Level Security**: Enable RLS in Supabase for production
3. **API Rate Limiting**: Consider implementing rate limiting
4. **Input Validation**: All inputs are validated before database operations
5. **Error Handling**: Sensitive information is not exposed in error messages

## Files Created

- `src/types/company.types.ts` - TypeScript interfaces
- `src/supabase/supabase.service.ts` - Database service
- `src/supabase/supabase.module.ts` - Supabase module
- `src/company/company.controller.ts` - API controller
- `src/company/company.module.ts` - Company module
- Updated `src/app.module.ts` - Added company module
- Updated `.env.example` - Added Supabase config

## Next Steps

1. Set up your Supabase project and database
2. Add environment variables to `.env`
3. Run the database migration script
4. Test the endpoints with sample data
5. Integrate with existing FIRS webhook system