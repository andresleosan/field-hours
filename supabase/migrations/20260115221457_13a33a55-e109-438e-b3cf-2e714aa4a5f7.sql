-- Create project_members table to track which users are assigned to which projects
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Managers can manage project members (full access)
CREATE POLICY "Managers can manage project members"
ON public.project_members
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role));

-- Users can view their own memberships
CREATE POLICY "Users can view own project memberships"
ON public.project_members
FOR SELECT
USING (user_id = auth.uid());

-- Drop the overly permissive jobs policies
DROP POLICY IF EXISTS "Everyone can view to-do and completed jobs" ON public.jobs;
DROP POLICY IF EXISTS "Everyone can view waiting review jobs" ON public.jobs;

-- Create new project-scoped policy for builders
-- Users can only see jobs for projects they are assigned to
CREATE POLICY "Users view jobs for assigned projects"
ON public.jobs
FOR SELECT
USING (
  -- User is assigned to this project
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = auth.uid()
    AND project_id = jobs.project_id
  )
  -- Or user is a manager (managers can see all)
  OR has_role(auth.uid(), 'manager'::app_role)
  -- Or user created the job (for pending jobs)
  OR (created_by = auth.uid() AND status = 'pending')
);

-- Enable realtime for project_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;