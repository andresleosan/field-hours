-- Fix invoice_items table privacy - align with invoices table security
-- Current issue: All authenticated users can view all invoice line items, bypassing invoice security
-- Fix: Managers can view all invoice items, builders can only view items from their own invoices

DROP POLICY IF EXISTS "Everyone can view invoice items" ON public.invoice_items;

-- Managers can view all invoice items (for financial analysis and oversight)
CREATE POLICY "Managers can view all invoice items" ON public.invoice_items
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Builders can only view invoice items from invoices they uploaded
CREATE POLICY "Users can view own invoice items" ON public.invoice_items
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.uploaded_by = auth.uid()
  )
);