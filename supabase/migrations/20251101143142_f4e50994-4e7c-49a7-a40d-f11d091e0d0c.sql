-- Fix the materials_catalog view to not use SECURITY DEFINER
-- The view should inherit the permissions of the querying user

DROP VIEW IF EXISTS public.materials_catalog;

-- Create a standard view without SECURITY DEFINER
CREATE VIEW public.materials_catalog AS
SELECT 
  id, 
  name, 
  unit, 
  category, 
  created_at
FROM public.materials;

-- Grant SELECT on the catalog view to authenticated users
GRANT SELECT ON public.materials_catalog TO authenticated;