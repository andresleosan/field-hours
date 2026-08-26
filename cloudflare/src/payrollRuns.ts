import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import { getAdminPayrollPreview, type PayrollPreview } from "./payrollCalculation";
import { getAdminPayrollPayslipIdentity } from "./payrollProfiles";
import { getAdminPayrollSettings } from "./payrollSettings";
import type { AuthContext } from "./types";

export type PayrollRunStatus = "pending_review" | "approved" | "changes_requested";

export interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: "GBP";
  status: PayrollRunStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  totals: PayrollPreview["totals"];
  workerCount: number;
}

export interface PayrollRunLine {
  userId: string;
  displayName: string;
  employeeNumber: string | null;
  profileStatus: "pending_review" | "approved" | "changes_requested";
  shiftCount: number;
  netMinutes: number;
  itisRate: number;
  grossPay: number;
  workerSocialSecurity: number;
  incomeTax: number;
  netPay: number;
  employerSocialSecurity: number;
  employerTotalCost: number;
  warnings: string[];
}

export interface PayrollRunDetails extends PayrollRun {
  lines: PayrollRunLine[];
}

export interface PayrollPayslip {
  generatedAt: string;
  currency: "GBP";
  run: {
    id: string;
    periodStart: string;
    periodEnd: string;
    payDate: string;
    submittedAt: string;
    approvedAt: string;
  };
  employer: {
    name: string;
    address: string;
  };
  worker: {
    userId: string;
    displayName: string;
    legalName: string;
    address: string;
    employeeNumber: string;
    taxReference: string;
    socialReference: string;
  };
  allowances: Array<{
    code: "basic_pay";
    description: string;
    shiftCount: number;
    netMinutes: number;
    hours: number;
    amount: number;
  }>;
  deductions: {
    workerSocialSecurity: number;
    incomeTax: number;
    total: number;
  };
  grossTaxablePay: number;
  netPay: number;
  itisRate: number;
}

interface PayrollRunRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: "GBP";
  status: PayrollRunStatus;
  grossPayPence: number;
  workerSocialSecurityPence: number;
  incomeTaxPence: number;
  netPayPence: number;
  employerSocialSecurityPence: number;
  employerTotalCostPence: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  workerCount: number;
}

interface PayrollRunLineRow {
  userId: string;
  displayName: string;
  employeeNumber: string | null;
  profileStatus: PayrollRunLine["profileStatus"];
  shiftCount: number;
  netMinutes: number;
  itisRateBps: number;
  grossPayPence: number;
  workerSocialSecurityPence: number;
  incomeTaxPence: number;
  netPayPence: number;
  employerSocialSecurityPence: number;
  employerTotalCostPence: number;
  warningsJson: string;
}

function validDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "INVALID_INPUT", field + " must use YYYY-MM-DD.");
  }
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "INVALID_INPUT", field + " is not a valid calendar date.");
  }
  return value;
}

function optionalDate(value: unknown, field: string): string | null {
  return value === undefined || value === null || value === "" ? null : validDate(value, field);
}

function pounds(pence: number): number {
  return Number((Number(pence) / 100).toFixed(2));
}

function toRun(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    payDate: row.payDate,
    currency: row.currency,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    reviewNote: row.reviewNote,
    totals: {
      grossPay: pounds(row.grossPayPence),
      workerSocialSecurity: pounds(row.workerSocialSecurityPence),
      incomeTax: pounds(row.incomeTaxPence),
      netPay: pounds(row.netPayPence),
      employerSocialSecurity: pounds(row.employerSocialSecurityPence),
      employerTotalCost: pounds(row.employerTotalCostPence),
    },
    workerCount: Number(row.workerCount ?? 0),
  };
}

function parseWarnings(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((warning): warning is string => typeof warning === "string") : [];
  } catch {
    return [];
  }
}

function toRunLine(row: PayrollRunLineRow): PayrollRunLine {
  return {
    userId: row.userId,
    displayName: row.displayName,
    employeeNumber: row.employeeNumber,
    profileStatus: row.profileStatus,
    shiftCount: Number(row.shiftCount),
    netMinutes: Number(row.netMinutes),
    itisRate: Number((Number(row.itisRateBps) / 100).toFixed(2)),
    grossPay: pounds(row.grossPayPence),
    workerSocialSecurity: pounds(row.workerSocialSecurityPence),
    incomeTax: pounds(row.incomeTaxPence),
    netPay: pounds(row.netPayPence),
    employerSocialSecurity: pounds(row.employerSocialSecurityPence),
    employerTotalCost: pounds(row.employerTotalCostPence),
    warnings: parseWarnings(row.warningsJson),
  };
}

const PAYROLL_RUN_LINE_SELECT = `SELECT
  l.user_id AS userId, l.display_name AS displayName,
  l.employee_number AS employeeNumber, l.profile_status AS profileStatus,
  l.shift_count AS shiftCount, l.net_minutes AS netMinutes,
  l.itis_rate_bps AS itisRateBps, l.gross_pay_pence AS grossPayPence,
  l.worker_social_security_pence AS workerSocialSecurityPence,
  l.income_tax_pence AS incomeTaxPence, l.net_pay_pence AS netPayPence,
  l.employer_social_security_pence AS employerSocialSecurityPence,
  l.employer_total_cost_pence AS employerTotalCostPence,
  l.warnings_json AS warningsJson
 FROM workforce_payroll_run_lines l`;

async function loadRun(env: Env, organizationId: string, runId: string): Promise<PayrollRunRow | null> {
  return env.DB.prepare(
    `SELECT
       r.id, r.period_start AS periodStart, r.period_end AS periodEnd, r.pay_date AS payDate,
       r.currency, r.status, r.gross_pay_pence AS grossPayPence,
       r.worker_social_security_pence AS workerSocialSecurityPence,
       r.income_tax_pence AS incomeTaxPence, r.net_pay_pence AS netPayPence,
       r.employer_social_security_pence AS employerSocialSecurityPence,
       r.employer_total_cost_pence AS employerTotalCostPence,
       r.submitted_at AS submittedAt, r.reviewed_at AS reviewedAt,
       r.reviewed_by AS reviewedBy, r.review_note AS reviewNote,
       COUNT(l.user_id) AS workerCount
     FROM workforce_payroll_runs r
     LEFT JOIN workforce_payroll_run_lines l ON l.payroll_run_id = r.id
     WHERE r.organization_id = ?1 AND r.id = ?2
     GROUP BY r.id`,
  ).bind(organizationId, runId).first<PayrollRunRow>();
}

function pence(value: number | null): number {
  return Math.max(0, Math.round((value ?? 0) * 100));
}

function assertPreviewReady(preview: PayrollPreview): void {
  if (preview.lines.length === 0) {
    throw new ApiError(409, "PAYROLL_EMPTY", "There are no workers in this payroll period.");
  }
  if (preview.lines.some((line) => line.profileStatus !== "approved" || line.grossPay === null || line.netPay === null)) {
    throw new ApiError(409, "PAYROLL_NOT_READY", "Every worker must have an approved, complete payroll profile before submission.");
  }
}

function previewParams(startDate: string | null, endDate: string | null): URLSearchParams {
  const params = new URLSearchParams();
  if (startDate && endDate) {
    params.set("start_date", startDate);
    params.set("end_date", endDate);
  }
  return params;
}

export async function listAdminPayrollRuns(env: Env, auth: AuthContext): Promise<PayrollRun[]> {
  requireRole(auth, "admin");
  const rows = await env.DB.prepare(
    `SELECT
       r.id, r.period_start AS periodStart, r.period_end AS periodEnd, r.pay_date AS payDate,
       r.currency, r.status, r.gross_pay_pence AS grossPayPence,
       r.worker_social_security_pence AS workerSocialSecurityPence,
       r.income_tax_pence AS incomeTaxPence, r.net_pay_pence AS netPayPence,
       r.employer_social_security_pence AS employerSocialSecurityPence,
       r.employer_total_cost_pence AS employerTotalCostPence,
       r.submitted_at AS submittedAt, r.reviewed_at AS reviewedAt,
       r.reviewed_by AS reviewedBy, r.review_note AS reviewNote,
       COUNT(l.user_id) AS workerCount
     FROM workforce_payroll_runs r
     LEFT JOIN workforce_payroll_run_lines l ON l.payroll_run_id = r.id
     WHERE r.organization_id = ?1
     GROUP BY r.id
     ORDER BY r.period_end DESC, r.submitted_at DESC
     LIMIT 12`,
  ).bind(auth.user.organizationId).all<PayrollRunRow>();
  return rows.results.map(toRun);
}

export async function getAdminPayrollRun(
  env: Env,
  auth: AuthContext,
  runIdValue: string,
): Promise<PayrollRunDetails> {
  requireRole(auth, "admin");
  const runId = requireString(runIdValue, "Payroll run", 1, 100);
  const run = await loadRun(env, auth.user.organizationId, runId);
  if (!run) throw new ApiError(404, "NOT_FOUND", "Payroll run not found.");
  const rows = await env.DB.prepare(
    `${PAYROLL_RUN_LINE_SELECT}
     WHERE l.payroll_run_id = ?1
     ORDER BY l.display_name COLLATE NOCASE, l.user_id`,
  ).bind(runId).all<PayrollRunLineRow>();
  return { ...toRun(run), lines: rows.results.map(toRunLine) };
}

export async function generateAdminPayrollPayslip(
  env: Env,
  auth: AuthContext,
  runIdValue: string,
  userIdValue: string,
): Promise<PayrollPayslip> {
  requireRole(auth, "admin");
  const runId = requireString(runIdValue, "Payroll run", 1, 100);
  const userId = requireString(userIdValue, "Worker", 1, 100);
  const run = await loadRun(env, auth.user.organizationId, runId);
  if (!run) throw new ApiError(404, "NOT_FOUND", "Payroll run not found.");
  if (run.status !== "approved") {
    throw new ApiError(409, "PAYROLL_RUN_NOT_APPROVED", "Only an approved payroll run can generate a Salary Advice.");
  }
  const row = await env.DB.prepare(
    `${PAYROLL_RUN_LINE_SELECT}
     WHERE l.payroll_run_id = ?1 AND l.user_id = ?2
     LIMIT 1`,
  ).bind(runId, userId).first<PayrollRunLineRow>();
  if (!row) throw new ApiError(404, "NOT_FOUND", "Worker payroll line not found.");

  const identity = await getAdminPayrollPayslipIdentity(env, auth, userId);
  const settings = await getAdminPayrollSettings(env, auth);
  if (!settings) {
    throw new ApiError(409, "PAYROLL_NOT_CONFIGURED", "Configure payroll settings before generating a Salary Advice.");
  }
  const line = toRunLine(row);
  const generatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
     (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.payslip.generated', ?3, ?4)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    userId,
    JSON.stringify({ runId, periodStart: run.periodStart, periodEnd: run.periodEnd }),
  ).run();

  return {
    generatedAt,
    currency: "GBP",
    run: {
      id: run.id,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      payDate: run.payDate,
      submittedAt: run.submittedAt,
      approvedAt: run.reviewedAt ?? run.submittedAt,
    },
    employer: {
      name: settings.businessName,
      address: settings.businessAddress,
    },
    worker: {
      userId,
      displayName: line.displayName,
      legalName: identity.legalName,
      address: identity.address,
      employeeNumber: line.employeeNumber ?? identity.employeeNumber,
      taxReference: identity.taxReference,
      socialReference: identity.socialReference,
    },
    allowances: [{
      code: "basic_pay",
      description: "Basic pay",
      shiftCount: line.shiftCount,
      netMinutes: line.netMinutes,
      hours: Number((line.netMinutes / 60).toFixed(2)),
      amount: line.grossPay,
    }],
    deductions: {
      workerSocialSecurity: line.workerSocialSecurity,
      incomeTax: line.incomeTax,
      total: Number((line.workerSocialSecurity + line.incomeTax).toFixed(2)),
    },
    grossTaxablePay: line.grossPay,
    netPay: line.netPay,
    itisRate: line.itisRate,
  };
}

export async function submitAdminPayrollRun(
  env: Env,
  auth: AuthContext,
  body: { startDate?: unknown; endDate?: unknown },
): Promise<PayrollRun> {
  requireRole(auth, "admin");
  const startDate = optionalDate(body.startDate, "Start date");
  const endDate = optionalDate(body.endDate, "End date");
  if ((startDate && !endDate) || (!startDate && endDate)) {
    throw new ApiError(400, "INVALID_INPUT", "Start date and end date must be provided together.");
  }

  const preview = await getAdminPayrollPreview(env, auth, previewParams(startDate, endDate));
  assertPreviewReady(preview);
  const existing = await env.DB.prepare(
    `SELECT id, status FROM workforce_payroll_runs
     WHERE organization_id = ?1 AND period_start = ?2 AND period_end = ?3 LIMIT 1`,
  ).bind(auth.user.organizationId, preview.periodStart, preview.periodEnd).first<{ id: string; status: PayrollRunStatus }>();
  if (existing?.status === "approved") {
    throw new ApiError(409, "PAYROLL_RUN_APPROVED", "This payroll period is already approved and locked.");
  }

  const runId = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    existing
      ? env.DB.prepare(
        `UPDATE workforce_payroll_runs
         SET pay_date = ?1, status = 'pending_review', gross_pay_pence = ?2,
             worker_social_security_pence = ?3, income_tax_pence = ?4, net_pay_pence = ?5,
             employer_social_security_pence = ?6, employer_total_cost_pence = ?7,
             submitted_at = ?8, reviewed_at = NULL, reviewed_by = NULL, review_note = NULL
         WHERE id = ?9 AND organization_id = ?10`,
      ).bind(
        preview.payDate,
        pence(preview.totals.grossPay),
        pence(preview.totals.workerSocialSecurity),
        pence(preview.totals.incomeTax),
        pence(preview.totals.netPay),
        pence(preview.totals.employerSocialSecurity),
        pence(preview.totals.employerTotalCost),
        now,
        runId,
        auth.user.organizationId,
      )
      : env.DB.prepare(
        `INSERT INTO workforce_payroll_runs
         (id, organization_id, period_start, period_end, pay_date, currency, status,
          gross_pay_pence, worker_social_security_pence, income_tax_pence, net_pay_pence,
          employer_social_security_pence, employer_total_cost_pence, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'GBP', 'pending_review', ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      ).bind(
        runId,
        auth.user.organizationId,
        preview.periodStart,
        preview.periodEnd,
        preview.payDate,
        pence(preview.totals.grossPay),
        pence(preview.totals.workerSocialSecurity),
        pence(preview.totals.incomeTax),
        pence(preview.totals.netPay),
        pence(preview.totals.employerSocialSecurity),
        pence(preview.totals.employerTotalCost),
        now,
      ),
    env.DB.prepare("DELETE FROM workforce_payroll_run_lines WHERE payroll_run_id = ?1").bind(runId),
    ...preview.lines.map((line) => env.DB.prepare(
      `INSERT INTO workforce_payroll_run_lines
       (payroll_run_id, user_id, display_name, email, employee_number, profile_status,
        shift_count, net_minutes, itis_rate_bps, gross_pay_pence,
        worker_social_security_pence, income_tax_pence, net_pay_pence,
        employer_social_security_pence, employer_total_cost_pence, warnings_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
    ).bind(
      runId,
      line.userId,
      line.displayName,
      line.email,
      line.employeeNumber,
      line.profileStatus,
      line.shiftCount,
      Math.round(line.hours * 60),
      Math.round((line.itisRate ?? 0) * 100),
      pence(line.grossPay),
      pence(line.workerSocialSecurity),
      pence(line.incomeTax),
      pence(line.netPay),
      pence(line.employerSocialSecurity),
      pence(line.employerTotalCost),
      JSON.stringify(line.warnings),
    )),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
       VALUES (?1, ?2, 'payroll.run.submitted', ?3, ?4)`,
    ).bind(
      auth.user.organizationId,
      auth.user.id,
      runId,
      JSON.stringify({ periodStart: preview.periodStart, periodEnd: preview.periodEnd, status: "pending_review" }),
    ),
  ];
  await env.DB.batch(statements);
  const saved = await loadRun(env, auth.user.organizationId, runId);
  if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "The payroll run could not be loaded.");
  return toRun(saved);
}

export async function reviewAdminPayrollRun(
  env: Env,
  auth: AuthContext,
  runIdValue: string,
  decision: unknown,
  note: unknown,
): Promise<PayrollRun> {
  requireRole(auth, "admin");
  const runId = requireString(runIdValue, "Payroll run", 1, 100);
  if (decision !== "approved" && decision !== "changes_requested") {
    throw new ApiError(400, "INVALID_INPUT", "The payroll decision is invalid.");
  }
  const reviewNote = decision === "changes_requested"
    ? requireString(note, "Review note", 1, 500)
    : note === undefined || note === null || note === "" ? null : requireString(note, "Review note", 1, 500);
  const run = await loadRun(env, auth.user.organizationId, runId);
  if (!run) throw new ApiError(404, "NOT_FOUND", "Payroll run not found.");
  if (run.status !== "pending_review") {
    throw new ApiError(409, "PAYROLL_RUN_LOCKED", "Only a payroll run awaiting review can be decided.");
  }
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE workforce_payroll_runs
     SET status = ?1, reviewed_at = ?2, reviewed_by = ?3, review_note = ?4
     WHERE id = ?5 AND organization_id = ?6 AND status = 'pending_review'`,
  ).bind(decision, now, auth.user.id, reviewNote, runId, auth.user.organizationId).run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "PAYROLL_RUN_LOCKED", "Only a payroll run awaiting review can be decided.");
  }
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
     (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    decision === "approved" ? "payroll.run.approved" : "payroll.run.changes_requested",
    runId,
    JSON.stringify({ note: reviewNote }),
  ).run();
  const updated = await loadRun(env, auth.user.organizationId, runId);
  if (!updated) throw new ApiError(500, "INTERNAL_ERROR", "The payroll run could not be loaded.");
  return toRun(updated);
}
