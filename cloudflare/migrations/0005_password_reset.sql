PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_password_reset_requests (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES workforce_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'consumed', 'rejected')),
  token_hash TEXT UNIQUE CHECK (token_hash IS NULL OR length(token_hash) = 64),
  token_expires_at TEXT,
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES workforce_users(id) ON DELETE SET NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS workforce_password_reset_org_status_idx
  ON workforce_password_reset_requests (organization_id, status, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS workforce_password_reset_active_user_idx
  ON workforce_password_reset_requests (user_id)
  WHERE status IN ('pending', 'issued');

-- Rollback (manual, only after a verified backup and explicit approval):
-- DROP TABLE workforce_password_reset_requests;
