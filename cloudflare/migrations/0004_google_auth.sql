PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_google_identities (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES workforce_users(id) ON DELETE CASCADE,
  google_subject TEXT NOT NULL UNIQUE,
  google_email TEXT NOT NULL CHECK (length(google_email) BETWEEN 3 AND 254 AND google_email = lower(google_email)),
  linked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workforce_auth_requests (
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
  reviewed_by TEXT REFERENCES workforce_users(id) ON DELETE SET NULL,
  UNIQUE (email, request_type, status)
);
CREATE INDEX IF NOT EXISTS workforce_auth_requests_org_status_idx
  ON workforce_auth_requests (organization_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS workforce_oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL CHECK (length(state_hash) = 64),
  mode TEXT NOT NULL CHECK (mode IN ('signin', 'link')),
  user_id TEXT REFERENCES workforce_users(id) ON DELETE CASCADE,
  client_key_hash TEXT NOT NULL CHECK (length(client_key_hash) = 64),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS workforce_oauth_states_expiry_idx
  ON workforce_oauth_states (expires_at);
CREATE INDEX IF NOT EXISTS workforce_oauth_states_client_idx
  ON workforce_oauth_states (client_key_hash, expires_at);

-- Rollback (manual, only after a verified backup and explicit approval):
-- DROP TABLE workforce_oauth_states;
-- DROP TABLE workforce_auth_requests;
-- DROP TABLE workforce_google_identities;
