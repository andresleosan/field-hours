-- Ensure realtime + automatic status update when a job is submitted for review
-- 1) Create trigger to set jobs.status = 'waiting_review' after job_completions insert/update
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_job_status_waiting_review'
  ) THEN
    CREATE TRIGGER trg_set_job_status_waiting_review
    AFTER INSERT OR UPDATE ON public.job_completions
    FOR EACH ROW EXECUTE FUNCTION public.set_job_status_waiting_review();
  END IF;
END $$;

-- 2) Ensure REPLICA IDENTITY FULL for realtime payloads
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_completions REPLICA IDENTITY FULL;
ALTER TABLE public.job_completion_photos REPLICA IDENTITY FULL;
ALTER TABLE public.job_time_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.job_materials REPLICA IDENTITY FULL;
ALTER TABLE public.material_usage REPLICA IDENTITY FULL;
ALTER TABLE public.job_collaborators REPLICA IDENTITY FULL;

-- 3) Add tables to realtime publication (idempotent)
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_completions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_completion_photos;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_time_tracking;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_materials;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.material_usage;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_collaborators;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;