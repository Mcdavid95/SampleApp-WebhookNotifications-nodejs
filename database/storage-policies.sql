-- Supabase Storage Policies for FIRS QR Code Management
-- Run this SQL in your Supabase SQL Editor after creating the storage bucket

-- First, create the FIRS-QBO bucket if it doesn't exist
-- (This should be done via the Supabase UI: Storage -> Create Bucket)

-- Allow public uploads to the FIRS-QBO bucket
CREATE POLICY "Allow QR code uploads" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'FIRS-QBO');

-- Allow public downloads from the FIRS-QBO bucket
CREATE POLICY "Allow QR code downloads" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'FIRS-QBO');

-- Allow updates to QR codes (for upsert functionality)
CREATE POLICY "Allow QR code updates" ON storage.objects
FOR UPDATE TO public
USING (bucket_id = 'FIRS-QBO')
WITH CHECK (bucket_id = 'FIRS-QBO');

-- Allow deletion of QR codes (for cleanup)
CREATE POLICY "Allow QR code deletion" ON storage.objects
FOR DELETE TO public
USING (bucket_id = 'FIRS-QBO');

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage';