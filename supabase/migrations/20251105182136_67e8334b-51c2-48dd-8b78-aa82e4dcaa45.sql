-- Retry migration with policy creation guarded via DO blocks

-- 1) Add columns (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name = 'job_completions' AND column_name = 'voice_note_url'
  ) THEN
    ALTER TABLE public.job_completions ADD COLUMN voice_note_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name = 'jobs' AND column_name = 'manager_feedback'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN manager_feedback text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name = 'jobs' AND column_name = 'manager_voice_note_url'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN manager_voice_note_url text;
  END IF;
END $$;

-- 2) Buckets (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-voice-notes') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('job-voice-notes', 'job-voice-notes', false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-review-voice-notes') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('job-review-voice-notes', 'job-review-voice-notes', true);
  END IF;
END $$;

-- 3) Policies for storage.objects (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload own completion voice notes'
  ) THEN
    CREATE POLICY "Users can upload own completion voice notes"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'job-voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can view own completion voice notes'
  ) THEN
    CREATE POLICY "Users can view own completion voice notes"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'job-voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Managers can view all completion voice notes'
  ) THEN
    CREATE POLICY "Managers can view all completion voice notes"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'job-voice-notes' AND has_role(auth.uid(), 'manager'::app_role)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Managers can upload review voice notes'
  ) THEN
    CREATE POLICY "Managers can upload review voice notes"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'job-review-voice-notes' AND has_role(auth.uid(), 'manager'::app_role)
    );
  END IF;
END $$;