-- Add photo_url column to storage_materials table
ALTER TABLE public.storage_materials
ADD COLUMN photo_url text NULL;

-- Create storage bucket for material photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('storage-material-photos', 'storage-material-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for storage material photos bucket
CREATE POLICY "Everyone can view material photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'storage-material-photos');

CREATE POLICY "Managers can upload material photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'storage-material-photos' AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update material photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'storage-material-photos' AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete material photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'storage-material-photos' AND has_role(auth.uid(), 'manager'::app_role));