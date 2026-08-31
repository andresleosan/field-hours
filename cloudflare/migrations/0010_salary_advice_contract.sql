PRAGMA foreign_keys = ON;

-- Preflight before production (both queries must return no rows):
-- SELECT p.organization_id, upper(trim(p.employee_number)) AS normalized_employee_number,
--        COUNT(*) AS duplicates
-- FROM workforce_payroll_profiles p
-- JOIN workforce_memberships m
--   ON m.organization_id = p.organization_id AND m.user_id = p.user_id AND m.role = 'worker'
-- JOIN workforce_users u ON u.id = p.user_id AND u.disabled_at IS NULL
-- WHERE p.tax_reference_ciphertext IS NOT NULL AND p.social_reference_ciphertext IS NOT NULL
-- GROUP BY p.organization_id, upper(trim(p.employee_number))
-- HAVING COUNT(*) > 1;
-- SELECT p.organization_id, p.user_id, p.employee_number
-- FROM workforce_payroll_profiles p
-- JOIN workforce_memberships m
--   ON m.organization_id = p.organization_id AND m.user_id = p.user_id AND m.role = 'worker'
-- JOIN workforce_users u ON u.id = p.user_id AND u.disabled_at IS NULL
-- WHERE p.tax_reference_ciphertext IS NOT NULL AND p.social_reference_ciphertext IS NOT NULL
--   AND (length(trim(p.employee_number)) NOT BETWEEN 1 AND 40
--     OR substr(upper(trim(p.employee_number)), 1, 1) NOT GLOB '[A-Z0-9]'
--     OR upper(trim(p.employee_number)) GLOB '*[^A-Z0-9._/-]*');

-- Clean active storage for the worker identity printed on Salary Advice documents.
-- The legacy payroll-profile table remains untouched as historical data; active code no longer writes it.
CREATE TABLE workforce_salary_advice_profiles (
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES workforce_users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL CHECK (length(legal_name) BETWEEN 2 AND 160),
  address TEXT NOT NULL CHECK (length(address) BETWEEN 2 AND 250),
  employee_number TEXT NOT NULL COLLATE NOCASE CHECK (
    length(employee_number) BETWEEN 1 AND 40
    AND employee_number = upper(employee_number)
    AND substr(employee_number, 1, 1) GLOB '[A-Z0-9]'
    AND employee_number NOT GLOB '*[^A-Z0-9._/-]*'
  ),
  tax_reference_ciphertext TEXT NOT NULL,
  social_reference_ciphertext TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES workforce_memberships(organization_id, user_id) ON DELETE CASCADE,
  UNIQUE (organization_id, employee_number)
);

CREATE INDEX workforce_salary_advice_profiles_org_saved_idx
  ON workforce_salary_advice_profiles (organization_id, saved_at DESC);

-- Copy only complete identities. Incomplete legacy rows remain available for manual recovery and
-- are intentionally shown as incomplete until the worker supplies all required active fields.
INSERT INTO workforce_salary_advice_profiles
  (organization_id, user_id, legal_name, address, employee_number,
   tax_reference_ciphertext, social_reference_ciphertext, saved_at)
SELECT p.organization_id, p.user_id, p.legal_name, p.address, upper(trim(p.employee_number)),
       p.tax_reference_ciphertext, p.social_reference_ciphertext, p.submitted_at
FROM workforce_payroll_profiles p
JOIN workforce_memberships m
  ON m.organization_id = p.organization_id AND m.user_id = p.user_id AND m.role = 'worker'
JOIN workforce_users u ON u.id = p.user_id AND u.disabled_at IS NULL
WHERE p.tax_reference_ciphertext IS NOT NULL
  AND p.social_reference_ciphertext IS NOT NULL;

-- Clean active storage for the employer identity printed on Salary Advice documents.
CREATE TABLE workforce_salary_advice_settings (
  organization_id TEXT PRIMARY KEY NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL CHECK (length(business_name) BETWEEN 2 AND 160),
  business_address TEXT NOT NULL CHECK (length(business_address) BETWEEN 2 AND 250),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL REFERENCES workforce_users(id) ON DELETE RESTRICT
);

CREATE INDEX workforce_salary_advice_settings_updated_idx
  ON workforce_salary_advice_settings (updated_at DESC);

INSERT INTO workforce_salary_advice_settings
  (organization_id, business_name, business_address, updated_at, updated_by)
SELECT organization_id, business_name, business_address, updated_at, updated_by
FROM workforce_payroll_settings;

-- Preferred rollback after application traffic: revert Worker/frontend first and KEEP these tables
-- for reconciliation. Before any later DROP, export both new tables, compare saved_at/updated_at
-- against the cutover timestamp, reconcile those rows into an approved destination, verify the
-- backup and obtain separate explicit approval. Schema removal, if then required:
-- DROP INDEX IF EXISTS workforce_salary_advice_settings_updated_idx;
-- DROP TABLE workforce_salary_advice_settings;
-- DROP INDEX IF EXISTS workforce_salary_advice_profiles_org_saved_idx;
-- DROP TABLE workforce_salary_advice_profiles;
