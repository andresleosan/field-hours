import { ApiError, requireString } from "./http";
import { requireRole } from "./auth";
import type { AuthContext, Project } from "./types";

interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  is_active: number;
  created_at: string;
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    radius_m: row.radius_m,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

async function ensureProjectsTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS workforce_projects (
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
    )`,
  ).run();
}

export async function listProjects(env: Env, auth: AuthContext): Promise<Project[]> {
  try {
    await ensureProjectsTable(env);
    const rows = await env.DB.prepare(
      `SELECT id, organization_id, name, code, address, latitude, longitude, radius_m, is_active, created_at
       FROM workforce_projects
       WHERE organization_id = ?1
       ORDER BY is_active DESC, name COLLATE NOCASE ASC`,
    ).bind(auth.user.organizationId).all<ProjectRow>();

    return rows.results.map(toProject);
  } catch {
    return [];
  }
}

export async function createOrUpdateProject(
  env: Env,
  auth: AuthContext,
  body: {
    id?: unknown;
    name?: unknown;
    code?: unknown;
    address?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    radiusM?: unknown;
    isActive?: unknown;
  },
): Promise<Project> {
  requireRole(auth, "admin");
  await ensureProjectsTable(env);

  const name = requireString(body.name, "Project name", 2, 120);
  const code = typeof body.code === "string" && body.code.trim() ? body.code.trim().slice(0, 30) : null;
  const address = typeof body.address === "string" && body.address.trim() ? body.address.trim().slice(0, 250) : null;

  let latitude: number | null = null;
  if (typeof body.latitude === "number" && Number.isFinite(body.latitude) && body.latitude >= -90 && body.latitude <= 90) {
    latitude = Number(body.latitude.toFixed(7));
  }

  let longitude: number | null = null;
  if (typeof body.longitude === "number" && Number.isFinite(body.longitude) && body.longitude >= -180 && body.longitude <= 180) {
    longitude = Number(body.longitude.toFixed(7));
  }

  let radiusM = 200;
  if (typeof body.radiusM === "number" && Number.isFinite(body.radiusM) && body.radiusM >= 20 && body.radiusM <= 50000) {
    radiusM = Math.round(body.radiusM);
  }

  const isActive = typeof body.isActive === "boolean" ? (body.isActive ? 1 : 0) : 1;

  if (typeof body.id === "string" && body.id) {
    // Update existing project
    const projectId = body.id;
    await env.DB.prepare(
      `UPDATE workforce_projects
       SET name = ?1, code = ?2, address = ?3, latitude = ?4, longitude = ?5, radius_m = ?6, is_active = ?7
       WHERE id = ?8 AND organization_id = ?9`,
    ).bind(
      name,
      code,
      address,
      latitude,
      longitude,
      radiusM,
      isActive,
      projectId,
      auth.user.organizationId,
    ).run();

    const updated = await env.DB.prepare(
      `SELECT id, organization_id, name, code, address, latitude, longitude, radius_m, is_active, created_at
       FROM workforce_projects
       WHERE id = ?1 AND organization_id = ?2 LIMIT 1`,
    ).bind(projectId, auth.user.organizationId).first<ProjectRow>();

    if (!updated) throw new ApiError(404, "NOT_FOUND", "Project not found.");
    return toProject(updated);
  }

  // Create new project
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO workforce_projects
     (id, organization_id, name, code, address, latitude, longitude, radius_m, is_active)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(
    id,
    auth.user.organizationId,
    name,
    code,
    address,
    latitude,
    longitude,
    radiusM,
    isActive,
  ).run();

  const created = await env.DB.prepare(
    `SELECT id, organization_id, name, code, address, latitude, longitude, radius_m, is_active, created_at
     FROM workforce_projects
     WHERE id = ?1 AND organization_id = ?2 LIMIT 1`,
  ).bind(id, auth.user.organizationId).first<ProjectRow>();

  if (!created) throw new ApiError(500, "INTERNAL_ERROR", "Could not create project.");
  return toProject(created);
}
