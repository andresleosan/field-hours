import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import { encryptPayrollValue } from "./payrollCrypto";
import type { AuthContext } from "./types";

export interface PayrollSettings {
  hourlyRate: number;
  payFrequency: "monthly";
  payDay: number;
  businessName: string;
  businessAddress: string;
  hasBusinessTaxReference: boolean;
  hasBusinessSocialReference: boolean;
  workerSocialSecurityRate: number;
  employerSocialSecurityRate: number;
  updatedAt: string;
}

export interface PayrollCalculationSettings {
  hourlyRatePence: number;
  payFrequency: "monthly";
  payDay: number;
  workerSocialSecurityRateBps: number;
  employerSocialSecurityRateBps: number;
}

interface PayrollSettingsRow {
  organizationId: string;
  hourlyRatePence: number;
  payFrequency: "monthly";
  payDay: number;
  businessName: string;
  businessAddress: string;
  businessTaxReferenceCiphertext: string | null;
  businessSocialReferenceCiphertext: string | null;
  workerSocialSecurityRateBps: number;
  employerSocialSecurityRateBps: number;
  updatedAt: string;
}

function parseMoneyPence(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.01 || value > 1_000_000) {
    throw new ApiError(400, "INVALID_INPUT", `${field} must be between £0.01 and £1,000,000.`);
  }
  const pence = Math.round(value * 100);
  if (Math.abs(value - pence / 100) > Number.EPSILON) {
    throw new ApiError(400, "INVALID_INPUT", `${field} can have at most two decimal places.`);
  }
  return pence;
}

function parseRate(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new ApiError(400, "INVALID_INPUT", `${field} must be a percentage between 0 and 100.`);
  }
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > Number.EPSILON) {
    throw new ApiError(400, "INVALID_INPUT", `${field} can have at most two decimal places.`);
  }
  return Math.round(rounded * 100);
}

function parsePayDay(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 28) {
    throw new ApiError(400, "INVALID_INPUT", "Pay day must be a whole day between 1 and 28.");
  }
  return value;
}

function optionalString(value: unknown, field: string, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, 1, maximum);
}

function rateFromBps(value: number): number {
  return Number((value / 100).toFixed(2));
}

function toSettings(row: PayrollSettingsRow): PayrollSettings {
  return {
    hourlyRate: Number((row.hourlyRatePence / 100).toFixed(2)),
    payFrequency: row.payFrequency,
    payDay: row.payDay,
    businessName: row.businessName,
    businessAddress: row.businessAddress,
    hasBusinessTaxReference: Boolean(row.businessTaxReferenceCiphertext),
    hasBusinessSocialReference: Boolean(row.businessSocialReferenceCiphertext),
    workerSocialSecurityRate: rateFromBps(row.workerSocialSecurityRateBps),
    employerSocialSecurityRate: rateFromBps(row.employerSocialSecurityRateBps),
    updatedAt: row.updatedAt,
  };
}

async function loadSettings(env: Env, organizationId: string): Promise<PayrollSettingsRow | null> {
  return env.DB.prepare(
    `SELECT
       organization_id AS organizationId,
       hourly_rate_pence AS hourlyRatePence,
       pay_frequency AS payFrequency,
       pay_day AS payDay,
       business_name AS businessName,
       business_address AS businessAddress,
       business_tax_reference_ciphertext AS businessTaxReferenceCiphertext,
       business_social_reference_ciphertext AS businessSocialReferenceCiphertext,
       worker_social_security_rate_bps AS workerSocialSecurityRateBps,
       employer_social_security_rate_bps AS employerSocialSecurityRateBps,
       updated_at AS updatedAt
     FROM workforce_payroll_settings
     WHERE organization_id = ?1
     LIMIT 1`,
  ).bind(organizationId).first<PayrollSettingsRow>();
}

export async function getAdminPayrollSettings(env: Env, auth: AuthContext): Promise<PayrollSettings | null> {
  requireRole(auth, "admin");
  const row = await loadSettings(env, auth.user.organizationId);
  return row ? toSettings(row) : null;
}

export async function getPayrollSchedule(env: Env, organizationId: string): Promise<{ payDay: number }> {
  const row = await loadSettings(env, organizationId);
  return { payDay: row?.payDay ?? 1 };
}

export async function getPayrollCalculationSettings(
  env: Env,
  organizationId: string,
): Promise<PayrollCalculationSettings> {
  const row = await loadSettings(env, organizationId);
  if (!row) throw new ApiError(409, "PAYROLL_NOT_CONFIGURED", "Configure payroll settings before calculating payroll.");
  return {
    hourlyRatePence: row.hourlyRatePence,
    payFrequency: row.payFrequency,
    payDay: row.payDay,
    workerSocialSecurityRateBps: row.workerSocialSecurityRateBps,
    employerSocialSecurityRateBps: row.employerSocialSecurityRateBps,
  };
}

export async function saveAdminPayrollSettings(
  env: Env,
  auth: AuthContext,
  body: {
    hourlyRate?: unknown;
    payFrequency?: unknown;
    payDay?: unknown;
    businessName?: unknown;
    businessAddress?: unknown;
    businessTaxReference?: unknown;
    businessSocialReference?: unknown;
    workerSocialSecurityRate?: unknown;
    employerSocialSecurityRate?: unknown;
  },
): Promise<PayrollSettings> {
  requireRole(auth, "admin");
  if (body.payFrequency !== "monthly") {
    throw new ApiError(400, "INVALID_INPUT", "Only a monthly pay frequency is currently supported.");
  }

  const hourlyRatePence = parseMoneyPence(body.hourlyRate, "Hourly rate");
  const payDay = parsePayDay(body.payDay);
  const businessName = requireString(body.businessName, "Business name", 2, 160);
  const businessAddress = requireString(body.businessAddress, "Business address", 2, 250);
  const workerSocialSecurityRateBps = parseRate(body.workerSocialSecurityRate, "Worker Social Security");
  const employerSocialSecurityRateBps = parseRate(body.employerSocialSecurityRate, "Employer Social Security");
  const businessTaxReference = optionalString(body.businessTaxReference, "Business Tax Reference", 80);
  const businessSocialReference = optionalString(body.businessSocialReference, "Business Social Reference", 80);
  const existing = await loadSettings(env, auth.user.organizationId);
  const [businessTaxReferenceCiphertext, businessSocialReferenceCiphertext] = await Promise.all([
    businessTaxReference
      ? encryptPayrollValue(env, businessTaxReference)
      : Promise.resolve(existing?.businessTaxReferenceCiphertext ?? null),
    businessSocialReference
      ? encryptPayrollValue(env, businessSocialReference)
      : Promise.resolve(existing?.businessSocialReferenceCiphertext ?? null),
  ]);
  const updatedAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workforce_payroll_settings
       (organization_id, hourly_rate_pence, pay_frequency, pay_day,
        business_name, business_address,
        business_tax_reference_ciphertext, business_social_reference_ciphertext,
        worker_social_security_rate_bps, employer_social_security_rate_bps,
        updated_at, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
     ON CONFLICT(organization_id) DO UPDATE SET
       hourly_rate_pence = excluded.hourly_rate_pence,
       pay_frequency = excluded.pay_frequency,
       pay_day = excluded.pay_day,
       business_name = excluded.business_name,
       business_address = excluded.business_address,
       business_tax_reference_ciphertext = excluded.business_tax_reference_ciphertext,
       business_social_reference_ciphertext = excluded.business_social_reference_ciphertext,
       worker_social_security_rate_bps = excluded.worker_social_security_rate_bps,
       employer_social_security_rate_bps = excluded.employer_social_security_rate_bps,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).bind(
    auth.user.organizationId,
    hourlyRatePence,
    "monthly",
    payDay,
    businessName,
    businessAddress,
    businessTaxReferenceCiphertext,
    businessSocialReferenceCiphertext,
    workerSocialSecurityRateBps,
    employerSocialSecurityRateBps,
    updatedAt,
    auth.user.id,
  ).run();

  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.settings.updated', ?1, ?3)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    JSON.stringify({
      hourlyRate: hourlyRatePence / 100,
      payFrequency: "monthly",
      payDay,
      workerSocialSecurityRate: workerSocialSecurityRateBps / 100,
      employerSocialSecurityRate: employerSocialSecurityRateBps / 100,
      hasBusinessTaxReference: Boolean(businessTaxReferenceCiphertext),
      hasBusinessSocialReference: Boolean(businessSocialReferenceCiphertext),
    }),
  ).run();

  const saved = await loadSettings(env, auth.user.organizationId);
  if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "The payroll settings could not be loaded.");
  return toSettings(saved);
}
