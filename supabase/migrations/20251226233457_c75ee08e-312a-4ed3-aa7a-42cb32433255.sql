-- Create rubbish collection requests table
CREATE TABLE public.rubbish_collection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  location_lat NUMERIC,
  location_lng NUMERIC,
  photo_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.rubbish_collection_requests ENABLE ROW LEVEL SECURITY;

-- Builders can create requests
CREATE POLICY "Builders can create rubbish requests"
ON public.rubbish_collection_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Builders can view their own requests
CREATE POLICY "Builders can view own requests"
ON public.rubbish_collection_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Managers can view all requests
CREATE POLICY "Managers can view all rubbish requests"
ON public.rubbish_collection_requests
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can update requests (to mark as resolved)
CREATE POLICY "Managers can update rubbish requests"
ON public.rubbish_collection_requests
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete requests
CREATE POLICY "Managers can delete rubbish requests"
ON public.rubbish_collection_requests
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Create storage bucket for rubbish photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('rubbish-photos', 'rubbish-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for rubbish photos
CREATE POLICY "Authenticated users can upload rubbish photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rubbish-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view rubbish photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'rubbish-photos');

CREATE POLICY "Managers can delete rubbish photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'rubbish-photos' AND has_role(auth.uid(), 'manager'::app_role));