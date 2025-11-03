-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'completed')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job completions table
CREATE TABLE public.job_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, completed_by)
);

-- Create job completion photos table
CREATE TABLE public.job_completion_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  completion_id UUID NOT NULL REFERENCES public.job_completions(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job materials table to link materials to jobs
CREATE TABLE public.job_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  material_usage_id UUID NOT NULL REFERENCES public.material_usage(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for job completion photos
INSERT INTO storage.buckets (id, name, public) VALUES ('job-completion-photos', 'job-completion-photos', false);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_completion_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_materials ENABLE ROW LEVEL SECURITY;

-- Jobs policies
CREATE POLICY "Everyone can view approved jobs" ON public.jobs
  FOR SELECT USING (status = 'approved' OR status = 'completed');

CREATE POLICY "Everyone can view pending jobs they created" ON public.jobs
  FOR SELECT USING (created_by = auth.uid() AND status = 'pending');

CREATE POLICY "Managers can view all jobs" ON public.jobs
  FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Builders can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Managers can create approved jobs" ON public.jobs
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'manager') AND created_by = auth.uid());

CREATE POLICY "Managers can update jobs" ON public.jobs
  FOR UPDATE USING (has_role(auth.uid(), 'manager'));

-- Job completions policies
CREATE POLICY "Users can view completions for approved jobs" ON public.job_completions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.jobs WHERE jobs.id = job_completions.job_id AND (jobs.status = 'approved' OR jobs.status = 'completed')
  ));

CREATE POLICY "Managers can view all completions" ON public.job_completions
  FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Builders can create completions" ON public.job_completions
  FOR INSERT WITH CHECK (auth.uid() = completed_by);

-- Job completion photos policies
CREATE POLICY "Users can view photos for completions" ON public.job_completion_photos
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.job_completions jc
    JOIN public.jobs j ON j.id = jc.job_id
    WHERE jc.id = job_completion_photos.completion_id AND (j.status = 'approved' OR j.status = 'completed')
  ));

CREATE POLICY "Managers can view all photos" ON public.job_completion_photos
  FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can create photos for their completions" ON public.job_completion_photos
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.job_completions WHERE id = job_completion_photos.completion_id AND completed_by = auth.uid()
  ));

-- Job materials policies
CREATE POLICY "Everyone can view job materials" ON public.job_materials
  FOR SELECT USING (true);

CREATE POLICY "Users can link materials to jobs" ON public.job_materials
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_usage WHERE id = job_materials.material_usage_id AND used_by = auth.uid()
  ));

CREATE POLICY "Managers can manage job materials" ON public.job_materials
  FOR ALL USING (has_role(auth.uid(), 'manager'));

-- Storage policies for job completion photos
CREATE POLICY "Users can upload job completion photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-completion-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view job completion photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-completion-photos');

CREATE POLICY "Managers can view all job completion photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-completion-photos' AND
    has_role(auth.uid(), 'manager')
  );

-- Add trigger for updating updated_at on jobs
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add job_id column to material_usage to optionally link materials to jobs
ALTER TABLE public.material_usage ADD COLUMN job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;