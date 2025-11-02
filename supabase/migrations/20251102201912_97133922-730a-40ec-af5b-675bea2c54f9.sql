-- Allow builders to view materials (without costs)
CREATE POLICY "Builders can view materials"
ON public.materials
FOR SELECT
TO authenticated
USING (true);