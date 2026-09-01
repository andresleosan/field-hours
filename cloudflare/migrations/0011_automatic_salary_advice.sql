PRAGMA foreign_keys = ON;

-- Automatic Salary Advice configuration.
-- The hourly rate belongs to the active employee profile and is intentionally
-- nullable for identities that have not yet been configured by an admin.
ALTER TABLE workforce_salary_advice_profiles
  ADD COLUMN hourly_rate_pence INTEGER
  CHECK (hourly_rate_pence BETWEEN 1 AND 1000000);

-- ITIS is versioned by organization and rules year so an admin can update the
-- current year's percentage without overwriting a previous year's setup.
CREATE TABLE workforce_salary_advice_itis_rates (
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  rules_year INTEGER NOT NULL CHECK (rules_year BETWEEN 2000 AND 2100),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL REFERENCES workforce_users(id) ON DELETE RESTRICT,
  PRIMARY KEY (organization_id, rules_year)
);

CREATE INDEX workforce_salary_advice_itis_rates_updated_idx
  ON workforce_salary_advice_itis_rates (organization_id, updated_at DESC);

-- Rollback (manual, only after a verified backup and explicit approval):
-- DROP INDEX IF EXISTS workforce_salary_advice_itis_rates_updated_idx;
-- DROP TABLE workforce_salary_advice_itis_rates;
-- SQLite does not provide a portable DROP COLUMN for this additive nullable
-- field; leave hourly_rate_pence in place when rolling back application code.
