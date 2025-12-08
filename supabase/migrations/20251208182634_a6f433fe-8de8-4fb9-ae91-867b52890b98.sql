-- Add UPDATE and DELETE policies for invoice_items table
-- Allow managers to update any invoice items
CREATE POLICY "Managers can update invoice items" 
ON public.invoice_items 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to delete any invoice items
CREATE POLICY "Managers can delete invoice items" 
ON public.invoice_items 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow uploaders to update their own invoice items within 24 hours
CREATE POLICY "Users can update own recent invoice items" 
ON public.invoice_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.uploaded_by = auth.uid()
    AND invoices.created_at > NOW() - INTERVAL '24 hours'
  )
);

-- Allow uploaders to delete their own invoice items within 24 hours
CREATE POLICY "Users can delete own recent invoice items" 
ON public.invoice_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.uploaded_by = auth.uid()
    AND invoices.created_at > NOW() - INTERVAL '24 hours'
  )
);