PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  password_salt TEXT NOT NULL CHECK (length(password_salt) >= 32),
  password_hash TEXT NOT NULL CHECK (length(password_hash) >= 64),
  password_iterations INTEGER NOT NULL CHECK (password_iterations BETWEEN 100000 AND 2000000),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  disabled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workforce_sessions (
  session_hash TEXT PRIMARY KEY NOT NULL CHECK (length(session_hash) = 64),
  csrf_hash TEXT NOT NULL CHECK (length(csrf_hash) = 64),
  user_id TEXT NOT NULL REFERENCES workforce_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS workforce_sessions_user_idx
  ON workforce_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS workforce_sessions_expiry_idx
  ON workforce_sessions (expires_at);

CREATE TABLE IF NOT EXISTS workforce_auth_attempts (
  key_hash TEXT PRIMARY KEY NOT NULL CHECK (length(key_hash) = 64),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  window_started_at TEXT NOT NULL
);

ALTER TABLE workforce_shifts ADD COLUMN work_date TEXT;
UPDATE workforce_shifts SET work_date = substr(clock_in_at, 1, 10) WHERE work_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_shift_per_worker_day
  ON workforce_shifts (organization_id, user_id, work_date)
  WHERE work_date IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workforce_one_membership_per_user
  ON workforce_memberships (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS workforce_invitation_claimed_once
  ON workforce_invitations (claimed_by)
  WHERE claimed_by IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS workforce_shift_requires_work_date
  BEFORE INSERT ON workforce_shifts
  WHEN NEW.work_date IS NULL OR length(NEW.work_date) <> 10
  BEGIN
    SELECT RAISE(ABORT, 'A valid work date is required');
  END;

CREATE TRIGGER IF NOT EXISTS workforce_shift_event_matches_owner
  BEFORE INSERT ON workforce_shift_events
  WHEN NOT EXISTS (
    SELECT 1 FROM workforce_shifts s
    WHERE s.id = NEW.shift_id
      AND s.organization_id = NEW.organization_id
      AND s.user_id = NEW.user_id
  )
  BEGIN
    SELECT RAISE(ABORT, 'Shift event owner mismatch');
  END;

CREATE TRIGGER IF NOT EXISTS workforce_shift_event_clock_in_transition
  BEFORE INSERT ON workforce_shift_events
  WHEN NEW.event_type = 'clock_in' AND (
    NOT EXISTS (SELECT 1 FROM workforce_shifts s WHERE s.id = NEW.shift_id AND s.state = 'working')
    OR EXISTS (SELECT 1 FROM workforce_shift_events e WHERE e.shift_id = NEW.shift_id)
  )
  BEGIN
    SELECT RAISE(ABORT, 'Invalid clock-in transition');
  END;

CREATE TRIGGER IF NOT EXISTS workforce_shift_event_break_start_transition
  BEFORE INSERT ON workforce_shift_events
  WHEN NEW.event_type = 'start_break' AND (
    NOT EXISTS (SELECT 1 FROM workforce_shifts s WHERE s.id = NEW.shift_id AND s.state = 'on_break')
    OR COALESCE(
      (SELECT e.event_type FROM workforce_shift_events e WHERE e.shift_id = NEW.shift_id ORDER BY e.rowid DESC LIMIT 1),
      ''
    ) NOT IN ('clock_in', 'end_break')
  )
  BEGIN
    SELECT RAISE(ABORT, 'Invalid break-start transition');
  END;

CREATE TRIGGER IF NOT EXISTS workforce_shift_event_break_end_transition
  BEFORE INSERT ON workforce_shift_events
  WHEN NEW.event_type = 'end_break' AND (
    NOT EXISTS (SELECT 1 FROM workforce_shifts s WHERE s.id = NEW.shift_id AND s.state = 'working')
    OR COALESCE(
      (SELECT e.event_type FROM workforce_shift_events e WHERE e.shift_id = NEW.shift_id ORDER BY e.rowid DESC LIMIT 1),
      ''
    ) <> 'start_break'
  )
  BEGIN
    SELECT RAISE(ABORT, 'Invalid break-end transition');
  END;

CREATE TRIGGER IF NOT EXISTS workforce_shift_event_clock_out_transition
  BEFORE INSERT ON workforce_shift_events
  WHEN NEW.event_type = 'clock_out' AND (
    NOT EXISTS (SELECT 1 FROM workforce_shifts s WHERE s.id = NEW.shift_id AND s.state = 'complete')
    OR COALESCE(
      (SELECT e.event_type FROM workforce_shift_events e WHERE e.shift_id = NEW.shift_id ORDER BY e.rowid DESC LIMIT 1),
      ''
    ) NOT IN ('clock_in', 'end_break')
  )
  BEGIN
    SELECT RAISE(ABORT, 'Invalid clock-out transition');
  END;
