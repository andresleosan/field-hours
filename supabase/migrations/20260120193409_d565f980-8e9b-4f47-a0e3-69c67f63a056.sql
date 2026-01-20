-- Update the jobs RLS policy to also allow users who have time tracking entries for a project
-- This ensures builders who have clocked in can see jobs even if not explicitly in project_members

DROP POLICY IF EXISTS "Users view jobs for assigned projects" ON public.jobs;

-- Create new policy that includes time tracking as assignment
CREATE POLICY "Users view jobs for assigned projects"
ON public.jobs
FOR SELECT
USING (
  -- User is explicitly assigned to this project
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = auth.uid()
    AND project_id = jobs.project_id
  )
  -- Or user has time tracking entries for this project (has worked on it)
  OR EXISTS (
    SELECT 1 FROM public.time_tracking
    WHERE user_id = auth.uid()
    AND project_id = jobs.project_id
  )
  -- Or user is a manager (managers can see all)
  OR has_role(auth.uid(), 'manager'::app_role)
  -- Or user created the job (for pending jobs)
  OR (created_by = auth.uid() AND status = 'pending')
);

-- Also create a trigger to auto-add builders to project_members when they clock in
CREATE OR REPLACE FUNCTION public.auto_assign_builder_to_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only for builders (not managers)
  IF has_role(NEW.user_id, 'builder'::app_role) THEN
    -- Insert into project_members if not already there
    INSERT INTO public.project_members (project_id, user_id, assigned_by, assigned_at)
    VALUES (NEW.project_id, NEW.user_id, NEW.user_id, now())
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on time_tracking
DROP TRIGGER IF EXISTS auto_assign_on_clock_in ON public.time_tracking;
CREATE TRIGGER auto_assign_on_clock_in
AFTER INSERT ON public.time_tracking
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_builder_to_project();

-- Backfill: Add existing builders to project_members based on their time tracking history
INSERT INTO public.project_members (project_id, user_id, assigned_by, assigned_at)
SELECT DISTINCT tt.project_id, tt.user_id, tt.user_id, MIN(tt.clock_in)
FROM public.time_tracking tt
JOIN public.user_roles ur ON tt.user_id = ur.user_id AND ur.role = 'builder'
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_members pm 
  WHERE pm.project_id = tt.project_id AND pm.user_id = tt.user_id
)
GROUP BY tt.project_id, tt.user_id
ON CONFLICT (project_id, user_id) DO NOTHING;