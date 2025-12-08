-- Add section column to jobs table for organizing jobs by sections
ALTER TABLE public.jobs ADD COLUMN section TEXT DEFAULT NULL;

-- Create index for faster section-based queries
CREATE INDEX idx_jobs_section ON public.jobs(section);