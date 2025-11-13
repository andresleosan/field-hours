-- Create or replace function to set job status to waiting_review when a completion is created/updated
CREATE OR REPLACE FUNCTION public.set_job_status_waiting_review()
RETURNS trigger AS $$
BEGIN
  -- Move job into waiting_review unless already completed
  UPDATE public.jobs
  SET status = 'waiting_review',
      updated_at = now()
  WHERE id = NEW.job_id
    AND status <> 'completed';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Ensure trigger exists and uses the function above
DROP TRIGGER IF EXISTS trg_set_job_status_waiting_review ON public.job_completions;
CREATE TRIGGER trg_set_job_status_waiting_review
AFTER INSERT OR UPDATE ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.set_job_status_waiting_review();

-- Ensure realtime is enabled and replication images are complete (idempotent)
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

ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_completions REPLICA IDENTITY FULL;

-- Ensure policy exists so builders can see waiting_review jobs
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