import { requireRole } from "./auth";
import { ApiError } from "./http";
import type { AuthContext } from "./types";

export interface WorkerPayrollSummary {
  timezone: string;
  asOfDate: string;
  currentPeriodStart: string;
  currentPeriodMinutes: number;
  currentPeriodShifts: number;
  totalCompletedMinutes: number;
  totalCompletedShifts: number;
  lastPayDate: string;
  nextPayDate: string;
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

interface AggregateRow {
  minutes: number | null;
  shifts: number | null;
}

function calendarParts(timezone: string, value: Date): CalendarParts {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
    const result = { year: get("year"), month: get("month"), day: get("day") };
    if (Object.values(result).some((item) => !Number.isInteger(item))) throw new Error("Invalid calendar date");
    return result;
  } catch {
    throw new ApiError(500, "TIMEZONE_INVALID", "The organization timezone is invalid.");
  }
}

function dateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

async function aggregateCompletedShifts(
  env: Env,
  organizationId: string,
  userId: string,
  startDate?: string,
  endDate?: string,
): Promise<{ minutes: number; shifts: number }> {
  let query = `
    SELECT
      COALESCE(SUM(
        MAX(0, CAST((julianday(s.clock_out_at) - julianday(s.clock_in_at)) * 1440 AS INTEGER))
        - CASE
            WHEN s.break_started_at IS NOT NULL AND s.break_ended_at IS NOT NULL
            THEN MAX(0, CAST((julianday(s.break_ended_at) - julianday(s.break_started_at)) * 1440 AS INTEGER))
            ELSE 0
          END
      ), 0) AS minutes,
      COUNT(*) AS shifts
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
  const row = await env.DB.prepare(query).bind(...bindings).first<AggregateRow>();
  if (!row) throw new ApiError(500, "INTERNAL_ERROR", "The payroll summary could not be calculated.");
  return {
    minutes: Math.max(0, Number(row.minutes ?? 0)),
    shifts: Math.max(0, Number(row.shifts ?? 0)),
  };
}

export async function getWorkerPayrollSummary(env: Env, auth: AuthContext): Promise<WorkerPayrollSummary> {
  requireRole(auth, "worker");
  const now = new Date();
  const today = calendarParts(auth.user.timezone, now);
  const currentPeriodStart = dateString(today.year, today.month, 1);
  const next = addMonth(today.year, today.month);
  const lastPayDate = currentPeriodStart;
  const nextPayDate = dateString(next.year, next.month, 1);

  const [currentPeriod, total] = await Promise.all([
    aggregateCompletedShifts(env, auth.user.organizationId, auth.user.id, currentPeriodStart, dateString(today.year, today.month, today.day)),
    aggregateCompletedShifts(env, auth.user.organizationId, auth.user.id),
  ]);

  return {
    timezone: auth.user.timezone,
    asOfDate: dateString(today.year, today.month, today.day),
    currentPeriodStart,
    currentPeriodMinutes: currentPeriod.minutes,
    currentPeriodShifts: currentPeriod.shifts,
    totalCompletedMinutes: total.minutes,
    totalCompletedShifts: total.shifts,
    lastPayDate,
    nextPayDate,
  };
}
