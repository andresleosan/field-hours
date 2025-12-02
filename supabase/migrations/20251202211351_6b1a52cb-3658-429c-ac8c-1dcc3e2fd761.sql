-- Add policy allowing builders to view their own completions
CREATE POLICY "Users can view own completions" 
ON public.job_completions 
FOR SELECT 
USING (completed_by = auth.uid());

-- Also add a constraint to limit submissions to 10 per job
-- First, create a function to check submission count
CREATE OR REPLACE FUNCTION public.check_max_submissions()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.job_completions WHERE job_id = NEW.job_id) >= 10 THEN
    RAISE EXCEPTION 'Maximum of 10 submissions per job reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce the limit
CREATE TRIGGER enforce_max_submissions
BEFORE INSERT ON public.job_completions
FOR EACH ROW
EXECUTE FUNCTION public.check_max_submissions();