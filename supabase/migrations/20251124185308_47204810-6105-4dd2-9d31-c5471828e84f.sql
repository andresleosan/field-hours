-- Create a security definer function to check if a completion belongs to a user
-- This bypasses RLS restrictions when checking completion ownership
CREATE OR REPLACE FUNCTION public.is_completion_owner(_completion_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_completions
    WHERE id = _completion_id
      AND completed_by = _user_id
  )
$$;

-- Drop the existing restrictive policy for inserting photos
DROP POLICY IF EXISTS "Users can create photos for their completions" ON public.job_completion_photos;

-- Create a new policy using the security definer function
CREATE POLICY "Users can create photos for their completions"
ON public.job_completion_photos
FOR INSERT
WITH CHECK (public.is_completion_owner(completion_id, auth.uid()));