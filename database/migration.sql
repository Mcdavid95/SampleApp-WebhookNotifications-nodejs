-- Company Management Database Migration
-- Run this SQL in your Supabase SQL Editor

-- Create the companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quickbooks_company_id TEXT NOT NULL UNIQUE,
    firs_business_id TEXT NOT NULL,
    tin TEXT NOT NULL UNIQUE,
    service_id TEXT NOT NULL,
    entity_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_quickbooks_company_id ON companies(quickbooks_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_tin ON companies(tin);
CREATE INDEX IF NOT EXISTS idx_companies_firs_business_id ON companies(firs_business_id);

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
-- Uncomment the lines below to add test data

/*
INSERT INTO companies (quickbooks_company_id, firs_business_id, tin, service_id) VALUES
('9341455357036451', 'BID123456789', '12345678-0001', 'B06E99DC'),
('1234567890123456', 'BID987654321', '98765432-0001', 'B06E99DC'),
('5555555555555555', 'BID555555555', '55555555-0001', 'B06E99DC')
ON CONFLICT (quickbooks_company_id) DO NOTHING;
*/

-- Verify the table was created successfully
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;