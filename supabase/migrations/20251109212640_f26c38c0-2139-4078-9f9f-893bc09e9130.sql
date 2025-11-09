-- Function + Trigger: set job status to waiting_review when a completion is created/updated
CREATE OR REPLACE FUNCTION public.set_job_status_waiting_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs
    SET status = 'waiting_review',
        updated_at = now()
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$;

-- Clean existing trigger if any
DROP TRIGGER IF EXISTS trg_job_completion_set_waiting_review ON public.job_completions;

-- Attach trigger to job_completions table
CREATE TRIGGER trg_job_completion_set_waiting_review
AFTER INSERT OR UPDATE ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.set_job_status_waiting_review();