-- Enable realtime and broaden visibility for to-do jobs
-- 1) Ensure full row data for updates
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

-- 2) Add jobs table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- 3) Update SELECT visibility so builders can see jobs that need doing
DO $$
BEGIN
  -- Drop old policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Everyone can view approved jobs'
  ) THEN
    DROP POLICY "Everyone can view approved jobs" ON public.jobs;
  END IF;
END $$;

-- Create new inclusive policy
CREATE POLICY "Everyone can view to-do and completed jobs"
ON public.jobs
FOR SELECT
USING (status IN ('approved', 'needs_correction', 'completed'));
