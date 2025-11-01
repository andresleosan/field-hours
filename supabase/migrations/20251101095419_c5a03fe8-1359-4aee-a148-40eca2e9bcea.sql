-- Add storage RLS policies for invoice bucket (drop and recreate to ensure correct configuration)
DROP POLICY IF EXISTS "Managers can access all invoice images" ON storage.objects;
DROP POLICY IF EXISTS "Users can access their own uploaded invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;

CREATE POLICY "Managers can access all invoice images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "Users can access their own uploaded invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  owner = auth.uid()
);

CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' AND
  auth.uid() = owner
);