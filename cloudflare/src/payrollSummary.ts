import { requireRole } from "./auth";
import { ApiError } from "./http";
import { aggregateCompletedShifts } from "./shiftMetrics";
import type { AuthContext } from "./types";

export interface WorkerPayrollSummary {
  timezone: string;
  asOfDate: string;
  currentMonthStart: string;
  currentMonthMinutes: number;
  currentMonthShifts: number;
  totalCompletedMinutes: number;
  totalCompletedShifts: number;
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
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

export async function getWorkerPayrollSummary(env: Env, auth: AuthContext): Promise<WorkerPayrollSummary> {
  requireRole(auth, "worker");
  const now = new Date();
  const today = calendarParts(auth.user.timezone, now);
  const currentMonthStart = dateString(today.year, today.month, 1);

  const [currentMonth, total] = await Promise.all([
    aggregateCompletedShifts(env, auth.user.organizationId, auth.user.id, currentMonthStart, dateString(today.year, today.month, today.day)),
    aggregateCompletedShifts(env, auth.user.organizationId, auth.user.id),
  ]);

  return {
    timezone: auth.user.timezone,
    asOfDate: dateString(today.year, today.month, today.day),
    currentMonthStart,
    currentMonthMinutes: currentMonth.minutes,
    currentMonthShifts: currentMonth.shifts,
    totalCompletedMinutes: total.minutes,
    totalCompletedShifts: total.shifts,
  };
}
