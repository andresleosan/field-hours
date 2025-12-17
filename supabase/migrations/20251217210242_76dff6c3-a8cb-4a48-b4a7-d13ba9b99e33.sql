-- Drop the old constraint and add updated one with 'finished' status
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'on_hold'::text, 'finished'::text]));