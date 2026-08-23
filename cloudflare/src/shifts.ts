import { ApiError, requireString } from "./http";
import { requireRole, requireReady } from "./auth";
import type {
  AuthContext,
  LocationEvidence,
  Role,
  ShiftAction,
  ShiftEvent,
  ShiftSnapshot,
  ShiftState,
} from "./types";

interface ShiftRow {
  id: string;
  state: Exclude<ShiftState, "off_shift">;
  clockInAt: string;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
}

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
  duration_minutes: number;
  break_minutes: number;
  net_minutes: number;
  events: ShiftEvent[];
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

async function eventsForShift(env: Env, shiftId: string): Promise<ShiftEvent[]> {
  const result = await env.DB.prepare(
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
  ).bind(shiftId).all<EventRow>();
  return result.results.map(toEvent);
}

async function shiftForToday(env: Env, auth: AuthContext): Promise<ShiftRow | null> {
  return env.DB.prepare(
    `SELECT
       id,
       state,
       clock_in_at AS clockInAt,
       break_started_at AS breakStartedAt,
       break_ended_at AS breakEndedAt,
       clock_out_at AS clockOutAt
     FROM workforce_shifts
     WHERE organization_id = ?1 AND user_id = ?2 AND work_date = ?3
     LIMIT 1`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    workDate(auth.user.timezone),
  ).first<ShiftRow>();
}

function emptyShift(): ShiftSnapshot {
  return {
    id: "new-shift",
    state: "off_shift",
    clockInAt: null,
    breakStartedAt: null,
    breakEndedAt: null,
    clockOutAt: null,
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
    events: await eventsForShift(env, row.id),
  };
}

export async function workerToday(env: Env, auth: AuthContext): Promise<ShiftSnapshot> {
  requireReady(auth);
  return snapshotFromRow(env, await shiftForToday(env, auth));
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
       SET state = 'on_break', break_started_at = ?1
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
  },
): Promise<ShiftSnapshot> {
  requireReady(auth);
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
  let shift = await shiftForToday(env, auth);

  if (action === "clock_in") {
    if (shift) throw new ApiError(409, "INVALID_TRANSITION", "A shift already exists for today.");
    const shiftId = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO workforce_shifts
           (id, organization_id, user_id, state, clock_in_at, work_date)
           VALUES (?1, ?2, ?3, 'working', ?4, ?5)`,
        ).bind(
          shiftId,
          auth.user.organizationId,
          auth.user.id,
          occurredAt,
          workDate(auth.user.timezone),
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
           VALUES (?1, ?2, 'shift.clock_in', ?3, '{"source":"web"}')`,
        ).bind(auth.user.organizationId, auth.user.id, shiftId),
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
    breakEndedAt: action === "end_break" ? occurredAt : shift.breakEndedAt,
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
       s.clock_out_at AS clockOutAt
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id AND u.disabled_at IS NULL
     LEFT JOIN workforce_shifts s
       ON s.organization_id = m.organization_id
      AND s.user_id = m.user_id
      AND s.work_date = ?2
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
     WHERE e.organization_id = ?1 AND s.work_date = ?2
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
      s.clock_out_at AS clockOutAt
    FROM workforce_shifts s
    JOIN workforce_memberships m ON m.organization_id = s.organization_id AND m.user_id = s.user_id
    WHERE s.organization_id = ?1
  `;
  const bindings: unknown[] = [auth.user.organizationId];
  let bindIndex = 2;

  if (userId && userId !== "all") {
    query += ` AND s.user_id = ?${bindIndex}`;
    bindings.push(userId);
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

  return shiftsResult.results.map((row) => {
    const clockIn = new Date(row.clockInAt).getTime();
    const clockOut = row.clockOutAt ? new Date(row.clockOutAt).getTime() : Date.now();
    const durationMinutes = Math.max(0, Math.round((clockOut - clockIn) / 60000));
    
    let breakMinutes = 0;
    if (row.breakStartedAt && row.breakEndedAt) {
      breakMinutes = Math.max(0, Math.round((new Date(row.breakEndedAt).getTime() - new Date(row.breakStartedAt).getTime()) / 60000));
    } else if (row.breakStartedAt && !row.breakEndedAt) {
      breakMinutes = Math.max(0, Math.round((Date.now() - new Date(row.breakStartedAt).getTime()) / 60000));
    }
    const netMinutes = Math.max(0, durationMinutes - breakMinutes);

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
      duration_minutes: durationMinutes,
      break_minutes: breakMinutes,
      net_minutes: netMinutes,
      events: eventsByShift.get(row.id) ?? [],
    };
  });
}

export async function workerShiftHistory(
  env: Env,
  auth: AuthContext,
  params: URLSearchParams,
): Promise<ShiftHistoryRecord[]> {
  requireReady(auth);
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
      s.clock_out_at AS clockOutAt
    FROM workforce_shifts s
    JOIN workforce_memberships m ON m.organization_id = s.organization_id AND m.user_id = s.user_id
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

  return shiftsResult.results.map((row) => {
    const clockIn = new Date(row.clockInAt).getTime();
    const clockOut = row.clockOutAt ? new Date(row.clockOutAt).getTime() : Date.now();
    const durationMinutes = Math.max(0, Math.round((clockOut - clockIn) / 60000));
    
    let breakMinutes = 0;
    if (row.breakStartedAt && row.breakEndedAt) {
      breakMinutes = Math.max(0, Math.round((new Date(row.breakEndedAt).getTime() - new Date(row.breakStartedAt).getTime()) / 60000));
    } else if (row.breakStartedAt && !row.breakEndedAt) {
      breakMinutes = Math.max(0, Math.round((Date.now() - new Date(row.breakStartedAt).getTime()) / 60000));
    }
    const netMinutes = Math.max(0, durationMinutes - breakMinutes);

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
      duration_minutes: durationMinutes,
      break_minutes: breakMinutes,
      net_minutes: netMinutes,
      events: eventsByShift.get(row.id) ?? [],
    };
  });
}
