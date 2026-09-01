import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import { decryptPayrollValue, encryptPayrollValue } from "./payrollCrypto";
import type { AuthContext } from "./types";

export interface PayrollProfileSummary {
  userId: string;
  displayName: string;
  employeeNumber: string | null;
  hourlyRate: number | null;
  itisRate: number | null;
  isComplete: boolean;
  savedAt: string | null;
}

export interface WorkerPayrollProfile extends PayrollProfileSummary {
  legalName: string;
  address: string;
  hasTaxReference: boolean;
  hasSocialReference: boolean;
}

export interface PayrollProfileDetails extends PayrollProfileSummary {
  legalName: string;
  address: string;
  taxReference: string;
  socialReference: string;
}

export interface PayrollPayslipIdentity {
  displayName: string;
  legalName: string;
  address: string;
  employeeNumber: string;
  hourlyRatePence: number | null;
  itisRate: number | null;
  taxReference: string;
  socialReference: string;
}

interface ProfileRow {
  userId: string;
  organizationId: string;
  displayName: string;
  legalName: string | null;
  address: string | null;
  employeeNumber: string | null;
  hourlyRatePence: number | null;
  itisRateBps: number | null;
  taxReferenceCiphertext: string | null;
  socialReferenceCiphertext: string | null;
  savedAt: string | null;
}

type CompleteProfileRow = ProfileRow & {
  legalName: string;
  address: string;
  employeeNumber: string;
  hourlyRatePence: number | null;
  taxReferenceCiphertext: string;
  socialReferenceCiphertext: string;
  savedAt: string;
};

function optionalString(value: unknown, field: string, minimum: number, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, minimum, maximum);
}

function requireEmployeeNumber(value: unknown): string {
  const normalized = requireString(value, "Employee number", 1, 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(normalized)) {
    throw new ApiError(
      400,
      "INVALID_EMPLOYEE_NUMBER",
      "Employee number must start with a letter or digit and use only A-Z, 0-9, dot, underscore, slash or hyphen.",
    );
  }
  return normalized;
}

function toSummary(row: ProfileRow): PayrollProfileSummary {
  return {
    userId: row.userId,
    displayName: row.displayName,
    employeeNumber: row.employeeNumber,
    hourlyRate: row.hourlyRatePence == null ? null : Number((row.hourlyRatePence / 100).toFixed(2)),
    itisRate: row.itisRateBps == null ? null : Number((row.itisRateBps / 100).toFixed(2)),
    isComplete: profileExists(row),
    savedAt: row.savedAt,
  };
}

function toWorkerProfile(row: CompleteProfileRow): WorkerPayrollProfile {
  return {
    ...toSummary(row),
    legalName: row.legalName,
    address: row.address,
    hasTaxReference: Boolean(row.taxReferenceCiphertext),
    hasSocialReference: Boolean(row.socialReferenceCiphertext),
  };
}

async function loadProfile(env: Env, organizationId: string, userId: string): Promise<ProfileRow | null> {
  return env.DB.prepare(
    `SELECT
       m.user_id AS userId, m.organization_id AS organizationId, m.display_name AS displayName,
       p.legal_name AS legalName, p.address AS address,
       p.employee_number AS employeeNumber,
       p.hourly_rate_pence AS hourlyRatePence,
       p.itis_rate_bps AS itisRateBps,
       p.tax_reference_ciphertext AS taxReferenceCiphertext,
       p.social_reference_ciphertext AS socialReferenceCiphertext,
       p.saved_at AS savedAt
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id AND u.disabled_at IS NULL
     LEFT JOIN workforce_salary_advice_profiles p
       ON p.organization_id = m.organization_id AND p.user_id = m.user_id
     WHERE m.organization_id = ?1 AND m.user_id = ?2 AND m.role = 'worker'
     LIMIT 1`,
  ).bind(organizationId, userId).first<ProfileRow>();
}

function profileExists(row: ProfileRow | null): row is CompleteProfileRow {
  return Boolean(
    row?.legalName
    && row.address
    && row.employeeNumber
    && row.taxReferenceCiphertext
    && row.socialReferenceCiphertext
    && row.savedAt,
  );
}

export async function getWorkerPayrollProfile(env: Env, auth: AuthContext): Promise<WorkerPayrollProfile | null> {
  requireRole(auth, "worker");
  const row = await loadProfile(env, auth.user.organizationId, auth.user.id);
  return row && profileExists(row) ? toWorkerProfile(row) : null;
}

export async function saveWorkerPayrollProfile(
  env: Env,
  auth: AuthContext,
  body: {
    legalName?: unknown;
    address?: unknown;
    employeeNumber?: unknown;
    taxReference?: unknown;
    socialReference?: unknown;
    [key: string]: unknown;
  },
): Promise<WorkerPayrollProfile> {
  if (auth.user.role !== "worker") throw new ApiError(403, "FORBIDDEN", "Only workers can submit payroll details.");
  const supportedFields = new Set(["legalName", "address", "employeeNumber", "taxReference", "socialReference"]);
  const unsupportedFields = Object.keys(body).filter((key) => !supportedFields.has(key));
  if (unsupportedFields.length > 0) {
    throw new ApiError(400, "INVALID_INPUT", `Unsupported employee detail: ${unsupportedFields.join(", ")}.`);
  }
  const legalName = requireString(body.legalName, "Legal name", 2, 160);
  const address = requireString(body.address, "Address", 2, 250);
  const employeeNumber = requireEmployeeNumber(body.employeeNumber);
  const existing = await loadProfile(env, auth.user.organizationId, auth.user.id);

  const existingComplete = existing && profileExists(existing);
  const taxReference = optionalString(body.taxReference, "Tax Reference (ITIS)", 1, 80);
  const socialReference = optionalString(body.socialReference, "Social Security Number", 1, 80);

  if (!existingComplete && (!taxReference || !socialReference)) {
    throw new ApiError(400, "PROFILE_INCOMPLETE", "Tax Reference (ITIS) and Social Security Number are required.");
  }

  const [taxReferenceCiphertext, socialReferenceCiphertext] = await Promise.all([
    taxReference ? encryptPayrollValue(env, taxReference) : Promise.resolve(existing?.taxReferenceCiphertext ?? null),
    socialReference ? encryptPayrollValue(env, socialReference) : Promise.resolve(existing?.socialReferenceCiphertext ?? null),
  ]);

  const duplicateEmployeeNumber = await env.DB.prepare(
    `SELECT 1 AS found
     FROM workforce_salary_advice_profiles
     WHERE organization_id = ?1 AND employee_number = ?2 AND user_id <> ?3
     LIMIT 1`,
  ).bind(auth.user.organizationId, employeeNumber, auth.user.id).first<{ found: number }>();
  if (duplicateEmployeeNumber) {
    throw new ApiError(409, "EMPLOYEE_NUMBER_EXISTS", "That employee number is already in use.");
  }

  const now = new Date().toISOString();
  let write;
  try {
    write = await env.DB.prepare(
      `INSERT INTO workforce_salary_advice_profiles
       (organization_id, user_id, legal_name, address, employee_number,
        tax_reference_ciphertext, social_reference_ciphertext, saved_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET
       legal_name = excluded.legal_name, address = excluded.address,
       employee_number = excluded.employee_number,
       tax_reference_ciphertext = excluded.tax_reference_ciphertext,
       social_reference_ciphertext = excluded.social_reference_ciphertext,
       saved_at = excluded.saved_at`,
    ).bind(
      auth.user.organizationId,
      auth.user.id,
      legalName,
      address,
      employeeNumber,
      taxReferenceCiphertext,
      socialReferenceCiphertext,
      now,
    ).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("UNIQUE constraint failed")
      && message.includes("workforce_salary_advice_profiles")
      && message.includes("employee_number")
    ) {
      throw new ApiError(409, "EMPLOYEE_NUMBER_EXISTS", "That employee number is already in use.");
    }
    throw error;
  }
  if (!write.success || (write.meta?.changes ?? 0) !== 1) {
    throw new ApiError(409, "PROFILE_WRITE_CONFLICT", "Employee details could not be saved for this organization.");
  }

  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.profile.saved', ?2, ?3)`,
  ).bind(auth.user.organizationId, auth.user.id, JSON.stringify({ complete: true })).run();

  const saved = await loadProfile(env, auth.user.organizationId, auth.user.id);
  if (!saved || !profileExists(saved)) throw new ApiError(500, "INTERNAL_ERROR", "The payroll profile could not be loaded.");
  return toWorkerProfile(saved);
}

export async function listAdminPayrollProfiles(env: Env, auth: AuthContext): Promise<PayrollProfileSummary[]> {
  requireRole(auth, "admin");
  const rows = await env.DB.prepare(
    `SELECT
       m.user_id AS userId, m.organization_id AS organizationId, m.display_name AS displayName,
       p.legal_name AS legalName, p.address AS address,
       p.employee_number AS employeeNumber,
       p.hourly_rate_pence AS hourlyRatePence,
       p.itis_rate_bps AS itisRateBps,
       p.tax_reference_ciphertext AS taxReferenceCiphertext,
       p.social_reference_ciphertext AS socialReferenceCiphertext,
       p.saved_at AS savedAt
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id AND u.disabled_at IS NULL
     LEFT JOIN workforce_salary_advice_profiles p
       ON p.organization_id = m.organization_id AND p.user_id = m.user_id
     WHERE m.organization_id = ?1 AND m.role = 'worker'
     ORDER BY CASE WHEN p.saved_at IS NULL THEN 1 ELSE 0 END,
              m.display_name COLLATE NOCASE ASC`,
  ).bind(auth.user.organizationId).all<ProfileRow>();
  return rows.results.map(toSummary);
}

export async function revealAdminPayrollProfile(
  env: Env,
  auth: AuthContext,
  userId: string,
): Promise<PayrollProfileDetails> {
  requireRole(auth, "admin");
  const row = await loadProfile(env, auth.user.organizationId, userId);
  if (!row || !profileExists(row) || !row.taxReferenceCiphertext || !row.socialReferenceCiphertext) {
    throw new ApiError(404, "NOT_FOUND", "A complete payroll profile was not found.");
  }
  const [taxReference, socialReference] = await Promise.all([
    decryptPayrollValue(env, row.taxReferenceCiphertext),
    decryptPayrollValue(env, row.socialReferenceCiphertext),
  ]);
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.profile.viewed', ?3, '{}')`,
  ).bind(auth.user.organizationId, auth.user.id, userId).run();
  return {
    ...toSummary(row),
    legalName: row.legalName,
    address: row.address,
    taxReference,
    socialReference,
  };
}

function parseHourlyRatePence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.01 || value > 10_000) {
    throw new ApiError(400, "INVALID_INPUT", "Hourly rate must be between £0.01 and £10,000.");
  }
  const pence = Math.round(value * 100);
  if (Math.abs(value * 100 - pence) > 1e-7) {
    throw new ApiError(400, "INVALID_INPUT", "Hourly rate can have at most two decimal places.");
  }
  return pence;
}

function parseItisRateBps(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new ApiError(400, "INVALID_INPUT", "ITIS rate must be a whole percentage from the employee's current notice.");
  }
  return value * 100;
}

export async function saveAdminPayrollProfileCompensation(
  env: Env,
  auth: AuthContext,
  userId: string,
  body: { hourlyRate?: unknown; itisRate?: unknown; [key: string]: unknown },
): Promise<PayrollProfileSummary> {
  requireRole(auth, "admin");
  const unsupportedFields = Object.keys(body).filter((key) => key !== "hourlyRate" && key !== "itisRate");
  if (unsupportedFields.length > 0) {
    throw new ApiError(400, "INVALID_INPUT", `Unsupported employee compensation field: ${unsupportedFields.join(", ")}.`);
  }
  const normalizedUserId = requireString(userId, "Worker", 1, 120);
  const hourlyRatePence = parseHourlyRatePence(body.hourlyRate);
  const itisRateBps = parseItisRateBps(body.itisRate);
  const existing = await loadProfile(env, auth.user.organizationId, normalizedUserId);
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Payroll profile not found.");

  const updatedAt = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE workforce_salary_advice_profiles
     SET hourly_rate_pence = ?1, itis_rate_bps = ?2, saved_at = ?3
     WHERE organization_id = ?4 AND user_id = ?5`,
  ).bind(hourlyRatePence, itisRateBps, updatedAt, auth.user.organizationId, normalizedUserId).run();
  if (!result.success || (result.meta?.changes ?? 0) !== 1) {
    throw new ApiError(409, "PROFILE_WRITE_CONFLICT", "Employee compensation could not be saved.");
  }

  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.profile.compensation.updated', ?3, ?4)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    normalizedUserId,
    JSON.stringify({ hourlyRateUpdated: true, itisRateUpdated: true }),
  ).run();

  const saved = await loadProfile(env, auth.user.organizationId, normalizedUserId);
  if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "The employee compensation could not be loaded.");
  return toSummary(saved);
}

export async function getAdminPayrollPayslipIdentity(
  env: Env,
  auth: AuthContext,
  userId: string,
): Promise<PayrollPayslipIdentity> {
  requireRole(auth, "admin");
  const row = await loadProfile(env, auth.user.organizationId, userId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Payroll profile not found.");
  if (
    !profileExists(row)
    || !row.taxReferenceCiphertext
    || !row.socialReferenceCiphertext
    || row.hourlyRatePence === null
    || row.itisRateBps === null
  ) {
    throw new ApiError(
      409,
      "PAYROLL_PROFILE_INCOMPLETE",
      "The worker payroll identity, hourly rate or ITIS is incomplete.",
    );
  }
  const [taxReference, socialReference] = await Promise.all([
    decryptPayrollValue(env, row.taxReferenceCiphertext),
    decryptPayrollValue(env, row.socialReferenceCiphertext),
  ]);
  return {
    displayName: row.displayName,
    legalName: row.legalName,
    address: row.address,
    employeeNumber: row.employeeNumber,
    hourlyRatePence: row.hourlyRatePence,
    itisRate: Number((row.itisRateBps / 100).toFixed(2)),
    taxReference,
    socialReference,
  };
}
