-- Drop any existing triggers on job_completions related to job status
DROP TRIGGER IF EXISTS trg_set_job_status_waiting_review ON job_completions;

-- Recreate the trigger to update job status when a completion is created or updated
CREATE TRIGGER trg_set_job_status_waiting_review
  AFTER INSERT OR UPDATE ON job_completions
  FOR EACH ROW
  EXECUTE FUNCTION set_job_status_waiting_review();