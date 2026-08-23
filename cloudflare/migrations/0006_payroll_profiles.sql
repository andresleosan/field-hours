PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_payroll_profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES workforce_users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL CHECK (length(legal_name) BETWEEN 2 AND 160),
  address TEXT NOT NULL CHECK (length(address) BETWEEN 2 AND 250),
  employee_number TEXT NOT NULL CHECK (length(employee_number) BETWEEN 1 AND 40),
  social_security_ciphertext TEXT,
  tax_reference_ciphertext TEXT,
  social_reference_ciphertext TEXT,
  bank_account_name_ciphertext TEXT,
  bank_sort_code_ciphertext TEXT,
  bank_account_number_ciphertext TEXT,
  itis_rate_bps INTEGER NOT NULL CHECK (itis_rate_bps BETWEEN 0 AND 10000),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'changes_requested')),
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES workforce_users(id) ON DELETE SET NULL,
  review_note TEXT,
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS workforce_payroll_profiles_org_status_idx
  ON workforce_payroll_profiles (organization_id, status, submitted_at DESC);

-- Rollback (manual, only after a verified backup and explicit approval):
-- DROP TABLE workforce_payroll_profiles;
