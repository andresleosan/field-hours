import { requireRole } from "./auth";
import { ApiError, requireString } from "./http";
import { decryptPayrollValue, encryptPayrollValue } from "./payrollCrypto";
import type { AuthContext } from "./types";

type PayrollStatus = "pending_review" | "approved" | "changes_requested";

export interface PayrollProfileSummary {
  userId: string;
  displayName: string;
  email: string;
  legalName: string | null;
  address: string | null;
  employeeNumber: string | null;
  maskedSocialSecurityNumber: string | null;
  maskedTaxReference: string | null;
  maskedSocialReference: string | null;
  maskedBankAccountNumber: string | null;
  itisRate: number | null;
  status: "not_started" | PayrollStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface WorkerPayrollProfile extends PayrollProfileSummary {
  hasSocialSecurityNumber: boolean;
  hasTaxReference: boolean;
  hasSocialReference: boolean;
  hasBankDetails: boolean;
}

export interface PayrollProfileDetails extends PayrollProfileSummary {
  taxReference: string;
  socialReference: string;
  bankAccountName: string | null;
  bankSortCode: string | null;
  bankAccountNumber: string | null;
}

export interface PayrollPayslipIdentity {
  legalName: string;
  address: string;
  employeeNumber: string;
  taxReference: string;
  socialReference: string;
}

interface ProfileRow {
  userId: string;
  organizationId: string;
  displayName: string;
  email: string;
  legalName: string | null;
  address: string | null;
  employeeNumber: string | null;
  socialSecurityCiphertext: string | null;
  taxReferenceCiphertext: string | null;
  socialReferenceCiphertext: string | null;
  bankAccountNameCiphertext: string | null;
  bankSortCodeCiphertext: string | null;
  bankAccountNumberCiphertext: string | null;
  itisRateBps: number | null;
  status: PayrollStatus | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

function itisRateFromBps(value: number | null): number | null {
  return value === null ? null : Number((value / 100).toFixed(2));
}

function parseItisRate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new ApiError(400, "INVALID_INPUT", "ITIS must be a percentage between 0 and 100.");
  }
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > Number.EPSILON) {
    throw new ApiError(400, "INVALID_INPUT", "ITIS can have at most two decimal places.");
  }
  return Math.round(rounded * 100);
}

function optionalString(value: unknown, field: string, minimum: number, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, minimum, maximum);
}

function toSummary(row: ProfileRow): PayrollProfileSummary {
  return {
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
    legalName: row.legalName,
    address: row.address,
    employeeNumber: row.employeeNumber,
    maskedSocialSecurityNumber: row.socialSecurityCiphertext ? "••••" : null,
    maskedTaxReference: row.taxReferenceCiphertext ? "••••" : null,
    maskedSocialReference: row.socialReferenceCiphertext ? "••••" : null,
    maskedBankAccountNumber: row.bankAccountNumberCiphertext ? "••••" : null,
    itisRate: itisRateFromBps(row.itisRateBps),
    status: row.status ?? "not_started",
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
  };
}

function toWorkerProfile(row: ProfileRow): WorkerPayrollProfile {
  return {
    ...toSummary(row),
    hasSocialSecurityNumber: Boolean(row.socialSecurityCiphertext),
    hasTaxReference: Boolean(row.taxReferenceCiphertext),
    hasSocialReference: Boolean(row.socialReferenceCiphertext),
    hasBankDetails: Boolean(row.bankAccountNameCiphertext || row.bankSortCodeCiphertext || row.bankAccountNumberCiphertext),
  };
}

async function loadProfile(env: Env, organizationId: string, userId: string): Promise<ProfileRow | null> {
  return env.DB.prepare(
    `SELECT
       m.user_id AS userId, m.organization_id AS organizationId, m.display_name AS displayName,
       u.email AS email, p.legal_name AS legalName, p.address AS address,
       p.employee_number AS employeeNumber, p.social_security_ciphertext AS socialSecurityCiphertext,
       p.tax_reference_ciphertext AS taxReferenceCiphertext,
       p.social_reference_ciphertext AS socialReferenceCiphertext,
       p.bank_account_name_ciphertext AS bankAccountNameCiphertext,
       p.bank_sort_code_ciphertext AS bankSortCodeCiphertext,
       p.bank_account_number_ciphertext AS bankAccountNumberCiphertext,
       p.itis_rate_bps AS itisRateBps, p.status AS status, p.submitted_at AS submittedAt,
       p.reviewed_at AS reviewedAt, p.review_note AS reviewNote
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id
     LEFT JOIN workforce_payroll_profiles p
       ON p.organization_id = m.organization_id AND p.user_id = m.user_id
     WHERE m.organization_id = ?1 AND m.user_id = ?2 AND m.role = 'worker'
     LIMIT 1`,
  ).bind(organizationId, userId).first<ProfileRow>();
}

function profileExists(row: ProfileRow | null): row is ProfileRow & {
  legalName: string;
  address: string;
  employeeNumber: string;
  itisRateBps: number;
  status: PayrollStatus;
  submittedAt: string;
} {
  return Boolean(row?.legalName && row.address && row.employeeNumber && row.itisRateBps !== null && row.status && row.submittedAt);
}

export async function getWorkerPayrollProfile(env: Env, auth: AuthContext): Promise<WorkerPayrollProfile | null> {
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
    socialSecurityNumber?: unknown;
    taxReference?: unknown;
    socialReference?: unknown;
    bankAccountName?: unknown;
    bankSortCode?: unknown;
    bankAccountNumber?: unknown;
    itisRate?: unknown;
  },
): Promise<WorkerPayrollProfile> {
  if (auth.user.role !== "worker") throw new ApiError(403, "FORBIDDEN", "Only workers can submit payroll details.");
  const existing = await loadProfile(env, auth.user.organizationId, auth.user.id);
  const legalName = requireString(body.legalName, "Legal name", 2, 160);
  const address = requireString(body.address, "Address", 2, 250);
  const employeeNumber = requireString(body.employeeNumber, "Employee number", 1, 40);
  const itisRateBps = parseItisRate(body.itisRate);

  const existingComplete = existing && profileExists(existing);
  const socialSecurityNumber = optionalString(body.socialSecurityNumber, "Social security number", 3, 80);
  const taxReference = optionalString(body.taxReference, "Tax Reference (ITIS)", 1, 80);
  const socialReference = optionalString(body.socialReference, "Social Security Number", 1, 80);
  const bankAccountName = optionalString(body.bankAccountName, "Bank account name", 1, 160);
  const bankSortCode = optionalString(body.bankSortCode, "Bank sort code", 1, 40);
  const bankAccountNumber = optionalString(body.bankAccountNumber, "Bank account number", 1, 80);

  if (!existingComplete && (!taxReference || !socialReference)) {
    throw new ApiError(400, "PROFILE_INCOMPLETE", "Tax Reference (ITIS) and Social Security Number are required.");
  }

  const [socialSecurityCiphertext, taxReferenceCiphertext, socialReferenceCiphertext, bankAccountNameCiphertext, bankSortCodeCiphertext, bankAccountNumberCiphertext] = await Promise.all([
    socialSecurityNumber ? encryptPayrollValue(env, socialSecurityNumber) : Promise.resolve(existing?.socialSecurityCiphertext ?? null),
    taxReference ? encryptPayrollValue(env, taxReference) : Promise.resolve(existing?.taxReferenceCiphertext ?? null),
    socialReference ? encryptPayrollValue(env, socialReference) : Promise.resolve(existing?.socialReferenceCiphertext ?? null),
    bankAccountName ? encryptPayrollValue(env, bankAccountName) : Promise.resolve(existing?.bankAccountNameCiphertext ?? null),
    bankSortCode ? encryptPayrollValue(env, bankSortCode) : Promise.resolve(existing?.bankSortCodeCiphertext ?? null),
    bankAccountNumber ? encryptPayrollValue(env, bankAccountNumber) : Promise.resolve(existing?.bankAccountNumberCiphertext ?? null),
  ]);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workforce_payroll_profiles
       (user_id, organization_id, legal_name, address, employee_number,
        social_security_ciphertext, tax_reference_ciphertext, social_reference_ciphertext,
        bank_account_name_ciphertext, bank_sort_code_ciphertext, bank_account_number_ciphertext,
        itis_rate_bps, status, submitted_at, reviewed_at, reviewed_by, review_note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending_review', ?13, NULL, NULL, NULL)
     ON CONFLICT(user_id) DO UPDATE SET
       legal_name = excluded.legal_name, address = excluded.address,
       employee_number = excluded.employee_number,
       social_security_ciphertext = excluded.social_security_ciphertext,
       tax_reference_ciphertext = excluded.tax_reference_ciphertext,
       social_reference_ciphertext = excluded.social_reference_ciphertext,
       bank_account_name_ciphertext = excluded.bank_account_name_ciphertext,
       bank_sort_code_ciphertext = excluded.bank_sort_code_ciphertext,
       bank_account_number_ciphertext = excluded.bank_account_number_ciphertext,
       itis_rate_bps = excluded.itis_rate_bps, status = 'pending_review',
       submitted_at = excluded.submitted_at, reviewed_at = NULL, reviewed_by = NULL, review_note = NULL`,
  ).bind(
    auth.user.id,
    auth.user.organizationId,
    legalName,
    address,
    employeeNumber,
    socialSecurityCiphertext,
    taxReferenceCiphertext,
    socialReferenceCiphertext,
    bankAccountNameCiphertext,
    bankSortCodeCiphertext,
    bankAccountNumberCiphertext,
    itisRateBps,
    now,
  ).run();

  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.profile.submitted', ?2, ?3)`,
  ).bind(auth.user.organizationId, auth.user.id, JSON.stringify({ itisRate: itisRateBps / 100 })).run();

  const saved = await loadProfile(env, auth.user.organizationId, auth.user.id);
  if (!saved || !profileExists(saved)) throw new ApiError(500, "INTERNAL_ERROR", "The payroll profile could not be loaded.");
  return toWorkerProfile(saved);
}

export async function listAdminPayrollProfiles(env: Env, auth: AuthContext): Promise<PayrollProfileSummary[]> {
  requireRole(auth, "admin");
  const rows = await env.DB.prepare(
    `SELECT
       m.user_id AS userId, m.organization_id AS organizationId, m.display_name AS displayName,
       u.email AS email, p.legal_name AS legalName, p.address AS address,
       p.employee_number AS employeeNumber, p.social_security_ciphertext AS socialSecurityCiphertext,
       p.tax_reference_ciphertext AS taxReferenceCiphertext,
       p.social_reference_ciphertext AS socialReferenceCiphertext,
       p.bank_account_name_ciphertext AS bankAccountNameCiphertext,
       p.bank_sort_code_ciphertext AS bankSortCodeCiphertext,
       p.bank_account_number_ciphertext AS bankAccountNumberCiphertext,
       p.itis_rate_bps AS itisRateBps, p.status AS status, p.submitted_at AS submittedAt,
       p.reviewed_at AS reviewedAt, p.review_note AS reviewNote
     FROM workforce_memberships m
     JOIN workforce_users u ON u.id = m.user_id
     LEFT JOIN workforce_payroll_profiles p
       ON p.organization_id = m.organization_id AND p.user_id = m.user_id
     WHERE m.organization_id = ?1 AND m.role = 'worker'
     ORDER BY CASE COALESCE(p.status, 'not_started') WHEN 'pending_review' THEN 0 WHEN 'changes_requested' THEN 1 ELSE 2 END,
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
  const [taxReference, socialReference, bankAccountName, bankSortCode, bankAccountNumber] = await Promise.all([
    decryptPayrollValue(env, row.taxReferenceCiphertext),
    decryptPayrollValue(env, row.socialReferenceCiphertext),
    row.bankAccountNameCiphertext ? decryptPayrollValue(env, row.bankAccountNameCiphertext) : Promise.resolve(null),
    row.bankSortCodeCiphertext ? decryptPayrollValue(env, row.bankSortCodeCiphertext) : Promise.resolve(null),
    row.bankAccountNumberCiphertext ? decryptPayrollValue(env, row.bankAccountNumberCiphertext) : Promise.resolve(null),
  ]);
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'payroll.profile.viewed', ?3, '{}')`,
  ).bind(auth.user.organizationId, auth.user.id, userId).run();
  return {
    ...toSummary(row),
    taxReference,
    socialReference,
    bankAccountName,
    bankSortCode,
    bankAccountNumber,
  };
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
  ) {
    throw new ApiError(
      409,
      "PAYROLL_PROFILE_INCOMPLETE",
      "The worker payroll identity is incomplete.",
    );
  }
  const [taxReference, socialReference] = await Promise.all([
    decryptPayrollValue(env, row.taxReferenceCiphertext),
    decryptPayrollValue(env, row.socialReferenceCiphertext),
  ]);
  return {
    legalName: row.legalName,
    address: row.address,
    employeeNumber: row.employeeNumber,
    taxReference,
    socialReference,
  };
}

export async function reviewAdminPayrollProfile(
  env: Env,
  auth: AuthContext,
  userId: string,
  decision: unknown,
  note: unknown,
): Promise<PayrollProfileSummary> {
  requireRole(auth, "admin");
  if (decision !== "approved" && decision !== "changes_requested") {
    throw new ApiError(400, "INVALID_INPUT", "The payroll review decision is invalid.");
  }
  const reviewNote = optionalString(note, "Review note", 1, 500);
  const row = await loadProfile(env, auth.user.organizationId, userId);
  if (!row || !profileExists(row)) throw new ApiError(404, "NOT_FOUND", "Payroll profile not found.");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE workforce_payroll_profiles
     SET status = ?1, reviewed_at = ?2, reviewed_by = ?3, review_note = ?4
     WHERE organization_id = ?5 AND user_id = ?6`,
  ).bind(decision, now, auth.user.id, reviewNote, auth.user.organizationId, userId).run();
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(
    auth.user.organizationId,
    auth.user.id,
    decision === "approved" ? "payroll.profile.approved" : "payroll.profile.changes_requested",
    userId,
    JSON.stringify({ note: reviewNote }),
  ).run();
  const updated = await loadProfile(env, auth.user.organizationId, userId);
  if (!updated || !profileExists(updated)) throw new ApiError(500, "INTERNAL_ERROR", "The payroll profile could not be loaded.");
  return toSummary(updated);
}
