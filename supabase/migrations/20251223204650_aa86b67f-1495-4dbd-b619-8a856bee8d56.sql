-- Create documents storage bucket for risk assessments and other documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow public read access to documents
CREATE POLICY "Public read access for documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');

-- Allow managers to delete documents
CREATE POLICY "Managers can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'manager'
  )
);