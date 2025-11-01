-- Fix invoices table privacy - restrict financial data access
-- Current issue: All authenticated users can view all invoices including financial data
-- Fix: Managers can view all invoices, builders can only view invoices they uploaded

DROP POLICY IF EXISTS "Everyone can view invoices" ON public.invoices;

-- Managers can view all invoices (for financial oversight and reporting)
CREATE POLICY "Managers can view all invoices" ON public.invoices
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Builders can only view invoices they uploaded
CREATE POLICY "Builders can view own invoices" ON public.invoices
FOR SELECT 
USING (auth.uid() = uploaded_by);