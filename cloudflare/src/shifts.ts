import { ApiError, requireString } from "./http";
import { requireRole } from "./auth";
import { haversineDistanceMeters } from "./projects";
import { breakMinutesFromEvents } from "./shiftMetrics";
import { findOpenShiftForWorker, type OpenShiftRow } from "./openShift";
import type {
  AuthContext,
  LocationEvidence,
  Role,
  ShiftAction,
  ShiftEvent,
  ShiftSnapshot,
  ShiftState,
} from "./types";

type ShiftRow = OpenShiftRow;

interface EventRow {
  id: string;
  userId: string;
  eventType: ShiftAction;
  occurredAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface AdminRow {
  userId: string;
  displayName: string;
  role: Role;
  shiftId: string | null;
  state: Exclude<ShiftState, "off_shift"> | null;
  clockInAt: string | null;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
  projectId: string | null;
  projectName: string | null;
}

export interface AdminSnapshot {
  user_id: string;
  display_name: string;
  role: Role;
  state: ShiftState;
  clock_in_at: string | null;
  break_started_at: string | null;
  break_ended_at: string | null;
  clock_out_at: string | null;
  project_id: string | null;
  project_name: string | null;
  events: ShiftEvent[];
}

export interface ShiftHistoryRecord {
  id: string;
  user_id: string;
  display_name: string;
  work_date: string;
  state: ShiftState;
  clock_in_at: string;
  break_started_at: string | null;
  break_ended_at: string | null;
  clock_out_at: string | null;
  project_id: string | null;
  project_name: string | null;
  duration_minutes: number;
  break_minutes: number;
  net_minutes: number;
  events: ShiftEvent[];
  admin_adjustment: ShiftAdjustmentNotice | null;
}

export interface ShiftAdjustmentNotice {
  kind: "created" | "adjusted";
  reason: string;
  adjusted_at: string;
}

interface HistoryRow {
  id: string;
  userId: string;
  displayName: string;
  workDate: string;
  state: Exclude<ShiftState, "off_shift">;
  clockInAt: string;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
  projectId: string | null;
  projectName: string | null;
}

interface AdjustmentAuditRow {
  shiftId: string;
  action: "shift.admin_created" | "shift.admin_adjusted";
  metadataJson: string;
  adjustedAt: string;
}

function workDate(timezone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Invalid legacy timezone values fall back to UTC.
  }
  return now.toISOString().slice(0, 10);
}

function toEvent(row: EventRow): ShiftEvent {
  return {
    id: row.id,
    type: row.eventType,
    at: row.occurredAt,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
    },
  };
}

async function adjustmentsForShifts(
  env: Env,
  organizationId: string,
  shiftIds: string[],
): Promise<Map<string, ShiftAdjustmentNotice>> {
  if (shiftIds.length === 0) return new Map();

  const placeholders = shiftIds.map((_, index) => `?${index + 2}`).join(",");
  const result = await env.DB.prepare(
    `SELECT
       subject_id AS shiftId,
       action,
       metadata_json AS metadataJson,
       created_at AS adjustedAt
     FROM workforce_audit_events
     WHERE organization_id = ?1
       AND action IN ('shift.admin_created', 'shift.admin_adjusted')
       AND subject_id IN (${placeholders})
     ORDER BY created_at DESC, id DESC`,
  ).bind(organizationId, ...shiftIds).all<AdjustmentAuditRow>();

  const adjustments = new Map<string, ShiftAdjustmentNotice>();
  for (const row of result.results) {
    if (adjustments.has(row.shiftId)) continue;
    try {
      const metadata = JSON.parse(row.metadataJson) as { description?: unknown; reason?: unknown };
      const reason = row.action === "shift.admin_created" ? metadata.description : metadata.reason;
      if (typeof reason === "string" && reason.trim()) {
        adjustments.set(row.shiftId, {
          kind: row.action === "shift.admin_created" ? "created" : "adjusted",
          reason: reason.trim(),
          adjusted_at: row.adjustedAt,
        });
      }
    } catch {
      // Ignore malformed legacy audit metadata without breaking shift history.
    }
  }
  return adjustments;
}

function toHistoryRecord(
  row: HistoryRow,
  events: ShiftEvent[],
  adminAdjustment: ShiftAdjustmentNotice | null,
): ShiftHistoryRecord {
  const clockIn = new Date(row.clockInAt).getTime();
  const clockOut = row.clockOutAt ? new Date(row.clockOutAt).getTime() : Date.now();
  const durationMinutes = Math.max(0, Math.round((clockOut - clockIn) / 60000));
  const breakMinutes = breakMinutesFromEvents(events);

  return {
    id: row.id,
    user_id: row.userId,
    display_name: row.displayName,
    work_date: row.workDate,
    state: row.state,
    clock_in_at: row.clockInAt,
    break_started_at: row.breakStartedAt,
    break_ended_at: row.breakEndedAt,
    clock_out_at: row.clockOutAt,
    project_id: row.projectId ?? null,
    project_name: row.projectName ?? null,
    duration_minutes: durationMinutes,
    break_minutes: breakMinutes,
    net_minutes: Math.max(0, durationMinutes - breakMinutes),
    events,
    admin_adjustment: adminAdjustment,
  };
}

function optionalTimestamp(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = requireString(value, field, 1, 80);
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new ApiError(400, "INVALID_INPUT", `${field} must be a valid date and time.`);
  }
  return new Date(timestamp).toISOString();
}

function requiredTimestamp(value: unknown, field: string): string {
  const timestamp = optionalTimestamp(value, field);
  if (!timestamp) throw new ApiError(400, "INVALID_INPUT", `${field} is required.`);
  return timestamp;
}

async function assertNoShiftOverlap(
  env: Env,
  organizationId: string,
  userId: string,
  clockInAt: string,
  clockOutAt: string | null,
  excludedShiftId: string | null = null,
): Promise<void> {
  const overlapping = await env.DB.prepare(
    `SELECT id
     FROM workforce_shifts
     WHERE organization_id = ?1
       AND user_id = ?2
       AND (?3 IS NULL OR id <> ?3)
       AND clock_in_at < ?4
       AND (clock_out_at IS NULL OR clock_out_at > ?5)
     LIMIT 1`,
  ).bind(
    organizationId,
    userId,
    excludedShiftId,
    clockOutAt ?? "9999-12-31T23:59:59.999Z",
    clockInAt,
  ).first<{ id: string }>();

  if (overlapping) {
    throw new ApiError(409, "SHIFT_OVERLAP", "The selected times overlap another shift for this worker.");
  }
}

async function eventsForShift(env: Env, shiftId: string): Promise<ShiftEvent[]> {
  const [result, audit] = await Promise.all([
    env.DB.prepare(
      `SELECT
         id,
         user_id AS userId,
         event_type AS eventType,
         occurred_at AS occurredAt,
         latitude,
         longitude,
         accuracy_m AS accuracy
       FROM workforce_shift_events
       WHERE shift_id = ?1
       ORDER BY rowid ASC`,
    ).bind(shiftId).all<EventRow>(),
    env.DB.prepare(
      `SELECT metadata_json FROM workforce_audit_events
       WHERE subject_id = ?1 AND action = 'shift.clock_in' LIMIT 1`,
    ).bind(shiftId).first<{ metadata_json: string }>(),
  ]);

  let clockInPhoto: string | undefined = undefined;
  if (audit?.metadata_json) {
    try {
      const parsed = JSON.parse(audit.metadata_json);
      if (typeof parsed.photo === "string" && parsed.photo.startsWith("data:image/")) {
        clockInPhoto = parsed.photo;
      }
    } catch {
      // Non-fatal
    }
  }

  return result.results.map((row) => {
    const ev = toEvent(row);
    if (ev.type === "clock_in" && clockInPhoto) {
      ev.photo = clockInPhoto;
    }
    return ev;
  });
}

function emptyShift(): ShiftSnapshot {
  return {
    id: "new-shift",
    state: "off_shift",
    clockInAt: null,
    breakStartedAt: null,
    breakEndedAt: null,
    clockOutAt: null,
    projectId: null,
    projectName: null,
    events: [],
  };
}

async function snapshotFromRow(env: Env, row: ShiftRow | null): Promise<ShiftSnapshot> {
  if (!row) return emptyShift();
  return {
    id: row.id,
    state: row.state,
    clockInAt: row.clockInAt,
    breakStartedAt: row.breakStartedAt,
    breakEndedAt: row.breakEndedAt,
    clockOutAt: row.clockOutAt,
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    events: await eventsForShift(env, row.id),
  };
}

export async function workerToday(env: Env, auth: AuthContext): Promise<ShiftSnapshot> {
  return snapshotFromRow(
    env,
    await findOpenShiftForWorker(env.DB, auth.user.organizationId, auth.user.id),
  );
}

function parseLocation(value: unknown): LocationEvidence {
  if (!value || typeof value !== "object") {
    throw new ApiError(400, "INVALID_LOCATION", "A fresh location is required.");
  }
  const candidate = value as Record<string, unknown>;
  const latitude = candidate.latitude;
  const longitude = candidate.longitude;
  const accuracy = candidate.accuracy;
  if (
    typeof latitude !== "number"
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || typeof longitude !== "number"
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
    || typeof accuracy !== "number"
    || !Number.isFinite(accuracy)
    || accuracy < 0
    || accuracy > 10_000
  ) {
    throw new ApiError(400, "INVALID_LOCATION", "The location reading is invalid.");
  }
  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    accuracy: Math.round(accuracy),
  };
}

function parseAction(value: unknown): ShiftAction {
  if (value === "clock_in" || value === "start_break" || value === "end_break" || value === "clock_out") {
    return value;
  }
  throw new ApiError(400, "INVALID_ACTION", "The shift action is invalid.");
}

function expectedState(action: Exclude<ShiftAction, "clock_in">): Exclude<ShiftState, "off_shift"> {
  if (action === "start_break" || action === "clock_out") return "working";
  return "on_break";
}

function updateForAction(
  env: Env,
  action: Exclude<ShiftAction, "clock_in">,
  occurredAt: string,
  shift: ShiftRow,
): D1PreparedStatement {
  if (action === "start_break") {
    return env.DB.prepare(
      `UPDATE workforce_shifts
       SET state = 'on_break', break_started_at = ?1, break_ended_at = NULL
       WHERE id = ?2 AND state = 'working'`,
    ).bind(occurredAt, shift.id);
  }
  if (action === "end_break") {
    return env.DB.prepare(
      `UPDATE workforce_shifts
       SET state = 'working', break_ended_at = ?1
       WHERE id = ?2 AND state = 'on_break'`,
    ).bind(occurredAt, shift.id);
  }
  return env.DB.prepare(
    `UPDATE workforce_shifts
     SET state = 'complete', clock_out_at = ?1
     WHERE id = ?2 AND state = 'working'`,
  ).bind(occurredAt, shift.id);
}

export async function performShiftAction(
  env: Env,
  auth: AuthContext,
  body: {
    action?: unknown;
    location?: unknown;
    idempotencyKey?: unknown;
    projectId?: unknown;
  },
): Promise<ShiftSnapshot> {
  const action = parseAction(body.action);
  const location = parseLocation(body.location);
  const idempotencyKey = requireString(body.idempotencyKey, "Idempotency key", 16, 80);
  if (!/^[a-zA-Z0-9-]+$/.test(idempotencyKey)) {
    throw new ApiError(400, "INVALID_INPUT", "The idempotency key is invalid.");
  }

  const previous = await env.DB.prepare(
    `SELECT id FROM workforce_shift_events
     WHERE user_id = ?1 AND idempotency_key = ?2 LIMIT 1`,
  ).bind(auth.user.id, idempotencyKey).first<{ id: string }>();
  if (previous) return workerToday(env, auth);

  const occurredAt = new Date().toISOString();
  const eventId = crypto.randomUUID();
  let shift = await findOpenShiftForWorker(env.DB, auth.user.organizationId, auth.user.id);

  if (action === "clock_in") {
    if (shift) throw new ApiError(409, "INVALID_TRANSITION", "Finish the current shift before starting another one.");
    const shiftId = crypto.randomUUID();
    const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
    if (!projectId) throw new ApiError(400, "PROJECT_REQUIRED", "Select the project where you will work before clocking in.");

    let geofenceDistance: number | null = null;
    let outOfBounds = false;

    if (projectId) {
      const project = await env.DB.prepare(
        `SELECT id, name, latitude, longitude, radius_m FROM workforce_projects
         WHERE id = ?1 AND organization_id = ?2 AND is_active = 1 LIMIT 1`,
      ).bind(projectId, auth.user.organizationId).first<{
        id: string;
        name: string;
        latitude: number | null;
        longitude: number | null;
        radius_m: number;
      }>();
      if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "The selected project is not available.");
      if (project && project.latitude !== null && project.longitude !== null) {
        geofenceDistance = haversineDistanceMeters(
          location.latitude,
          location.longitude,
          project.latitude,
          project.longitude,
        );
        if (geofenceDistance > project.radius_m) {
          outOfBounds = true;
        }
      }
    }

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO workforce_shifts
           (id, organization_id, user_id, state, clock_in_at, work_date, project_id)
           VALUES (?1, ?2, ?3, 'working', ?4, ?5, ?6)`,
        ).bind(
          shiftId,
          auth.user.organizationId,
          auth.user.id,
          occurredAt,
          workDate(auth.user.timezone),
          projectId,
        ),
        env.DB.prepare(
          `INSERT INTO workforce_shift_events
           (id, organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
           VALUES (?1, ?2, ?3, ?4, 'clock_in', ?5, ?6, ?7, ?8, ?9)`,
        ).bind(
          eventId,
          auth.user.organizationId,
          shiftId,
          auth.user.id,
          occurredAt,
          location.latitude,
          location.longitude,
          location.accuracy,
          idempotencyKey,
        ),
        env.DB.prepare(
          `INSERT INTO workforce_audit_events
           (organization_id, actor_user_id, action, subject_id, metadata_json)
           VALUES (?1, ?2, 'shift.clock_in', ?3, ?4)`,
        ).bind(
          auth.user.organizationId,
          auth.user.id,
          shiftId,
          JSON.stringify({
            source: "web",
            project_id: projectId,
            geofence_distance_m: geofenceDistance,
            out_of_bounds: outOfBounds,
          }),
        ),
      ]);
    } catch {
      const replay = await env.DB.prepare(
        `SELECT id FROM workforce_shift_events
         WHERE user_id = ?1 AND idempotency_key = ?2 LIMIT 1`,
      ).bind(auth.user.id, idempotencyKey).first<{ id: string }>();
      if (!replay) throw new ApiError(409, "INVALID_TRANSITION", "The shift state changed. Refresh and try again.");
    }
    return workerToday(env, auth);
  }

  if (!shift || shift.state !== expectedState(action)) {
    throw new ApiError(409, "INVALID_TRANSITION", "The shift state changed. Refresh and try again.");
  }

  const nextState: Exclude<ShiftState, "off_shift"> = action === "start_break"
    ? "on_break"
    : action === "end_break"
      ? "working"
      : "complete";
  try {
    const results = await env.DB.batch([
      updateForAction(env, action, occurredAt, shift),
      env.DB.prepare(
        `INSERT INTO workforce_shift_events
         (id, organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      ).bind(
        eventId,
        auth.user.organizationId,
        shift.id,
        auth.user.id,
        action,
        occurredAt,
        location.latitude,
        location.longitude,
        location.accuracy,
        idempotencyKey,
      ),
      env.DB.prepare(
        `INSERT INTO workforce_audit_events
         (organization_id, actor_user_id, action, subject_id, metadata_json)
         VALUES (?1, ?2, ?3, ?4, '{"source":"web"}')`,
      ).bind(auth.user.organizationId, auth.user.id, `shift.${action}`, shift.id),
    ]);
    if (Number(results[0]?.meta.changes ?? 0) !== 1) {
      throw new ApiError(409, "INVALID_TRANSITION", "The shift state changed. Refresh and try again.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const replay = await env.DB.prepare(
      `SELECT id FROM workforce_shift_events
       WHERE user_id = ?1 AND idempotency_key = ?2 LIMIT 1`,
    ).bind(auth.user.id, idempotencyKey).first<{ id: string }>();
    if (!replay) throw new ApiError(409, "INVALID_TRANSITION", "The shift state changed. Refresh and try again.");
  }

  shift = {
    ...shift,
    state: nextState,
    breakStartedAt: action === "start_break" ? occurredAt : shift.breakStartedAt,
    breakEndedAt: action === "start_break" ? null : action === "end_break" ? occurredAt : shift.breakEndedAt,
    clockOutAt: action === "clock_out" ? occurredAt : shift.clockOutAt,
  };
  return snapshotFromRow(env, shift);
}

export async function adminToday(env: Env, auth: AuthContext): Promise<AdminSnapshot[]> {
  requireRole(auth, "admin");
  const date = workDate(auth.user.timezone);
  const members = await env.DB.prepare(
    `SELECT
       m.user_id AS userId,
       m.display_name AS displayName,
       m.role AS role,
       s.id AS shiftId,
       s.state AS state,
       s.clock_in_at AS clockInAt,
       s.break_started_at AS breakStartedAt,
       s.break_ended_at AS breakEndedAt,
       s.clock_out_at AS clockOutAt,
       s.project_id AS projectId,
       p.name AS projectName
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id AND u.disabled_at IS NULL
     LEFT JOIN workforce_shifts s
      ON s.organization_id = m.organization_id
      AND s.user_id = m.user_id
      AND s.id = (
        SELECT latest.id
        FROM workforce_shifts latest
        WHERE latest.organization_id = m.organization_id
          AND latest.user_id = m.user_id
          AND (latest.state <> 'complete' OR latest.work_date = ?2)
        ORDER BY
          CASE WHEN latest.state <> 'complete' THEN 0 ELSE 1 END,
          latest.clock_in_at DESC
        LIMIT 1
      )
     LEFT JOIN workforce_projects p ON p.id = s.project_id
     WHERE m.organization_id = ?1 AND m.role = 'worker'
     ORDER BY m.display_name COLLATE NOCASE ASC`,
  ).bind(auth.user.organizationId, date).all<AdminRow>();

  const eventResult = await env.DB.prepare(
    `SELECT
       e.id,
       e.user_id AS userId,
       e.event_type AS eventType,
       e.occurred_at AS occurredAt,
       e.latitude,
       e.longitude,
       e.accuracy_m AS accuracy
     FROM workforce_shift_events e
     JOIN workforce_shifts s ON s.id = e.shift_id
     WHERE e.organization_id = ?1
       AND s.id = (
         SELECT latest.id
         FROM workforce_shifts latest
         WHERE latest.organization_id = s.organization_id
           AND latest.user_id = s.user_id
           AND (latest.state <> 'complete' OR latest.work_date = ?2)
         ORDER BY
           CASE WHEN latest.state <> 'complete' THEN 0 ELSE 1 END,
           latest.clock_in_at DESC
         LIMIT 1
       )
     ORDER BY e.rowid ASC`,
  ).bind(auth.user.organizationId, date).all<EventRow>();

  const eventsByUser = new Map<string, ShiftEvent[]>();
  for (const event of eventResult.results) {
    const current = eventsByUser.get(event.userId) ?? [];
    current.push(toEvent(event));
    eventsByUser.set(event.userId, current);
  }

  return members.results.map((member) => ({
    user_id: member.userId,
    display_name: member.displayName,
    role: member.role,
    state: member.state ?? "off_shift",
    clock_in_at: member.clockInAt,
    break_started_at: member.breakStartedAt,
    break_ended_at: member.breakEndedAt,
    clock_out_at: member.clockOutAt,
    project_id: member.projectId ?? null,
    project_name: member.projectName ?? null,
    events: eventsByUser.get(member.userId) ?? [],
  }));
}

export async function adminShiftHistory(
  env: Env,
  auth: AuthContext,
  params: URLSearchParams,
): Promise<ShiftHistoryRecord[]> {
  requireRole(auth, "admin");
  const userId = params.get("user_id");
  const projectId = params.get("project_id");
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");

  let query = `
    SELECT
      s.id,
      s.user_id AS userId,
      m.display_name AS displayName,
      s.work_date AS workDate,
      s.state,
      s.clock_in_at AS clockInAt,
      s.break_started_at AS breakStartedAt,
      s.break_ended_at AS breakEndedAt,
      s.clock_out_at AS clockOutAt,
      s.project_id AS projectId,
      p.name AS projectName
    FROM workforce_shifts s
    JOIN workforce_memberships m ON m.organization_id = s.organization_id AND m.user_id = s.user_id
    LEFT JOIN workforce_projects p ON p.id = s.project_id
    WHERE s.organization_id = ?1
  `;
  const bindings: unknown[] = [auth.user.organizationId];
  let bindIndex = 2;

  if (userId && userId !== "all") {
    query += ` AND s.user_id = ?${bindIndex}`;
    bindings.push(userId);
    bindIndex++;
  }
  if (projectId && projectId !== "all") {
    query += ` AND s.project_id = ?${bindIndex}`;
    bindings.push(projectId);
    bindIndex++;
  }
  if (startDate) {
    query += ` AND s.work_date >= ?${bindIndex}`;
    bindings.push(startDate);
    bindIndex++;
  }
  if (endDate) {
    query += ` AND s.work_date <= ?${bindIndex}`;
    bindings.push(endDate);
    bindIndex++;
  }

  query += ` ORDER BY s.work_date DESC, s.clock_in_at DESC LIMIT 500`;

  const shiftsResult = await env.DB.prepare(query).bind(...bindings).all<HistoryRow>();

  // Fetch all events for these shifts
  const shiftIds = shiftsResult.results.map((r) => r.id);
  const eventsByShift = new Map<string, ShiftEvent[]>();

  if (shiftIds.length > 0) {
    const placeholders = shiftIds.map((_, idx) => `?${idx + 1}`).join(",");
    const eventsQuery = `
      SELECT
        id,
        shift_id AS shiftId,
        user_id AS userId,
        event_type AS eventType,
        occurred_at AS occurredAt,
        latitude,
        longitude,
        accuracy_m AS accuracy
      FROM workforce_shift_events
      WHERE shift_id IN (${placeholders})
      ORDER BY rowid ASC
    `;
    const eventRows = await env.DB.prepare(eventsQuery).bind(...shiftIds).all<EventRow & { shiftId: string }>();
    for (const e of eventRows.results) {
      const current = eventsByShift.get(e.shiftId) ?? [];
      current.push(toEvent(e));
      eventsByShift.set(e.shiftId, current);
    }
  }

  const adjustmentsByShift = await adjustmentsForShifts(
    env,
    auth.user.organizationId,
    shiftIds,
  );

  return shiftsResult.results.map((row) => toHistoryRecord(
    row,
    eventsByShift.get(row.id) ?? [],
    adjustmentsByShift.get(row.id) ?? null,
  ));
}

export async function workerShiftHistory(
  env: Env,
  auth: AuthContext,
  params: URLSearchParams,
): Promise<ShiftHistoryRecord[]> {
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");

  let query = `
    SELECT
      s.id,
      s.user_id AS userId,
      m.display_name AS displayName,
      s.work_date AS workDate,
      s.state,
      s.clock_in_at AS clockInAt,
      s.break_started_at AS breakStartedAt,
      s.break_ended_at AS breakEndedAt,
      s.clock_out_at AS clockOutAt,
      s.project_id AS projectId,
      p.name AS projectName
    FROM workforce_shifts s
    JOIN workforce_memberships m ON m.organization_id = s.organization_id AND m.user_id = s.user_id
    LEFT JOIN workforce_projects p ON p.id = s.project_id
    WHERE s.organization_id = ?1 AND s.user_id = ?2
  `;
  const bindings: unknown[] = [auth.user.organizationId, auth.user.id];
  let bindIndex = 3;

  if (startDate) {
    query += ` AND s.work_date >= ?${bindIndex}`;
    bindings.push(startDate);
    bindIndex++;
  }
  if (endDate) {
    query += ` AND s.work_date <= ?${bindIndex}`;
    bindings.push(endDate);
    bindIndex++;
  }

  query += ` ORDER BY s.work_date DESC, s.clock_in_at DESC LIMIT 100`;

  const shiftsResult = await env.DB.prepare(query).bind(...bindings).all<HistoryRow>();
  const shiftIds = shiftsResult.results.map((r) => r.id);
  const eventsByShift = new Map<string, ShiftEvent[]>();

  if (shiftIds.length > 0) {
    const placeholders = shiftIds.map((_, idx) => `?${idx + 1}`).join(",");
    const eventsQuery = `
      SELECT
        id,
        shift_id AS shiftId,
        user_id AS userId,
        event_type AS eventType,
        occurred_at AS occurredAt,
        latitude,
        longitude,
        accuracy_m AS accuracy
      FROM workforce_shift_events
      WHERE shift_id IN (${placeholders})
      ORDER BY rowid ASC
    `;
    const eventRows = await env.DB.prepare(eventsQuery).bind(...shiftIds).all<EventRow & { shiftId: string }>();
    for (const e of eventRows.results) {
      const current = eventsByShift.get(e.shiftId) ?? [];
      current.push(toEvent(e));
      eventsByShift.set(e.shiftId, current);
    }
  }

  const adjustmentsByShift = await adjustmentsForShifts(
    env,
    auth.user.organizationId,
    shiftIds,
  );

  return shiftsResult.results.map((row) => toHistoryRecord(
    row,
    eventsByShift.get(row.id) ?? [],
    adjustmentsByShift.get(row.id) ?? null,
  ));
}

export async function adminCreateShift(
  env: Env,
  auth: AuthContext,
  body: {
    userId?: unknown;
    projectId?: unknown;
    clockInAt?: unknown;
    clockOutAt?: unknown;
    description?: unknown;
  },
): Promise<{ ok: true; shiftId: string }> {
  requireRole(auth, "admin");
  const userId = requireString(body.userId, "Worker", 5, 80);
  const description = requireString(body.description, "Description", 3, 300);
  const clockInAt = requiredTimestamp(body.clockInAt, "Clock-in time");
  const clockOutAt = requiredTimestamp(body.clockOutAt, "Clock-out time");
  const projectId = body.projectId === undefined || body.projectId === null || body.projectId === ""
    ? null
    : requireString(body.projectId, "Project", 5, 80);

  if (Date.parse(clockOutAt) <= Date.parse(clockInAt)) {
    throw new ApiError(400, "INVALID_INPUT", "Clock-out time must be after clock-in time.");
  }

  const worker = await env.DB.prepare(
    `SELECT m.user_id AS id
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id AND u.disabled_at IS NULL
     WHERE m.organization_id = ?1 AND m.user_id = ?2 AND m.role = 'worker'
     LIMIT 1`,
  ).bind(auth.user.organizationId, userId).first<{ id: string }>();
  if (!worker) throw new ApiError(404, "WORKER_NOT_FOUND", "The selected worker is not available.");

  if (projectId) {
    const project = await env.DB.prepare(
      `SELECT id FROM workforce_projects
       WHERE organization_id = ?1 AND id = ?2 LIMIT 1`,
    ).bind(auth.user.organizationId, projectId).first<{ id: string }>();
    if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "The selected project is not available.");
  }

  await assertNoShiftOverlap(env, auth.user.organizationId, userId, clockInAt, clockOutAt);

  const shiftId = crypto.randomUUID();
  const metadata = JSON.stringify({
    description,
    clock_in: clockInAt,
    clock_out: clockOutAt,
    target_user_id: userId,
    project_id: projectId,
    created_by: auth.user.email,
  });
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO workforce_shifts
       (id, organization_id, user_id, state, clock_in_at, clock_out_at, work_date, project_id)
       VALUES (?1, ?2, ?3, 'complete', ?4, ?5, ?6, ?7)`,
    ).bind(
      shiftId,
      auth.user.organizationId,
      userId,
      clockInAt,
      clockOutAt,
      workDate(auth.user.timezone, new Date(clockInAt)),
      projectId,
    ),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
       VALUES (?1, ?2, 'shift.admin_created', ?3, ?4)`,
    ).bind(auth.user.organizationId, auth.user.id, shiftId, metadata),
  ]);
  if (Number(results[0]?.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "SHIFT_CREATE_FAILED", "The shift could not be created. Refresh and try again.");
  }

  return { ok: true, shiftId };
}

export async function adminAdjustShift(
  env: Env,
  auth: AuthContext,
  body: {
    shiftId?: unknown;
    clockInAt?: unknown;
    clockOutAt?: unknown;
    reason?: unknown;
  },
): Promise<{ ok: true; shiftId: string }> {
  requireRole(auth, "admin");
  const shiftId = requireString(body.shiftId, "Shift ID", 5, 80);
  const reason = requireString(body.reason, "Adjustment reason", 3, 300);
  const clockInAt = optionalTimestamp(body.clockInAt, "Clock-in time");
  const clockOutAt = optionalTimestamp(body.clockOutAt, "Clock-out time");

  const currentShift = await env.DB.prepare(
    `SELECT id, user_id, clock_in_at, clock_out_at, state
     FROM workforce_shifts
     WHERE id = ?1 AND organization_id = ?2 LIMIT 1`,
  ).bind(shiftId, auth.user.organizationId).first<{
    id: string;
    user_id: string;
    clock_in_at: string;
    clock_out_at: string | null;
    state: string;
  }>();

  if (!currentShift) {
    throw new ApiError(404, "NOT_FOUND", "The specified shift was not found.");
  }

  const finalClockIn = clockInAt || currentShift.clock_in_at;
  const finalClockOut = clockOutAt || currentShift.clock_out_at;
  if (finalClockOut && Date.parse(finalClockOut) <= Date.parse(finalClockIn)) {
    throw new ApiError(400, "INVALID_INPUT", "Clock-out time must be after clock-in time.");
  }
  const finalState = finalClockOut ? "complete" : currentShift.state;

  await assertNoShiftOverlap(
    env,
    auth.user.organizationId,
    currentShift.user_id,
    finalClockIn,
    finalClockOut,
    shiftId,
  );

  const metadata = JSON.stringify({
    reason,
    old_clock_in: currentShift.clock_in_at,
    old_clock_out: currentShift.clock_out_at,
    new_clock_in: finalClockIn,
    new_clock_out: finalClockOut,
    target_user_id: currentShift.user_id,
    adjusted_by: auth.user.email,
  });

  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE workforce_shifts
       SET clock_in_at = ?1, clock_out_at = ?2, state = ?3, work_date = ?4
       WHERE id = ?5 AND organization_id = ?6`,
    ).bind(
      finalClockIn,
      finalClockOut,
      finalState,
      workDate(auth.user.timezone, new Date(finalClockIn)),
      shiftId,
      auth.user.organizationId,
    ),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
       VALUES (?1, ?2, 'shift.admin_adjusted', ?3, ?4)`,
    ).bind(auth.user.organizationId, auth.user.id, shiftId, metadata),
  ]);
  if (Number(results[0]?.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "SHIFT_ADJUST_FAILED", "The shift changed before the adjustment was saved.");
  }

  return { ok: true, shiftId };
}
