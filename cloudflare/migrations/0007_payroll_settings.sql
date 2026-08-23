PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_payroll_settings (
  organization_id TEXT PRIMARY KEY NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  hourly_rate_pence INTEGER NOT NULL CHECK (hourly_rate_pence BETWEEN 1 AND 100000000),
  pay_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('monthly')),
  pay_day INTEGER NOT NULL DEFAULT 1 CHECK (pay_day BETWEEN 1 AND 28),
  business_name TEXT NOT NULL CHECK (length(business_name) BETWEEN 2 AND 160),
  business_address TEXT NOT NULL CHECK (length(business_address) BETWEEN 2 AND 250),
  business_tax_reference_ciphertext TEXT,
  business_social_reference_ciphertext TEXT,
  worker_social_security_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (worker_social_security_rate_bps BETWEEN 0 AND 10000),
  employer_social_security_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (employer_social_security_rate_bps BETWEEN 0 AND 10000),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL REFERENCES workforce_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS workforce_payroll_settings_updated_idx
  ON workforce_payroll_settings (updated_at DESC);

-- Rollback (manual, only after a verified backup and explicit approval):
-- DROP INDEX IF EXISTS workforce_payroll_settings_updated_idx;
-- DROP TABLE workforce_payroll_settings;
