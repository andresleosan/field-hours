export interface ShiftMetricEvent {
  type: string;
  at: string;
}

export interface CompletedShiftMetricRow {
  id: string;
  userId: string;
  clockInAt: string;
  clockOutAt: string;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
}

export interface ShiftMetricSummary {
  minutes: number;
  shifts: number;
}

export function breakMinutesFromEvents(
  events: ShiftMetricEvent[],
  fallbackStart: string | null = null,
  fallbackEnd: string | null = null,
  now = Date.now(),
): number {
  let activeBreakAt: number | null = null;
  let totalMilliseconds = 0;
  let hasBreakEvents = false;

  for (const event of events) {
    const at = new Date(event.at).getTime();
    if (!Number.isFinite(at)) continue;
    if (event.type === "start_break" && activeBreakAt === null) {
      hasBreakEvents = true;
      activeBreakAt = at;
    } else if (event.type === "end_break" && activeBreakAt !== null) {
      hasBreakEvents = true;
      totalMilliseconds += Math.max(0, at - activeBreakAt);
      activeBreakAt = null;
    }
  }

  if (activeBreakAt !== null) totalMilliseconds += Math.max(0, now - activeBreakAt);

  if (!hasBreakEvents && fallbackStart) {
    const start = new Date(fallbackStart).getTime();
    const end = fallbackEnd ? new Date(fallbackEnd).getTime() : now;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      totalMilliseconds = Math.max(0, end - start);
    }
  }

  return Math.max(0, Math.round(totalMilliseconds / 60000));
}

export function netMinutesFromShift(
  shift: CompletedShiftMetricRow,
  events: ShiftMetricEvent[],
): number {
  const clockIn = new Date(shift.clockInAt).getTime();
  const clockOut = new Date(shift.clockOutAt).getTime();
  const durationMinutes = Number.isFinite(clockIn) && Number.isFinite(clockOut)
    ? Math.max(0, Math.round((clockOut - clockIn) / 60000))
    : 0;
  return Math.max(0, durationMinutes - breakMinutesFromEvents(events, shift.breakStartedAt, shift.breakEndedAt, clockOut));
}

export async function aggregateCompletedShifts(
  env: Env,
  organizationId: string,
  userId: string,
  startDate?: string,
  endDate?: string,
): Promise<ShiftMetricSummary> {
  let query = `
    SELECT
      s.id,
      s.user_id AS userId,
      s.clock_in_at AS clockInAt,
      s.clock_out_at AS clockOutAt,
      s.break_started_at AS breakStartedAt,
      s.break_ended_at AS breakEndedAt
    FROM workforce_shifts s
    WHERE s.organization_id = ?1
      AND s.user_id = ?2
      AND s.state = 'complete'
      AND s.clock_out_at IS NOT NULL`;
  const bindings: unknown[] = [organizationId, userId];
  let bindIndex = 3;
  if (startDate) {
    query += ` AND s.work_date >= ?${bindIndex}`;
    bindings.push(startDate);
    bindIndex += 1;
  }
  if (endDate) {
    query += ` AND s.work_date <= ?${bindIndex}`;
    bindings.push(endDate);
  }

  const shifts = await env.DB.prepare(query).bind(...bindings).all<CompletedShiftMetricRow>();
  if (shifts.results.length === 0) return { minutes: 0, shifts: 0 };

  const placeholders = shifts.results.map((_, index) => `?${index + 1}`).join(",");
  const eventRows = await env.DB.prepare(
    `SELECT shift_id AS shiftId, event_type AS type, occurred_at AS at
     FROM workforce_shift_events
     WHERE shift_id IN (${placeholders})
     ORDER BY rowid ASC`,
  ).bind(...shifts.results.map((shift) => shift.id)).all<ShiftMetricEvent & { shiftId: string }>();
  const eventsByShift = new Map<string, ShiftMetricEvent[]>();
  for (const event of eventRows.results) {
    const events = eventsByShift.get(event.shiftId) ?? [];
    events.push(event);
    eventsByShift.set(event.shiftId, events);
  }

  return shifts.results.reduce<ShiftMetricSummary>((summary, shift) => {
    summary.minutes += netMinutesFromShift(shift, eventsByShift.get(shift.id) ?? []);
    summary.shifts += 1;
    return summary;
  }, { minutes: 0, shifts: 0 });
}
