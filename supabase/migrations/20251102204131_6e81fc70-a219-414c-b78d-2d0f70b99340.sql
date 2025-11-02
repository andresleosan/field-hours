-- Drop the existing builders view policy and create a more permissive one
DROP POLICY IF EXISTS "Builders can view materials" ON public.materials;

-- Allow everyone (authenticated and anonymous) to view materials
CREATE POLICY "Everyone can view materials catalog"
ON public.materials
FOR SELECT
USING (true);