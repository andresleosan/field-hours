-- Create daily_reports table for builders to submit daily reports
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_reports
CREATE POLICY "Builders can create their own daily reports"
ON public.daily_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own daily reports"
ON public.daily_reports
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all daily reports"
ON public.daily_reports
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Create daily_report_photos table for photos attached to daily reports
CREATE TABLE public.daily_report_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_report_photos
CREATE POLICY "Builders can create photos for their reports"
ON public.daily_report_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.daily_reports
    WHERE daily_reports.id = daily_report_photos.report_id
    AND daily_reports.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view photos for their reports"
ON public.daily_report_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports
    WHERE daily_reports.id = daily_report_photos.report_id
    AND daily_reports.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can view all report photos"
ON public.daily_report_photos
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Create storage bucket for daily report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-report-photos', 'daily-report-photos', false);

-- Storage policies for daily report photos
CREATE POLICY "Users can upload photos to their reports"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'daily-report-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own report photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'daily-report-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Managers can view all report photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'daily-report-photos'
  AND has_role(auth.uid(), 'manager'::app_role)
);