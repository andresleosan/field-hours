PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workforce_projects (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES workforce_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  code TEXT CHECK (code IS NULL OR length(code) BETWEEN 1 AND 30),
  address TEXT,
  latitude REAL,
  longitude REAL,
  radius_m INTEGER NOT NULL DEFAULT 200 CHECK (radius_m BETWEEN 20 AND 50000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS workforce_projects_org_idx
  ON workforce_projects (organization_id, is_active DESC, name COLLATE NOCASE ASC);

ALTER TABLE workforce_shifts ADD COLUMN project_id TEXT;
