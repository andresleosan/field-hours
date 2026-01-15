-- Drop existing policies that conflict and recreate

-- Drop documents policies that may exist
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- Drop storage-material-photos policies that may exist
DROP POLICY IF EXISTS "Authenticated users can view storage material photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload storage material photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update storage material photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete storage material photos" ON storage.objects;

-- Drop rubbish-photos policies that may exist
DROP POLICY IF EXISTS "Authenticated users can view rubbish photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload rubbish photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update rubbish photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete rubbish photos" ON storage.objects;

-- Recreate documents policies
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- Recreate storage-material-photos policies
CREATE POLICY "Authenticated users can view storage material photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'storage-material-photos');

CREATE POLICY "Authenticated users can upload storage material photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'storage-material-photos');

CREATE POLICY "Authenticated users can update storage material photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'storage-material-photos');

CREATE POLICY "Authenticated users can delete storage material photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'storage-material-photos');

-- Recreate rubbish-photos policies
CREATE POLICY "Authenticated users can view rubbish photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rubbish-photos');

CREATE POLICY "Authenticated users can upload rubbish photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rubbish-photos');

CREATE POLICY "Authenticated users can update rubbish photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rubbish-photos');

CREATE POLICY "Authenticated users can delete rubbish photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rubbish-photos');