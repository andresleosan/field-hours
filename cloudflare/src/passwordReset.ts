import { randomToken, sha256Hex } from "./crypto";
import {
  ApiError,
  normalizeEmail,
  requirePassword,
  requireString,
} from "./http";
import { requireRole } from "./auth";
import { createCurrentPasswordRecord } from "./passwords";
import type { AuthContext } from "./types";

interface PasswordResetRequestRow {
  id: string;
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  requestedAt: string;
}

const RESET_TTL_MS = 30 * 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function appOrigin(env: Env): string {
  const origin = typeof env.APP_ORIGIN === "string" ? env.APP_ORIGIN.trim().replace(/\/$/, "") : "";
  if (!/^https:\/\//.test(origin)) throw new ApiError(503, "RESET_NOT_CONFIGURED", "Password reset is not configured yet.");
  return origin;
}

export async function requestPasswordReset(
  env: Env,
  request: Request,
  body: { email?: unknown },
): Promise<{ ok: true }> {
  const email = normalizeEmail(body.email);
  const now = new Date();
  const clientKeyHash = await sha256Hex(`password-reset:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`);
  const attempt = await env.DB.prepare(
    `SELECT attempt_count AS attemptCount, window_started_at AS windowStartedAt
     FROM workforce_auth_attempts WHERE key_hash = ?1`,
  ).bind(clientKeyHash).first<{ attemptCount: number; windowStartedAt: string }>();
  if (
    attempt
    && attempt.attemptCount >= MAX_REQUESTS_PER_WINDOW
    && new Date(attempt.windowStartedAt).getTime() > now.getTime() - REQUEST_WINDOW_MS
  ) {
    throw new ApiError(429, "RATE_LIMITED", "Too many reset requests. Try again later.");
  }
  const threshold = new Date(now.getTime() - REQUEST_WINDOW_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO workforce_auth_attempts (key_hash, attempt_count, window_started_at)
     VALUES (?1, 1, ?2)
     ON CONFLICT(key_hash) DO UPDATE SET
       attempt_count = CASE
         WHEN workforce_auth_attempts.window_started_at < ?3 THEN 1
         ELSE workforce_auth_attempts.attempt_count + 1
       END,
       window_started_at = CASE
         WHEN workforce_auth_attempts.window_started_at < ?3 THEN excluded.window_started_at
         ELSE workforce_auth_attempts.window_started_at
       END`,
  ).bind(clientKeyHash, now.toISOString(), threshold).run();
  const user = await env.DB.prepare(
    `SELECT u.id AS userId, u.email, m.organization_id AS organizationId
     FROM workforce_users u
     JOIN workforce_memberships m ON m.user_id = u.id
     WHERE u.email = ?1 AND u.disabled_at IS NULL LIMIT 1`,
  ).bind(email).first<{ userId: string; email: string; organizationId: string }>();

  // Always return the same response so the endpoint cannot enumerate accounts.
  if (!user) return { ok: true };

  const active = await env.DB.prepare(
    `SELECT id, status FROM workforce_password_reset_requests
     WHERE user_id = ?1 AND status IN ('pending', 'issued') LIMIT 1`,
  ).bind(user.userId).first<{ id: string; status: "pending" | "issued" }>();
  if (active) {
    if (active.status === "pending") {
      await env.DB.prepare(
        "UPDATE workforce_password_reset_requests SET requested_at = ?1 WHERE id = ?2",
      ).bind(new Date().toISOString(), active.id).run();
    }
    return { ok: true };
  }

  await env.DB.prepare(
    `INSERT INTO workforce_password_reset_requests
     (id, organization_id, user_id, email)
     VALUES (?1, ?2, ?3, ?4)`,
  ).bind(crypto.randomUUID(), user.organizationId, user.userId, email).run();
  return { ok: true };
}

export async function listPasswordResetRequests(
  env: Env,
  auth: AuthContext,
): Promise<PasswordResetRequestRow[]> {
  requireRole(auth, "admin");
  const result = await env.DB.prepare(
    `SELECT r.id, r.user_id AS userId, r.organization_id AS organizationId,
            r.email, m.display_name AS displayName, r.requested_at AS requestedAt
     FROM workforce_password_reset_requests r
     JOIN workforce_memberships m ON m.user_id = r.user_id
     WHERE r.organization_id = ?1 AND r.status = 'pending'
     ORDER BY r.requested_at ASC LIMIT 100`,
  ).bind(auth.user.organizationId).all<PasswordResetRequestRow>();
  return result.results;
}

export async function issuePasswordReset(
  env: Env,
  auth: AuthContext,
  requestIdValue: string,
): Promise<{ resetUrl: string; expiresAt: string }> {
  requireRole(auth, "admin");
  const requestId = requireString(requestIdValue, "Request", 36, 36);
  const pending = await env.DB.prepare(
    `SELECT id, user_id AS userId, organization_id AS organizationId
     FROM workforce_password_reset_requests
     WHERE id = ?1 AND organization_id = ?2 AND status = 'pending' LIMIT 1`,
  ).bind(requestId, auth.user.organizationId).first<{ id: string; userId: string; organizationId: string }>();
  if (!pending) throw new ApiError(404, "RESET_REQUEST_NOT_FOUND", "The password reset request is no longer pending.");

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  const updated = await env.DB.prepare(
    `UPDATE workforce_password_reset_requests
     SET status = 'issued', token_hash = ?1, token_expires_at = ?2,
         reviewed_at = ?3, reviewed_by = ?4
     WHERE id = ?5 AND status = 'pending'`,
  ).bind(tokenHash, expiresAt, new Date().toISOString(), auth.user.id, requestId).run();
  if (Number(updated.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "RESET_REQUEST_REVIEWED", "The password reset request was already reviewed.");
  }
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
     (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'account.password.reset_issued', ?3, ?4)`,
  ).bind(pending.organizationId, auth.user.id, pending.userId, JSON.stringify({ expiresAt })).run();
  return { resetUrl: `${appOrigin(env)}/?reset=${encodeURIComponent(token)}`, expiresAt };
}

export async function rejectPasswordReset(
  env: Env,
  auth: AuthContext,
  requestIdValue: string,
  reasonValue?: unknown,
): Promise<{ ok: true }> {
  requireRole(auth, "admin");
  const requestId = requireString(requestIdValue, "Request", 36, 36);
  const pending = await env.DB.prepare(
    `SELECT id, user_id AS userId, organization_id AS organizationId
     FROM workforce_password_reset_requests
     WHERE id = ?1 AND organization_id = ?2 AND status = 'pending' LIMIT 1`,
  ).bind(requestId, auth.user.organizationId).first<{ id: string; userId: string; organizationId: string }>();
  if (!pending) throw new ApiError(404, "RESET_REQUEST_NOT_FOUND", "The password reset request is no longer pending.");
  const reason = typeof reasonValue === "string" ? reasonValue.trim().slice(0, 300) : "";
  const reviewedAt = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE workforce_password_reset_requests
     SET status = 'rejected', reviewed_at = ?1, reviewed_by = ?2
     WHERE id = ?3 AND organization_id = ?4 AND status = 'pending'`,
  ).bind(reviewedAt, auth.user.id, requestId, auth.user.organizationId).run();
  if (Number(updated.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "RESET_REQUEST_REVIEWED", "The password reset request was already reviewed.");
  }
  await env.DB.prepare(
    `INSERT INTO workforce_audit_events
     (organization_id, actor_user_id, action, subject_id, metadata_json)
     VALUES (?1, ?2, 'account.password.reset_rejected', ?3, ?4)`,
  ).bind(pending.organizationId, auth.user.id, pending.userId, JSON.stringify({ reason })).run();
  return { ok: true };
}

export async function completePasswordReset(
  env: Env,
  body: { token?: unknown; password?: unknown },
): Promise<{ ok: true }> {
  const token = requireString(body.token, "Reset token", 64, 64);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, "INVALID_RESET_TOKEN", "The password reset link is invalid or expired.");
  const password = requirePassword(body.password);
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const reset = await env.DB.prepare(
    `SELECT r.id, r.user_id AS userId, r.organization_id AS organizationId
     FROM workforce_password_reset_requests r
     JOIN workforce_users u ON u.id = r.user_id AND u.disabled_at IS NULL
     WHERE r.token_hash = ?1 AND r.status = 'issued' AND r.token_expires_at > ?2 LIMIT 1`,
  ).bind(tokenHash, now).first<{ id: string; userId: string; organizationId: string }>();
  if (!reset) throw new ApiError(400, "INVALID_RESET_TOKEN", "The password reset link is invalid or expired.");

  const record = await createCurrentPasswordRecord(env, password);

  const claimed = await env.DB.prepare(
    `UPDATE workforce_password_reset_requests
     SET status = 'consumed', consumed_at = ?1
     WHERE id = ?2 AND token_hash = ?3 AND status = 'issued' AND token_expires_at > ?1`,
  ).bind(now, reset.id, tokenHash).run();
  if (Number(claimed.meta.changes ?? 0) !== 1) {
    throw new ApiError(400, "INVALID_RESET_TOKEN", "The password reset link is invalid or expired.");
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE workforce_users
       SET password_salt = ?1, password_hash = ?2, password_iterations = ?3,
           must_change_password = 0
       WHERE id = ?4 AND disabled_at IS NULL`,
    ).bind(record.salt, record.hash, record.iterations, reset.userId),
    env.DB.prepare("DELETE FROM workforce_sessions WHERE user_id = ?1").bind(reset.userId),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
       VALUES (?1, ?2, 'account.password.reset', ?2, '{"mode":"self_service"}')`,
    ).bind(reset.organizationId, reset.userId),
  ]);
  return { ok: true };
}
