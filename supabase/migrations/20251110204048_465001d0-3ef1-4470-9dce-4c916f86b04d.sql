-- Ensure trigger sets job status to waiting_review on completion
DROP TRIGGER IF EXISTS trg_set_job_status_waiting_review ON public.job_completions;
CREATE TRIGGER trg_set_job_status_waiting_review
AFTER INSERT OR UPDATE ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.set_job_status_waiting_review();

-- Enable realtime on key tables (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_completions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Ensure full row replication images for realtime payloads
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_completions REPLICA IDENTITY FULL;

-- Allow builders to view jobs that are waiting for review (to see updated badge)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Everyone can view waiting review jobs'
  ) THEN
    CREATE POLICY "Everyone can view waiting review jobs"
    ON public.jobs
    FOR SELECT
    USING (status = 'waiting_review');
  END IF;
END $$;