-- Add service_id and entity_id columns to existing companies table
-- Run this in your Supabase SQL Editor

ALTER TABLE companies ADD COLUMN IF NOT EXISTS service_id TEXT NOT NULL DEFAULT 'B06E99DC';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Update existing records with a default service_id if any exist
UPDATE companies SET service_id = 'B06E99DC' WHERE service_id IS NULL OR service_id = '';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;