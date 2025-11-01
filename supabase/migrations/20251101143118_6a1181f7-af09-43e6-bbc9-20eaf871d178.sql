-- Fix material cost data exposure - restrict to managers only
-- Current issue: All authenticated users can view material costs (competitive business intelligence)
-- Fix: Managers can view all materials with costs, builders see catalog without costs

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can view materials" ON public.materials;

-- Create a view for builders that excludes cost data
CREATE OR REPLACE VIEW public.materials_catalog AS
SELECT 
  id, 
  name, 
  unit, 
  category, 
  created_at
FROM public.materials;

-- Grant SELECT on the catalog view to authenticated users
GRANT SELECT ON public.materials_catalog TO authenticated;

-- Managers can view all materials with full cost data
CREATE POLICY "Managers can view all materials with costs" ON public.materials
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Builders can still INSERT materials (but without seeing costs of existing ones)
-- Keep the existing insert policy
-- Note: The "Authenticated users can create materials" policy remains active

-- Also need to update material_usage visibility for consistency
DROP POLICY IF EXISTS "Everyone can view material usage" ON public.material_usage;

-- Managers can view all material usage (operational oversight)
CREATE POLICY "Managers can view all material usage" ON public.material_usage
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Builders can only view their own material usage records
CREATE POLICY "Users can view own material usage" ON public.material_usage
FOR SELECT 
USING (auth.uid() = used_by);