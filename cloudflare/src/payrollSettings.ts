import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import type { AuthContext } from "./types";

export interface PayrollSettings {
  businessName: string;
  businessAddress: string;
  updatedAt: string;
}

export interface SalaryAdviceSettings {
  businessName: string;
  businessAddress: string;
}

interface PayrollSettingsRow {
  businessName: string;
  businessAddress: string;
  updatedAt: string;
}

function toSettings(row: PayrollSettingsRow): PayrollSettings {
  return {
    businessName: row.businessName,
    businessAddress: row.businessAddress,
    updatedAt: row.updatedAt,
  };
}

async function loadSettings(env: Env, organizationId: string): Promise<PayrollSettingsRow | null> {
  return env.DB.prepare(
    `SELECT
       business_name AS businessName,
       business_address AS businessAddress,
       updated_at AS updatedAt
      FROM workforce_salary_advice_settings
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
  return {
    businessName: row.businessName,
    businessAddress: row.businessAddress,
  };
}

export async function saveAdminPayrollSettings(
  env: Env,
  auth: AuthContext,
  body: {
    businessName?: unknown;
    businessAddress?: unknown;
    [key: string]: unknown;
  },
): Promise<PayrollSettings> {
  requireRole(auth, "admin");
  const allowedFields = new Set(["businessName", "businessAddress"]);
  const obsoleteFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (obsoleteFields.length > 0) {
    throw new ApiError(400, "INVALID_INPUT", `Unsupported business setting: ${obsoleteFields.join(", ")}.`);
  }

  const businessName = requireString(body.businessName, "Business name", 2, 160);
  const businessAddress = requireString(body.businessAddress, "Business address", 2, 250);
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
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'salary_advice.settings.updated', ?1, ?3)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    JSON.stringify({ documentIdentityUpdated: true }),
  ).run();

  const saved = await loadSettings(env, auth.user.organizationId);
  if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "The Salary Advice settings could not be loaded.");
  return toSettings(saved);
}
