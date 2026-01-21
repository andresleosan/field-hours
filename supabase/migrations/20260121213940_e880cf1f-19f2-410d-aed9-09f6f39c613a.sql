-- SECURITY: avoid overly permissive INSERT policy (linter 0024)
DROP POLICY IF EXISTS "Authenticated users can create materials" ON public.materials;

CREATE POLICY "Authenticated users can create materials"
ON public.materials
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
