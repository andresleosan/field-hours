-- Allow managers to delete jobs
CREATE POLICY "Managers can delete jobs"
ON public.jobs
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to delete job_photos
CREATE POLICY "Managers can delete job photos"
ON public.job_photos
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to delete job_time_tracking
CREATE POLICY "Managers can delete job time tracking"
ON public.job_time_tracking
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to delete job_completions
CREATE POLICY "Managers can delete job completions"
ON public.job_completions
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to delete job_completion_photos
CREATE POLICY "Managers can delete job completion photos"
ON public.job_completion_photos
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to delete job_collaborators
CREATE POLICY "Managers can delete job collaborators"
ON public.job_collaborators
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));