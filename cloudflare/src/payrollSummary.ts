import { requireRole } from "./auth";
import { ApiError } from "./http";
import { getPayrollSchedule } from "./payrollSettings";
import { aggregateCompletedShifts } from "./shiftMetrics";
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

function subtractMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export async function getWorkerPayrollSummary(env: Env, auth: AuthContext): Promise<WorkerPayrollSummary> {
  requireRole(auth, "worker");
  const now = new Date();
  const today = calendarParts(auth.user.timezone, now);
  const { payDay } = await getPayrollSchedule(env, auth.user.organizationId);
  const payDateHasPassed = today.day >= payDay;
  const previous = subtractMonth(today.year, today.month);
  const next = addMonth(today.year, today.month);
  const currentPeriodStart = payDateHasPassed
    ? dateString(today.year, today.month, payDay)
    : dateString(previous.year, previous.month, payDay);
  const lastPayDate = currentPeriodStart;
  const nextPayDate = payDateHasPassed
    ? dateString(next.year, next.month, payDay)
    : dateString(today.year, today.month, payDay);

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
