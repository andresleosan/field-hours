import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import type { AuthContext } from "./types";

const RULES_YEAR = 2026;

export interface PayrollSettings {
  businessName: string;
  businessAddress: string;
  itisRate: number | null;
  itisRateYear: number;
  updatedAt: string;
}

export interface SalaryAdviceSettings {
  businessName: string;
  businessAddress: string;
  itisRate: number;
  itisRateYear: number;
}

interface PayrollSettingsRow {
  businessName: string;
  businessAddress: string;
  itisRateBps: number | null;
  updatedAt: string;
}

function toSettings(row: PayrollSettingsRow): PayrollSettings {
  return {
    businessName: row.businessName,
    businessAddress: row.businessAddress,
    itisRate: row.itisRateBps == null ? null : Number((row.itisRateBps / 100).toFixed(2)),
    itisRateYear: RULES_YEAR,
    updatedAt: row.updatedAt,
  };
}

async function loadSettings(env: Env, organizationId: string): Promise<PayrollSettingsRow | null> {
  return env.DB.prepare(
    `SELECT
       business_name AS businessName,
       business_address AS businessAddress,
       rates.rate_bps AS itisRateBps,
       updated_at AS updatedAt
     FROM workforce_salary_advice_settings
     LEFT JOIN workforce_salary_advice_itis_rates rates
       ON rates.organization_id = workforce_salary_advice_settings.organization_id
      AND rates.rules_year = ${RULES_YEAR}
     WHERE workforce_salary_advice_settings.organization_id = ?1
     LIMIT 1`,
  ).bind(organizationId).first<PayrollSettingsRow>();
}

export async function getAdminPayrollSettings(env: Env, auth: AuthContext): Promise<PayrollSettings | null> {
  requireRole(auth, "admin");
  const row = await loadSettings(env, auth.user.organizationId);
  return row ? toSettings(row) : null;
}

export async function getSalaryAdviceSettings(env: Env, organizationId: string): Promise<SalaryAdviceSettings> {
  const row = await loadSettings(env, organizationId);
  if (!row) {
    throw new ApiError(
      409,
      "SALARY_ADVICE_NOT_CONFIGURED",
      "Add the business identity before calculating a Salary Advice.",
    );
  }
  if (row.itisRateBps == null) {
    throw new ApiError(
      409,
      "SALARY_ADVICE_NOT_CONFIGURED",
      `Configure the ${RULES_YEAR} ITIS percentage before calculating a Salary Advice.`,
    );
  }
  return {
    businessName: row.businessName,
    businessAddress: row.businessAddress,
    itisRate: Number((row.itisRateBps / 100).toFixed(2)),
    itisRateYear: RULES_YEAR,
  };
}

export async function saveAdminPayrollSettings(
  env: Env,
  auth: AuthContext,
  body: {
    businessName?: unknown;
    businessAddress?: unknown;
    itisRate?: unknown;
    [key: string]: unknown;
  },
): Promise<PayrollSettings> {
  requireRole(auth, "admin");
  const allowedFields = new Set(["businessName", "businessAddress", "itisRate"]);
  const obsoleteFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (obsoleteFields.length > 0) {
    throw new ApiError(400, "INVALID_INPUT", `Unsupported business setting: ${obsoleteFields.join(", ")}.`);
  }

  const businessName = requireString(body.businessName, "Business name", 2, 160);
  const businessAddress = requireString(body.businessAddress, "Business address", 2, 250);
  if (
    typeof body.itisRate !== "number"
    || !Number.isFinite(body.itisRate)
    || !Number.isInteger(body.itisRate)
    || body.itisRate < 0
    || body.itisRate > 100
  ) {
    throw new ApiError(400, "INVALID_INPUT", "ITIS rate must be a whole percentage from 0 to 100.");
  }
  const itisRateBps = body.itisRate * 100;
  const updatedAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workforce_salary_advice_settings
       (organization_id, business_name, business_address, updated_at, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(organization_id) DO UPDATE SET
       business_name = excluded.business_name,
       business_address = excluded.business_address,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).bind(
    auth.user.organizationId,
    businessName,
    businessAddress,
    updatedAt,
    auth.user.id,
  ).run();

  await env.DB.prepare(
    `INSERT INTO workforce_salary_advice_itis_rates
       (organization_id, rules_year, rate_bps, updated_at, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(organization_id, rules_year) DO UPDATE SET
       rate_bps = excluded.rate_bps,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).bind(
    auth.user.organizationId,
    RULES_YEAR,
    itisRateBps,
    updatedAt,
    auth.user.id,
  ).run();

  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'salary_advice.settings.updated', ?1, ?3)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    JSON.stringify({ documentIdentityUpdated: true, itisRateYear: RULES_YEAR, itisRateUpdated: true }),
  ).run();

  const saved = await loadSettings(env, auth.user.organizationId);
  if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "The Salary Advice settings could not be loaded.");
  return toSettings(saved);
}
