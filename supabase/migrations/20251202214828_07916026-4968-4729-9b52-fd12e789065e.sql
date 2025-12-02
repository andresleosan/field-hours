-- Allow builders to delete their own material usage records
CREATE POLICY "Builders can delete own material usage"
ON public.material_usage
FOR DELETE
USING (auth.uid() = used_by);