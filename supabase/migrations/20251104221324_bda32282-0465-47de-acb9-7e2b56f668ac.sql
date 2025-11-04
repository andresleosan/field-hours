-- Add storage bucket for job photos (when managers create jobs)
INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for job-photos bucket
CREATE POLICY "Managers can upload job photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-photos' AND
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "Everyone can view job photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-photos');

-- Create table for job photos (attached when creating jobs)
CREATE TABLE IF NOT EXISTS public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view job photos"
ON public.job_photos FOR SELECT
USING (true);

CREATE POLICY "Managers can create job photos"
ON public.job_photos FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'));

-- Create table for job time tracking
CREATE TABLE IF NOT EXISTS public.job_time_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.job_time_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job time tracking"
ON public.job_time_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all job time tracking"
ON public.job_time_tracking FOR SELECT
USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can create own job time tracking"
ON public.job_time_tracking FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job time tracking"
ON public.job_time_tracking FOR UPDATE
USING (auth.uid() = user_id);

-- Create table for job collaborators (builders who helped)
CREATE TABLE IF NOT EXISTS public.job_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_completion_id uuid NOT NULL REFERENCES public.job_completions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(job_completion_id, user_id)
);

ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view job collaborators"
ON public.job_collaborators FOR SELECT
USING (true);

CREATE POLICY "Users can add collaborators to their completions"
ON public.job_collaborators FOR INSERT
WITH CHECK (auth.uid() = added_by);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_project_status ON public.jobs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_job_time_tracking_job ON public.job_time_tracking(job_id);
CREATE INDEX IF NOT EXISTS idx_job_collaborators_completion ON public.job_collaborators(job_completion_id);