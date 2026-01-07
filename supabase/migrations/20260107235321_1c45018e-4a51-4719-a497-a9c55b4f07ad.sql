-- Fix projects table RLS policy - restrict to authenticated users only
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Everyone can view projects" ON public.projects;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view projects" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (true);