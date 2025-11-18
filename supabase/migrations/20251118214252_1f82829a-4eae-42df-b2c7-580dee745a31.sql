-- Remove the UPDATE policy that's causing issues
-- We'll always INSERT new completions instead of updating
DROP POLICY IF EXISTS "Builders can update their own completions" ON public.job_completions;

-- Add a submission number to track resubmissions
ALTER TABLE public.job_completions 
ADD COLUMN IF NOT EXISTS submission_number INTEGER DEFAULT 1;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_job_completions_job_id_created 
ON public.job_completions(job_id, completed_at DESC);