PRAGMA foreign_keys = ON;

-- A payroll run is an immutable financial snapshot once approved. Worker
-- identifiers are copied into the line snapshot so a later profile edit does
-- not change the result that an administrator reviewed.
CREATE TABLE IF NOT EXISTS workforce_payroll_runs (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL CHECK (period_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  pay_date TEXT NOT NULL CHECK (pay_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'changes_requested')),
  gross_pay_pence INTEGER NOT NULL CHECK (gross_pay_pence >= 0),
  worker_social_security_pence INTEGER NOT NULL CHECK (worker_social_security_pence >= 0),
  income_tax_pence INTEGER NOT NULL CHECK (income_tax_pence >= 0),
  net_pay_pence INTEGER NOT NULL CHECK (net_pay_pence >= 0),
  employer_social_security_pence INTEGER NOT NULL CHECK (employer_social_security_pence >= 0),
  employer_total_cost_pence INTEGER NOT NULL CHECK (employer_total_cost_pence >= 0),
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES workforce_users(id) ON DELETE SET NULL,
  review_note TEXT,
  UNIQUE (organization_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS workforce_payroll_run_lines (
  payroll_run_id TEXT NOT NULL REFERENCES workforce_payroll_runs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  employee_number TEXT,
  profile_status TEXT NOT NULL CHECK (profile_status IN ('pending_review', 'approved', 'changes_requested')),
  shift_count INTEGER NOT NULL CHECK (shift_count >= 0),
  net_minutes INTEGER NOT NULL CHECK (net_minutes >= 0),
  itis_rate_bps INTEGER NOT NULL CHECK (itis_rate_bps BETWEEN 0 AND 10000),
  gross_pay_pence INTEGER NOT NULL CHECK (gross_pay_pence >= 0),
  worker_social_security_pence INTEGER NOT NULL CHECK (worker_social_security_pence >= 0),
  income_tax_pence INTEGER NOT NULL CHECK (income_tax_pence >= 0),
  net_pay_pence INTEGER NOT NULL CHECK (net_pay_pence >= 0),
  employer_social_security_pence INTEGER NOT NULL CHECK (employer_social_security_pence >= 0),
  employer_total_cost_pence INTEGER NOT NULL CHECK (employer_total_cost_pence >= 0),
  warnings_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (payroll_run_id, user_id)
);

CREATE INDEX IF NOT EXISTS workforce_payroll_runs_org_status_idx
  ON workforce_payroll_runs (organization_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS workforce_payroll_run_lines_run_idx
  ON workforce_payroll_run_lines (payroll_run_id, display_name COLLATE NOCASE);

-- Rollback (manual, only after a verified backup and explicit approval):
-- DROP TABLE workforce_payroll_run_lines;
-- DROP TABLE workforce_payroll_runs;
