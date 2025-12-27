-- Create table for material delivery requests
CREATE TABLE public.material_delivery_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Create table for items in each delivery request
CREATE TABLE public.material_delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.material_delivery_requests(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_delivery_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for material_delivery_requests
CREATE POLICY "Builders can create delivery requests"
ON public.material_delivery_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Builders can view own requests"
ON public.material_delivery_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all delivery requests"
ON public.material_delivery_requests
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update delivery requests"
ON public.material_delivery_requests
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete delivery requests"
ON public.material_delivery_requests
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for material_delivery_items
CREATE POLICY "Users can create items for their requests"
ON public.material_delivery_items
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.material_delivery_requests
  WHERE id = request_id AND user_id = auth.uid()
));

CREATE POLICY "Users can view items for their requests"
ON public.material_delivery_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.material_delivery_requests
  WHERE id = request_id AND user_id = auth.uid()
));

CREATE POLICY "Managers can view all delivery items"
ON public.material_delivery_items
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete delivery items"
ON public.material_delivery_items
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));