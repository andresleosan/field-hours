-- Add finished_at column to track when a project was marked as finished
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS finished_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient querying of old finished projects
CREATE INDEX IF NOT EXISTS idx_projects_finished_at ON public.projects(finished_at) WHERE finished_at IS NOT NULL;