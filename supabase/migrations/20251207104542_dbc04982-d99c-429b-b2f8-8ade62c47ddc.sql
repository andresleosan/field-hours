-- Add UPDATE policy for material_usage so builders can update their own material usage (e.g., link to job_id)
CREATE POLICY "Builders can update own material usage" 
ON public.material_usage 
FOR UPDATE 
USING (auth.uid() = used_by)
WITH CHECK (auth.uid() = used_by);