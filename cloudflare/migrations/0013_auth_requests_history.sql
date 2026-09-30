-- Allow any number of approved/rejected requests per email; keep one pending per email and type.
-- SQLite cannot drop a table-level UNIQUE, so the table is rebuilt. No other table references it.
CREATE TABLE workforce_auth_requests_new (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'migration')),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  google_subject TEXT NOT NULL,
  existing_user_id TEXT REFERENCES workforce_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES workforce_users(id) ON DELETE SET NULL
);
INSERT INTO workforce_auth_requests_new
  (id, organization_id, request_type, email, display_name, google_subject, existing_user_id,
   status, rejection_reason, requested_at, reviewed_at, reviewed_by)
SELECT id, organization_id, request_type, email, display_name, google_subject, existing_user_id,
       status, rejection_reason, requested_at, reviewed_at, reviewed_by
FROM workforce_auth_requests;
DROP TABLE workforce_auth_requests;
ALTER TABLE workforce_auth_requests_new RENAME TO workforce_auth_requests;
CREATE INDEX IF NOT EXISTS workforce_auth_requests_org_status_idx
  ON workforce_auth_requests (organization_id, status, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS workforce_auth_requests_one_pending
  ON workforce_auth_requests (email, request_type) WHERE status = 'pending';
