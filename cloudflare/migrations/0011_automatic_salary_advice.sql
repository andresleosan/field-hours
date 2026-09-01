PRAGMA foreign_keys = ON;

-- Automatic Salary Advice configuration.
-- The hourly rate belongs to the active employee profile and is intentionally
-- nullable for identities that have not yet been configured by an admin.
ALTER TABLE workforce_salary_advice_profiles
  ADD COLUMN hourly_rate_pence INTEGER
  CHECK (hourly_rate_pence BETWEEN 1 AND 1000000);

-- ITIS belongs to the employee and is copied from the employee's current notice.
ALTER TABLE workforce_salary_advice_profiles
  ADD COLUMN itis_rate_bps INTEGER
  CHECK (itis_rate_bps BETWEEN 0 AND 10000);

-- Preserve the employee-level value from the retired profile table when present.
UPDATE workforce_salary_advice_profiles
SET itis_rate_bps = (
  SELECT legacy.itis_rate_bps
  FROM workforce_payroll_profiles legacy
  WHERE legacy.organization_id = workforce_salary_advice_profiles.organization_id
    AND legacy.user_id = workforce_salary_advice_profiles.user_id
);

-- Rollback (manual, only after a verified backup and explicit approval):
-- SQLite does not provide a portable DROP COLUMN for this additive nullable
-- fields; leave hourly_rate_pence and itis_rate_bps in place when rolling back
-- application code. Revert the Worker/frontend first; no destructive rollback is
-- required for this additive migration.
