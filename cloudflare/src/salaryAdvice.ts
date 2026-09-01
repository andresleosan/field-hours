import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import { getAdminPayrollPayslipIdentity } from "./payrollProfiles";
import { getSalaryAdviceSettings } from "./payrollSettings";
import { aggregateCompletedShifts } from "./shiftMetrics";
import type { AuthContext } from "./types";

const RULES_YEAR = 2026;

export type SalaryAdvicePeriodType = "weekly" | "monthly";
export type SalaryAdviceWarningCode = "WEEKLY_SOCIAL_SECURITY_RECONCILIATION_REQUIRED";

export interface SalaryAdvice {
  calculatedAt: string;
  currency: "GBP";
  isEstimate: true;
  period: { type: SalaryAdvicePeriodType; start: string; end: string; payDate: string };
  employer: { name: string; address: string };
  worker: {
    userId: string;
    displayName: string;
    legalName: string;
    address: string;
    employeeNumber: string;
    taxReference: string;
    socialReference: string;
  };
  allowance: {
    description: "Basic Hourly Pay";
    shiftCount: number;
    netMinutes: number;
    hours: number;
    hourlyRate: number;
    amount: number;
  };
  deductions: {
    itisRate: number;
    incomeTax: number;
    workerSocialSecurityRate: number | null;
    workerSocialSecurity: number;
    workerSocialSecuritySource: "calculated_from_saved_hours";
    total: number;
  };
  totalsToDate: {
    grossTaxablePay: number;
    taxPaid: number;
    source: "calculated_from_saved_hours";
  };
  grossTaxablePay: number;
  netPay: number;
  warnings: SalaryAdviceWarningCode[];
}

export interface SalaryAdvicePeriod {
  type: SalaryAdvicePeriodType;
  start: string;
  end: string;
  payDate: string;
}

function parseDate(value: unknown, field: string): string {
  const date = requireString(value, field, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, "INVALID_INPUT", `${field} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ApiError(400, "INVALID_INPUT", `${field} is not a valid calendar date.`);
  }
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseSalaryAdvicePeriod(
  periodType: unknown,
  periodStartValue: unknown,
  payDateValue: unknown,
): SalaryAdvicePeriod {
  if (periodType !== "weekly" && periodType !== "monthly") {
    throw new ApiError(400, "INVALID_INPUT", "Period type must be weekly or monthly.");
  }
  const start = parseDate(periodStartValue, "Period start");
  const payDate = parseDate(payDateValue, "Pay date");
  const startDate = new Date(`${start}T00:00:00Z`);
  if (startDate.getUTCFullYear() !== RULES_YEAR) {
    throw new ApiError(409, "RULES_NOT_AVAILABLE", `Jersey payroll rules are configured for ${RULES_YEAR} only.`);
  }

  let endDate: Date;
  if (periodType === "weekly") {
    if (startDate.getUTCDay() !== 1) {
      throw new ApiError(400, "INVALID_PERIOD", "A weekly period must start on Monday.");
    }
    endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
  } else {
    if (startDate.getUTCDate() !== 1) {
      throw new ApiError(400, "INVALID_PERIOD", "A monthly period must start on the first day of the month.");
    }
    endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));
  }
  const end = isoDate(endDate);
  if (endDate.getUTCFullYear() !== RULES_YEAR || Number(payDate.slice(0, 4)) !== RULES_YEAR) {
    throw new ApiError(409, "RULES_NOT_AVAILABLE", `The full period and pay date must use the configured ${RULES_YEAR} rules.`);
  }
  if (payDate < start) {
    throw new ApiError(400, "INVALID_PERIOD", "Pay date cannot be before the selected period starts.");
  }
  return { type: periodType, start, end, payDate };
}

function money(pence: number): number {
  return Number((pence / 100).toFixed(2));
}

function percentage(basisPoints: number): number {
  return Number((basisPoints / 100).toFixed(2));
}

export function calculateMonthlyWorkerSocialSecurity(grossPence: number): number {
  return Math.max(0, Math.round(grossPence * 600 / 10_000));
}

export async function calculateAdminSalaryAdvice(
  env: Env,
  auth: AuthContext,
  body: {
    userId?: unknown;
    periodType?: unknown;
    periodStart?: unknown;
    payDate?: unknown;
    [key: string]: unknown;
  },
): Promise<SalaryAdvice> {
  requireRole(auth, "admin");
  const allowedFields = new Set([
    "userId",
    "periodType",
    "periodStart",
    "payDate",
  ]);
  const unsupportedFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unsupportedFields.length > 0) {
    throw new ApiError(400, "INVALID_INPUT", `Unsupported Salary Advice field: ${unsupportedFields.join(", ")}.`);
  }

  const userId = requireString(body.userId, "Worker", 1, 120);
  const period = parseSalaryAdvicePeriod(body.periodType, body.periodStart, body.payDate);
  const [settings, identity, metrics] = await Promise.all([
    getSalaryAdviceSettings(env, auth.user.organizationId),
    getAdminPayrollPayslipIdentity(env, auth, userId),
    aggregateCompletedShifts(env, auth.user.organizationId, userId, period.start, period.end),
  ]);
  const yearStart = `${period.start.slice(0, 4)}-01-01`;
  const yearToDateMetrics = await aggregateCompletedShifts(
    env,
    auth.user.organizationId,
    userId,
    yearStart,
    period.end,
  );

  if (identity.hourlyRatePence === null) {
    throw new ApiError(409, "PAYROLL_PROFILE_INCOMPLETE", "Assign an hourly rate to this worker before calculating a Salary Advice.");
  }
  const hourlyRatePence = identity.hourlyRatePence;
  const itisRateBps = Math.round(settings.itisRate * 100);

  const grossPence = Math.max(0, Math.round(metrics.minutes * hourlyRatePence / 60));
  const yearToDateGrossPence = Math.max(0, Math.round(yearToDateMetrics.minutes * hourlyRatePence / 60));
  const workerSocialSecurityPence = calculateMonthlyWorkerSocialSecurity(grossPence);
  if (workerSocialSecurityPence > grossPence) {
    throw new ApiError(400, "INVALID_INPUT", "Worker Social Security cannot exceed gross pay for this Salary Advice.");
  }
  const incomeTaxPence = Math.max(0, Math.round(grossPence * itisRateBps / 10_000));
  const deductionPence = workerSocialSecurityPence + incomeTaxPence;
  if (deductionPence > grossPence) {
    throw new ApiError(409, "DEDUCTIONS_EXCEED_GROSS", "Confirmed deductions exceed gross pay for this Salary Advice.");
  }
  const yearToDateTaxPence = Math.max(0, Math.round(yearToDateGrossPence * itisRateBps / 10_000));
  const netPence = grossPence - deductionPence;
  const warnings: SalaryAdviceWarningCode[] = [];

  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'salary_advice.calculated', ?3, ?4)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    userId,
    JSON.stringify({
      periodType: period.type,
      periodStart: period.start,
      periodEnd: period.end,
      shiftCount: metrics.shifts,
      yearToDateShiftCount: yearToDateMetrics.shifts,
      calculationSource: "saved_profile_and_completed_shifts",
      socialSecurityRate: 6,
      itisRateYear: settings.itisRateYear,
    }),
  ).run();

  return {
    calculatedAt: new Date().toISOString(),
    currency: "GBP",
    isEstimate: true,
    period,
    employer: { name: settings.businessName, address: settings.businessAddress },
    worker: {
      userId,
      displayName: identity.displayName,
      legalName: identity.legalName,
      address: identity.address,
      employeeNumber: identity.employeeNumber,
      taxReference: identity.taxReference,
      socialReference: identity.socialReference,
    },
    allowance: {
      description: "Basic Hourly Pay",
      shiftCount: metrics.shifts,
      netMinutes: metrics.minutes,
      hours: Number((metrics.minutes / 60).toFixed(4)),
      hourlyRate: money(hourlyRatePence),
      amount: money(grossPence),
    },
    deductions: {
      itisRate: percentage(itisRateBps),
      incomeTax: money(incomeTaxPence),
      workerSocialSecurityRate: 6,
      workerSocialSecurity: money(workerSocialSecurityPence),
      workerSocialSecuritySource: "calculated_from_saved_hours",
      total: money(deductionPence),
    },
    totalsToDate: {
      grossTaxablePay: money(yearToDateGrossPence),
      taxPaid: money(yearToDateTaxPence),
      source: "calculated_from_saved_hours",
    },
    grossTaxablePay: money(grossPence),
    netPay: money(netPence),
    warnings,
  };
}
