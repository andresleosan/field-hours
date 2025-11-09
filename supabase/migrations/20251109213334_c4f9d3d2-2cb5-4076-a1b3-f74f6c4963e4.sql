-- Storage policies for job-completion-photos bucket
-- Allow builders to upload photos for their own job completion folders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own job completion photos'
  ) THEN
    CREATE POLICY "Users can upload their own job completion photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'job-completion-photos'
      AND EXISTS (
        SELECT 1 FROM public.job_completions jc
        WHERE jc.id = (storage.foldername(name))[1]::uuid
          AND jc.completed_by = auth.uid()
      )
    );
  END IF;

  -- Managers can view all photos in this bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can view all completion photos'
  ) THEN
    CREATE POLICY "Managers can view all completion photos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'job-completion-photos'
      AND public.has_role(auth.uid(), 'manager'::app_role)
    );
  END IF;

  -- Builders can view their own completion photos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own completion photos'
  ) THEN
    CREATE POLICY "Users can view own completion photos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'job-completion-photos'
      AND EXISTS (
        SELECT 1 FROM public.job_completions jc
        WHERE jc.id = (storage.foldername(name))[1]::uuid
          AND jc.completed_by = auth.uid()
      )
    );
  END IF;
END $$;