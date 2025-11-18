
-- Drop duplicate triggers to avoid conflicts
DROP TRIGGER IF EXISTS trg_job_completion_set_waiting_review ON public.job_completions;
DROP TRIGGER IF EXISTS trg_set_job_status_waiting_review ON public.job_completions;

-- Recreate the function with proper security definer to bypass RLS
CREATE OR REPLACE FUNCTION public.set_job_status_waiting_review()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Update job status to waiting_review when a completion is created
  UPDATE public.jobs
  SET status = 'waiting_review',
      updated_at = now()
  WHERE id = NEW.job_id
    AND status NOT IN ('completed', 'waiting_review');

  RETURN NEW;
END;
$$;

-- Create a single trigger that fires AFTER INSERT
CREATE TRIGGER trg_set_job_status_waiting_review
AFTER INSERT ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.set_job_status_waiting_review();

-- Ensure realtime is enabled
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_completions REPLICA IDENTITY FULL;

-- Ensure realtime publication includes these tables
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
