-- Ensure job status flips to waiting_review when a completion is created/updated
DROP TRIGGER IF EXISTS trg_set_job_status_waiting_review ON public.job_completions;
CREATE TRIGGER trg_set_job_status_waiting_review
AFTER INSERT OR UPDATE ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.set_job_status_waiting_review();

-- Enable realtime updates for jobs and job_completions (idempotent)
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

-- Ensure full row images on updates for realtime
ALTER TABLE public.jobs REPLICA IDENTITY FULL;