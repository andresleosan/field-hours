PRAGMA foreign_keys = ON;

-- Allow multiple completed shifts on the same work date. The existing
-- workforce_one_open_shift_per_worker index still prevents overlapping open shifts.
DROP INDEX IF EXISTS workforce_one_shift_per_worker_day;
CREATE INDEX IF NOT EXISTS workforce_shifts_org_user_date_idx
  ON workforce_shifts (organization_id, user_id, work_date, clock_in_at DESC);

-- Worker-created projects only need a name and a short description. Location
-- remains optional because GPS is captured from the worker at clock-in.
ALTER TABLE workforce_projects ADD COLUMN description TEXT NOT NULL DEFAULT ''
  CHECK (length(description) <= 300);

-- Rollback (manual, only after a verified backup and explicit approval):
-- 1. Ensure no worker has more than one shift per work_date.
-- 2. DROP INDEX IF EXISTS workforce_shifts_org_user_date_idx;
-- 3. CREATE UNIQUE INDEX workforce_one_shift_per_worker_day
--      ON workforce_shifts (organization_id, user_id, work_date)
--      WHERE work_date IS NOT NULL;
-- 4. SQLite does not support DROP COLUMN safely on all deployed versions;
--    leave description in place or rebuild workforce_projects after backup.
