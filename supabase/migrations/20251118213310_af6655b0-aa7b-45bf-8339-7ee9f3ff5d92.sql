-- Add UPDATE policy for job_completions so builders can re-submit
CREATE POLICY "Builders can update their own completions"
ON public.job_completions
FOR UPDATE
TO authenticated
USING (auth.uid() = completed_by)
WITH CHECK (auth.uid() = completed_by);

-- Update trigger to also fire on UPDATE (for re-submissions)
DROP TRIGGER IF EXISTS trg_set_job_status_waiting_review ON public.job_completions;

CREATE TRIGGER trg_set_job_status_waiting_review
AFTER INSERT OR UPDATE ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.set_job_status_waiting_review();