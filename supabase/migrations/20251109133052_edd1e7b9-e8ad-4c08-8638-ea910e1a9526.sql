-- Storage policies to allow builders and managers to upload/read job completion photos

-- Allow authenticated users to upload to the job-completion-photos bucket
CREATE POLICY "Authenticated can upload job completion photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-completion-photos');

-- Allow authenticated users to read from the job-completion-photos bucket
CREATE POLICY "Authenticated can read job completion photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'job-completion-photos');