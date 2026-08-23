import { requireRole } from "./auth";
import { ApiError } from "./http";
import { getPayrollCalculationSettings } from "./payrollSettings";
import type { AuthContext } from "./types";

const RULES_YEAR = 2026;
const MINIMUM_EARNINGS_THRESHOLD_POUNDS = 618;
const STANDARD_EARNINGS_LIMIT_POUNDS = 6_062;
const UPPER_EARNINGS_LIMIT_POUNDS = 27_632;
const UPPER_SECONDARY_RATE_BPS = 250;
const DEFAULT_ITIS_RATE_BPS = 2_200;

export interface PayrollPreviewLine {
  userId: string;
  displayName: string;
  email: string;
  employeeNumber: string | null;
  profileStatus: "not_started" | "pending_review" | "approved" | "changes_requested";
  shiftCount: number;
  hours: number;
  itisRate: number | null;
  grossPay: number | null;
  workerSocialSecurity: number | null;
  incomeTax: number | null;
  netPay: number | null;
  employerSocialSecurity: number | null;
  employerTotalCost: number | null;
  warnings: string[];
}

export interface PayrollPreview {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: "GBP";
  isEstimate: true;
  rules: {
    year: number;
    minimumEarningsThreshold: number;
    standardEarningsLimit: number;
    upperEarningsLimit: number;
    workerSocialSecurityRate: number;
    employerSocialSecurityRate: number;
    employerUpperBandRate: number;
    defaultItisRate: number;
  };
  lines: PayrollPreviewLine[];
  totals: {
    grossPay: number;
    workerSocialSecurity: number;
    incomeTax: number;
    netPay: number;
    employerSocialSecurity: number;
    employerTotalCost: number;
  };
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

interface PayrollRow {
  userId: string;
  displayName: string;
  email: string;
  employeeNumber: string | null;
  itisRateBps: number | null;
  status: "pending_review" | "approved" | "changes_requested" | null;
  shiftCount: number;
  netMinutes: number | null;
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

function validDate(value: string | null, field: string): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "INVALID_INPUT", `${field} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "INVALID_INPUT", `${field} is not a valid calendar date.`);
  }
  return value;
}

function money(pence: number | null): number | null {
  return pence === null ? null : Number((pence / 100).toFixed(2));
}

function roundPence(value: number): number {
  return Math.max(0, Math.round(value));
}

function currentPeriod(timezone: string, payDay: number): { periodStart: string; periodEnd: string; payDate: string } {
  const today = calendarParts(timezone, new Date());
  const hasPaid = today.day >= payDay;
  const previous = subtractMonth(today.year, today.month);
  const next = addMonth(today.year, today.month);
  return {
    periodStart: hasPaid ? dateString(today.year, today.month, payDay) : dateString(previous.year, previous.month, payDay),
    periodEnd: dateString(today.year, today.month, today.day),
    payDate: hasPaid ? dateString(next.year, next.month, payDay) : dateString(today.year, today.month, payDay),
  };
}

function socialSecurity(grossPence: number, workerRateBps: number, employerRateBps: number): { worker: number; employer: number } {
  // Jersey's monthly calculator asks for gross monthly earnings without pence.
  const grossPounds = Math.floor(grossPence / 100);
  if (grossPounds < MINIMUM_EARNINGS_THRESHOLD_POUNDS) return { worker: 0, employer: 0 };
  const upToStandard = Math.min(grossPounds, STANDARD_EARNINGS_LIMIT_POUNDS);
  const upperBand = Math.max(0, Math.min(grossPounds, UPPER_EARNINGS_LIMIT_POUNDS) - STANDARD_EARNINGS_LIMIT_POUNDS);
  return {
    worker: roundPence(upToStandard * workerRateBps / 100),
    employer: roundPence(upToStandard * employerRateBps / 100 + upperBand * UPPER_SECONDARY_RATE_BPS / 100),
  };
}

async function loadPayrollRows(
  env: Env,
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PayrollRow[]> {
  const result = await env.DB.prepare(
    `SELECT
       m.user_id AS userId,
       m.display_name AS displayName,
       u.email AS email,
       p.employee_number AS employeeNumber,
       p.itis_rate_bps AS itisRateBps,
       p.status AS status,
       COUNT(s.id) AS shiftCount,
       COALESCE(SUM(
         MAX(0, CAST((julianday(s.clock_out_at) - julianday(s.clock_in_at)) * 1440 AS INTEGER))
         - CASE
             WHEN s.break_started_at IS NOT NULL AND s.break_ended_at IS NOT NULL
             THEN MAX(0, CAST((julianday(s.break_ended_at) - julianday(s.break_started_at)) * 1440 AS INTEGER))
             ELSE 0
           END
       ), 0) AS netMinutes
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id
     LEFT JOIN workforce_payroll_profiles p
       ON p.organization_id = m.organization_id AND p.user_id = m.user_id
     LEFT JOIN workforce_shifts s
       ON s.organization_id = m.organization_id
       AND s.user_id = m.user_id
       AND s.state = 'complete'
       AND s.work_date >= ?2
       AND s.work_date <= ?3
     WHERE m.organization_id = ?1 AND m.role = 'worker'
     GROUP BY m.user_id, m.display_name, u.email, p.employee_number, p.itis_rate_bps, p.status
     ORDER BY m.display_name COLLATE NOCASE ASC`,
  ).bind(organizationId, periodStart, periodEnd).all<PayrollRow>();
  return result.results;
}

export async function getAdminPayrollPreview(
  env: Env,
  auth: AuthContext,
  params: URLSearchParams,
): Promise<PayrollPreview> {
  requireRole(auth, "admin");
  const settings = await getPayrollCalculationSettings(env, auth.user.organizationId);
  const requestedStart = validDate(params.get("start_date"), "Start date");
  const requestedEnd = validDate(params.get("end_date"), "End date");
  let periodStart: string;
  let periodEnd: string;
  let payDate: string;
  if ((requestedStart && !requestedEnd) || (!requestedStart && requestedEnd)) {
    throw new ApiError(400, "INVALID_INPUT", "Start date and end date must be provided together.");
  }
  if (requestedStart && requestedEnd) {
    if (requestedStart > requestedEnd) throw new ApiError(400, "INVALID_INPUT", "Start date cannot be after end date.");
    periodStart = requestedStart;
    periodEnd = requestedEnd;
    const year = Number(periodStart.slice(0, 4));
    const month = Number(periodStart.slice(5, 7));
    const next = addMonth(year, month);
    payDate = dateString(next.year, next.month, settings.payDay);
  } else {
    ({ periodStart, periodEnd, payDate } = currentPeriod(auth.user.timezone, settings.payDay));
  }
  if (periodStart.slice(0, 4) !== String(RULES_YEAR) || periodEnd.slice(0, 4) !== String(RULES_YEAR)) {
    throw new ApiError(409, "RULES_NOT_AVAILABLE", `Jersey payroll rules are configured for ${RULES_YEAR} only.`);
  }

  const rows = await loadPayrollRows(env, auth.user.organizationId, periodStart, periodEnd);
  const lines: PayrollPreviewLine[] = rows.map((row) => {
    const netMinutes = Math.max(0, Number(row.netMinutes ?? 0));
    const hours = Number((netMinutes / 60).toFixed(2));
    const warnings: string[] = [];
    const profileStatus = row.status ?? "not_started";
    if (profileStatus !== "approved") {
      warnings.push("Payroll profile is not approved.");
      return {
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        employeeNumber: row.employeeNumber,
        profileStatus,
        shiftCount: Number(row.shiftCount ?? 0),
        hours,
        itisRate: null,
        grossPay: null,
        workerSocialSecurity: null,
        incomeTax: null,
        netPay: null,
        employerSocialSecurity: null,
        employerTotalCost: null,
        warnings,
      };
    }

    const grossPence = roundPence(netMinutes * settings.hourlyRatePence / 60);
    const itisRateBps = row.itisRateBps ?? DEFAULT_ITIS_RATE_BPS;
    if (row.itisRateBps === null) warnings.push("ITIS rate missing; Jersey default of 22% applied.");
    const social = socialSecurity(grossPence, settings.workerSocialSecurityRateBps, settings.employerSocialSecurityRateBps);
    const incomeTaxPence = roundPence(grossPence * itisRateBps / 10_000);
    const netPence = Math.max(0, grossPence - social.worker - incomeTaxPence);
    const employerTotalPence = grossPence + social.employer;
    return {
      userId: row.userId,
      displayName: row.displayName,
      email: row.email,
      employeeNumber: row.employeeNumber,
      profileStatus,
      shiftCount: Number(row.shiftCount ?? 0),
      hours,
      itisRate: Number((itisRateBps / 100).toFixed(2)),
      grossPay: money(grossPence),
      workerSocialSecurity: money(social.worker),
      incomeTax: money(incomeTaxPence),
      netPay: money(netPence),
      employerSocialSecurity: money(social.employer),
      employerTotalCost: money(employerTotalPence),
      warnings,
    };
  });

  const totals = lines.reduce((total, line) => ({
    grossPay: total.grossPay + (line.grossPay ?? 0),
    workerSocialSecurity: total.workerSocialSecurity + (line.workerSocialSecurity ?? 0),
    incomeTax: total.incomeTax + (line.incomeTax ?? 0),
    netPay: total.netPay + (line.netPay ?? 0),
    employerSocialSecurity: total.employerSocialSecurity + (line.employerSocialSecurity ?? 0),
    employerTotalCost: total.employerTotalCost + (line.employerTotalCost ?? 0),
  }), { grossPay: 0, workerSocialSecurity: 0, incomeTax: 0, netPay: 0, employerSocialSecurity: 0, employerTotalCost: 0 });
  return {
    periodStart,
    periodEnd,
    payDate,
    currency: "GBP",
    isEstimate: true,
    rules: {
      year: RULES_YEAR,
      minimumEarningsThreshold: MINIMUM_EARNINGS_THRESHOLD_POUNDS,
      standardEarningsLimit: STANDARD_EARNINGS_LIMIT_POUNDS,
      upperEarningsLimit: UPPER_EARNINGS_LIMIT_POUNDS,
      workerSocialSecurityRate: settings.workerSocialSecurityRateBps / 100,
      employerSocialSecurityRate: settings.employerSocialSecurityRateBps / 100,
      employerUpperBandRate: UPPER_SECONDARY_RATE_BPS / 100,
      defaultItisRate: DEFAULT_ITIS_RATE_BPS / 100,
    },
    lines,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(2))])) as typeof totals,
  };
}
