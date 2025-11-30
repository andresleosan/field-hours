-- Drop the existing view
DROP VIEW IF EXISTS public.materials_catalog;

-- Recreate the view with security_invoker enabled to respect RLS policies
CREATE VIEW public.materials_catalog
WITH (security_invoker = on)
AS
SELECT 
  id,
  name,
  unit,
  category,
  created_at
FROM public.materials;