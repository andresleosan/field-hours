import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import { getAdminPayrollPayslipIdentity } from "./payrollProfiles";
import { getSalaryAdviceSettings } from "./payrollSettings";
import { aggregateCompletedShifts } from "./shiftMetrics";
import type { AuthContext } from "./types";

const RULES_YEAR = 2026;
const MONTHLY_MINIMUM_EARNINGS_PENCE = 61_800;
const MONTHLY_STANDARD_EARNINGS_LIMIT_PENCE = 606_200;

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
    workerSocialSecuritySource: "calculated_monthly" | "operator_confirmed_weekly";
    total: number;
  };
  totalsToDate: {
    grossTaxablePay: number;
    taxPaid: number;
    source: "operator_confirmed";
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

function parseHourlyRate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.01 || value > 10_000) {
    throw new ApiError(400, "INVALID_INPUT", "Hourly rate must be between £0.01 and £10,000 for this advice.");
  }
  const pence = Math.round(value * 100);
  if (Math.abs(value * 100 - pence) > 1e-7) {
    throw new ApiError(400, "INVALID_INPUT", "Hourly rate can have at most two decimal places.");
  }
  return pence;
}

function parseMoneyPence(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10_000_000) {
    throw new ApiError(400, "INVALID_INPUT", `${field} must be a non-negative GBP amount.`);
  }
  const pence = Math.round(value * 100);
  if (Math.abs(value * 100 - pence) > 1e-7) {
    throw new ApiError(400, "INVALID_INPUT", `${field} can have at most two decimal places.`);
  }
  return pence;
}

function parseItisRate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new ApiError(400, "INVALID_INPUT", "ITIS rate must be a whole percentage from the employee's current notice.");
  }
  return value * 100;
}

function parseMonthlyWorkerSocialSecurityRate(value: unknown): number {
  if (value !== 0 && value !== 6) {
    throw new ApiError(400, "INVALID_INPUT", "Monthly worker Social Security must be 6% standard or 0% exempt.");
  }
  return value * 100;
}

function money(pence: number): number {
  return Number((pence / 100).toFixed(2));
}

function percentage(basisPoints: number): number {
  return Number((basisPoints / 100).toFixed(2));
}

export function calculateMonthlyWorkerSocialSecurity(
  grossPence: number,
  workerRateBps: number,
): number {
  const roundedGross = Math.floor(grossPence / 100) * 100;
  if (roundedGross < MONTHLY_MINIMUM_EARNINGS_PENCE) return 0;
  const contributionBase = Math.min(roundedGross, MONTHLY_STANDARD_EARNINGS_LIMIT_PENCE);
  return Math.round(contributionBase * workerRateBps / 10_000);
}

export async function calculateAdminSalaryAdvice(
  env: Env,
  auth: AuthContext,
  body: {
    userId?: unknown;
    periodType?: unknown;
    periodStart?: unknown;
    payDate?: unknown;
    hourlyRate?: unknown;
    itisRate?: unknown;
    workerSocialSecurityRate?: unknown;
    weeklyWorkerSocialSecurity?: unknown;
    yearToDateGrossTaxablePay?: unknown;
    yearToDateTaxPaid?: unknown;
    [key: string]: unknown;
  },
): Promise<SalaryAdvice> {
  requireRole(auth, "admin");
  const allowedFields = new Set([
    "userId",
    "periodType",
    "periodStart",
    "payDate",
    "hourlyRate",
    "itisRate",
    "workerSocialSecurityRate",
    "weeklyWorkerSocialSecurity",
    "yearToDateGrossTaxablePay",
    "yearToDateTaxPaid",
  ]);
  const unsupportedFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unsupportedFields.length > 0) {
    throw new ApiError(400, "INVALID_INPUT", `Unsupported Salary Advice field: ${unsupportedFields.join(", ")}.`);
  }

  const userId = requireString(body.userId, "Worker", 1, 120);
  const period = parseSalaryAdvicePeriod(body.periodType, body.periodStart, body.payDate);
  const hourlyRatePence = parseHourlyRate(body.hourlyRate);
  const itisRateBps = parseItisRate(body.itisRate);
  const yearToDateGrossPence = parseMoneyPence(body.yearToDateGrossTaxablePay, "Gross taxable pay to date");
  const yearToDateTaxPence = parseMoneyPence(body.yearToDateTaxPaid, "Tax paid to date");
  if (yearToDateTaxPence > yearToDateGrossPence) {
    throw new ApiError(400, "INVALID_TOTALS_TO_DATE", "Tax paid to date cannot exceed gross taxable pay to date.");
  }
  let monthlyWorkerRateBps: number | null = null;
  let confirmedWeeklySocialSecurityPence: number | null = null;
  if (period.type === "monthly") {
    monthlyWorkerRateBps = parseMonthlyWorkerSocialSecurityRate(body.workerSocialSecurityRate);
    if (body.weeklyWorkerSocialSecurity !== undefined) {
      throw new ApiError(400, "INVALID_INPUT", "Weekly Social Security must not be sent for a monthly Salary Advice.");
    }
  } else {
    confirmedWeeklySocialSecurityPence = parseMoneyPence(
      body.weeklyWorkerSocialSecurity,
      "Confirmed weekly worker Social Security",
    );
    if (body.workerSocialSecurityRate !== undefined) {
      throw new ApiError(400, "INVALID_INPUT", "A monthly Social Security rate must not be sent for a weekly Salary Advice.");
    }
  }
  const [settings, identity, metrics] = await Promise.all([
    getSalaryAdviceSettings(env, auth.user.organizationId),
    getAdminPayrollPayslipIdentity(env, auth, userId),
    aggregateCompletedShifts(env, auth.user.organizationId, userId, period.start, period.end),
  ]);

  const grossPence = Math.max(0, Math.round(metrics.minutes * hourlyRatePence / 60));
  const workerSocialSecurityPence = period.type === "monthly"
    ? calculateMonthlyWorkerSocialSecurity(grossPence, monthlyWorkerRateBps ?? 0)
    : confirmedWeeklySocialSecurityPence ?? 0;
  if (workerSocialSecurityPence > grossPence) {
    throw new ApiError(400, "INVALID_INPUT", "Worker Social Security cannot exceed gross pay for this Salary Advice.");
  }
  const incomeTaxPence = Math.max(0, Math.round(grossPence * itisRateBps / 10_000));
  const deductionPence = workerSocialSecurityPence + incomeTaxPence;
  if (deductionPence > grossPence) {
    throw new ApiError(409, "DEDUCTIONS_EXCEED_GROSS", "Confirmed deductions exceed gross pay for this Salary Advice.");
  }
  if (yearToDateGrossPence < grossPence || yearToDateTaxPence < incomeTaxPence) {
    throw new ApiError(
      400,
      "INVALID_TOTALS_TO_DATE",
      "Confirmed totals to date must include this Salary Advice and tax paid cannot exceed gross taxable pay.",
    );
  }
  const netPence = grossPence - deductionPence;
  const warnings = period.type === "weekly"
    ? ["WEEKLY_SOCIAL_SECURITY_RECONCILIATION_REQUIRED" as const]
    : [];

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
      weeklySocialSecurityConfirmed: period.type === "weekly",
      totalsToDateConfirmed: true,
      itisRateConfirmed: true,
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
      workerSocialSecurityRate: monthlyWorkerRateBps === null ? null : percentage(monthlyWorkerRateBps),
      workerSocialSecurity: money(workerSocialSecurityPence),
      workerSocialSecuritySource: period.type === "weekly" ? "operator_confirmed_weekly" : "calculated_monthly",
      total: money(deductionPence),
    },
    totalsToDate: {
      grossTaxablePay: money(yearToDateGrossPence),
      taxPaid: money(yearToDateTaxPence),
      source: "operator_confirmed",
    },
    grossTaxablePay: money(grossPence),
    netPay: money(netPence),
    warnings,
  };
}
