-- Update jobs status to include waiting_review and needs_correction
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
  CHECK (status IN ('pending', 'approved', 'waiting_review', 'needs_correction', 'completed'));