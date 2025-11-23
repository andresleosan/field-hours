-- Fix RLS policies for job_completions to allow access when status is 'needs_correction' or 'waiting_review'

-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Users can view completions for approved jobs" ON public.job_completions;
DROP POLICY IF EXISTS "Users can view photos for completions" ON public.job_completion_photos;

-- Create new policies for job_completions
-- Allows viewing completions if the job is in any active/completed state, including during review cycles
CREATE POLICY "Users can view completions for active jobs" ON public.job_completions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE jobs.id = job_completions.job_id 
    AND jobs.status IN ('approved', 'completed', 'waiting_review', 'needs_correction')
  ));

-- Create new policies for job_completion_photos
-- Matches the permission logic for completions
CREATE POLICY "Users can view photos for active jobs" ON public.job_completion_photos
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.job_completions jc
    JOIN public.jobs j ON j.id = jc.job_id
    WHERE jc.id = job_completion_photos.completion_id 
    AND j.status IN ('approved', 'completed', 'waiting_review', 'needs_correction')
  ));
