-- Remove the unique constraint that prevents multiple submissions from the same builder on the same job
-- This allows builders to resubmit jobs up to 30 times as needed

-- Drop the unique constraint on job_completions
ALTER TABLE public.job_completions 
DROP CONSTRAINT IF EXISTS job_completions_job_id_completed_by_key;

-- Ensure submission_number is properly indexed for efficient queries
CREATE INDEX IF NOT EXISTS idx_job_completions_job_submission 
ON public.job_completions(job_id, submission_number DESC);

-- Add a check to ensure submission_number is between 1 and 30
ALTER TABLE public.job_completions 
ADD CONSTRAINT check_submission_number_range 
CHECK (submission_number >= 1 AND submission_number <= 30);