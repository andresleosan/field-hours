PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workforce_memberships (
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'worker')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS workforce_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role = 'worker'),
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  claimed_by TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workforce_shifts (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'working' CHECK (state IN ('working', 'on_break', 'complete')),
  clock_in_at TEXT NOT NULL,
  break_started_at TEXT,
  break_ended_at TEXT,
  clock_out_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at),
  CHECK (break_started_at IS NULL OR break_started_at >= clock_in_at),
  CHECK (break_ended_at IS NULL OR (break_started_at IS NOT NULL AND break_ended_at >= break_started_at)),
  CHECK (clock_out_at IS NULL OR break_ended_at IS NULL OR clock_out_at >= break_ended_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_open_shift_per_worker
  ON workforce_shifts (organization_id, user_id) WHERE state <> 'complete';
CREATE INDEX IF NOT EXISTS workforce_shifts_org_created_idx
  ON workforce_shifts (organization_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS workforce_shifts_user_created_idx
  ON workforce_shifts (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS workforce_shift_events (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES workforce_shifts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('clock_in', 'start_break', 'end_break', 'clock_out')),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m REAL NOT NULL CHECK (accuracy_m BETWEEN 0 AND 100000),
  idempotency_key TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS workforce_events_shift_time_idx
  ON workforce_shift_events (shift_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS workforce_events_org_time_idx
  ON workforce_shift_events (organization_id, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS workforce_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  subject_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS workforce_audit_org_time_idx
  ON workforce_audit_events (organization_id, created_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS workforce_shift_events_append_only_update
  BEFORE UPDATE ON workforce_shift_events
  BEGIN
    SELECT RAISE(ABORT, 'Workforce events are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS workforce_shift_events_append_only_delete
  BEFORE DELETE ON workforce_shift_events
  BEGIN
    SELECT RAISE(ABORT, 'Workforce events are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS workforce_audit_events_append_only_update
  BEFORE UPDATE ON workforce_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Audit events are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS workforce_audit_events_append_only_delete
  BEFORE DELETE ON workforce_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'Audit events are append-only');
  END;
