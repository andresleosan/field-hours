-- Add category to materials table
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS category TEXT;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(name)
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view suppliers"
ON public.suppliers
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage suppliers"
ON public.suppliers
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role));

-- Create invoice extraction training table
CREATE TABLE IF NOT EXISTS public.invoice_extraction_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(supplier_id, field_name)
);

ALTER TABLE public.invoice_extraction_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view training data"
ON public.invoice_extraction_training
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage training data"
ON public.invoice_extraction_training
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role));

-- Add supplier_id and image_url to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS extracted_data JSONB;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- Create storage bucket for invoice images
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Users can view their own invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "Managers can view all invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'invoices' AND has_role(auth.uid(), 'manager'::app_role));