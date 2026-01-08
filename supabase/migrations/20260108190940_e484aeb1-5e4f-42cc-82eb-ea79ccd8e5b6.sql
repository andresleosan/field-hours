-- Fix invoices table RLS policies - change from RESTRICTIVE to PERMISSIVE
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Builders can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Managers can view all invoices" ON public.invoices;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Builders can view own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (auth.uid() = uploaded_by);

CREATE POLICY "Managers can view all invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role));