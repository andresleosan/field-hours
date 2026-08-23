import {
  createPasswordRecord,
  randomToken,
  sha256Hex,
  verifyPassword,
} from "./crypto";
import {
  ApiError,
  authCookies,
  clearAuthCookies,
  cookiesFrom,
  normalizeEmail,
  requirePassword,
  requireString,
  SESSION_COOKIE,
} from "./http";
import type { AuthContext, Role, SessionUser } from "./types";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const DUMMY_SALT = "00000000000000000000000000000000";
const DUMMY_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

interface AuthRow {
  sessionHash: string;
  csrfHash: string;
  userId: string;
  email: string;
  mustChangePassword: number;
  organizationId: string;
  organizationName: string;
  timezone: string;
  role: Role;
  displayName: string;
}

interface LoginRow {
  userId: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  passwordIterations: number;
  mustChangePassword: number;
  organizationId: string;
  organizationName: string;
  timezone: string;
  role: Role;
  displayName: string;
}

interface AttemptRow {
  attemptCount: number;
  windowStartedAt: string;
}

interface InvitationRow {
  id: string;
  organizationId: string;
}

function sessionTtl(env: Env): number {
  const parsed = Number(env.SESSION_TTL_SECONDS);
  return Number.isInteger(parsed) && parsed >= 900 && parsed <= 86_400 ? parsed : 43_200;
}

function invitationTtl(env: Env): number {
  const parsed = Number(env.INVITE_TTL_SECONDS);
  return Number.isInteger(parsed) && parsed >= 300 && parsed <= 86_400 ? parsed : 1_800;
}

export function passwordPepper(env: Env): string {
  const pepper = (env as Env & { PASSWORD_PEPPER?: unknown }).PASSWORD_PEPPER;
  if (typeof pepper === "string" && pepper.length >= 64 && pepper.length <= 256) {
    return pepper;
  }
  return "f4d8a1c9e3b750162a8c9e4b7d10f35a62e8b9c0d1e2f3a4b5c6d7e8f90123456789abcdef0123456789abcdef";
}

function toSessionUser(row: LoginRow | AuthRow): SessionUser {
  return {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    timezone: row.timezone,
    mustChangePassword: row.mustChangePassword === 1,
  };
}

export async function getAuth(request: Request, env: Env): Promise<AuthContext> {
  const token = cookiesFrom(request).get(SESSION_COOKIE) ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  const sessionHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT
       s.session_hash AS sessionHash,
       s.csrf_hash AS csrfHash,
       u.id AS userId,
       u.email AS email,
       u.must_change_password AS mustChangePassword,
       m.organization_id AS organizationId,
       o.name AS organizationName,
       o.timezone AS timezone,
       m.role AS role,
       m.display_name AS displayName
     FROM workforce_sessions s
     JOIN workforce_users u ON u.id = s.user_id
     JOIN workforce_memberships m ON m.user_id = u.id
     JOIN workforce_organizations o ON o.id = m.organization_id
     WHERE s.session_hash = ?1
       AND s.expires_at > ?2
       AND u.disabled_at IS NULL
     LIMIT 1`,
  ).bind(sessionHash, new Date().toISOString()).first<AuthRow>();
  if (!row) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return {
    sessionHash: row.sessionHash,
    csrfHash: row.csrfHash,
    user: toSessionUser(row),
  };
}

export async function createSession(
  env: Env,
  user: SessionUser,
): Promise<{ cookies: string[]; user: SessionUser }> {
  const sessionToken = randomToken(32);
  const csrfToken = randomToken(32);
  const [sessionHash, csrfHash] = await Promise.all([
    sha256Hex(sessionToken),
    sha256Hex(csrfToken),
  ]);
  const ttl = sessionTtl(env);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO workforce_sessions
       (session_hash, csrf_hash, user_id, expires_at, created_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
  ).bind(sessionHash, csrfHash, user.id, expiresAt, now.toISOString()).run();
  return { user, cookies: authCookies(sessionToken, csrfToken, ttl) };
}

async function recordFailedAttempt(env: Env, keyHash: string, now: Date): Promise<void> {
  const threshold = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();
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
  ).bind(keyHash, now.toISOString(), threshold).run();
}

async function assertNotRateLimited(env: Env, keyHash: string, now: Date): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT attempt_count AS attemptCount, window_started_at AS windowStartedAt
     FROM workforce_auth_attempts WHERE key_hash = ?1`,
  ).bind(keyHash).first<AttemptRow>();
  if (
    row
    && row.attemptCount >= MAX_LOGIN_ATTEMPTS
    && new Date(row.windowStartedAt).getTime() > now.getTime() - LOGIN_WINDOW_MS
  ) {
    throw new ApiError(429, "RATE_LIMITED", "Too many sign-in attempts. Try again later.");
  }
}

export async function login(
  env: Env,
  body: { email?: unknown; password?: unknown },
): Promise<{ cookies: string[]; user: SessionUser }> {
  const email = normalizeEmail(body.email);
  const password = requirePassword(body.password);
  const keyHash = await sha256Hex(`login:${email}`);
  const now = new Date();
  await assertNotRateLimited(env, keyHash, now);

  const row = await env.DB.prepare(
    `SELECT
       u.id AS userId,
       u.email AS email,
       u.password_salt AS passwordSalt,
       u.password_hash AS passwordHash,
       u.password_iterations AS passwordIterations,
       u.must_change_password AS mustChangePassword,
       m.organization_id AS organizationId,
       o.name AS organizationName,
       o.timezone AS timezone,
       m.role AS role,
       m.display_name AS displayName
     FROM workforce_users u
     JOIN workforce_memberships m ON m.user_id = u.id
     JOIN workforce_organizations o ON o.id = m.organization_id
     WHERE u.email = ?1 AND u.disabled_at IS NULL
     LIMIT 1`,
  ).bind(email).first<LoginRow>();

  const pepper = passwordPepper(env);
  const passwordMatches = row
    ? await verifyPassword(password, row.passwordSalt, row.passwordHash, row.passwordIterations, pepper)
    : await verifyPassword(password, DUMMY_SALT, DUMMY_HASH, 100_000, pepper);
  if (!row || !passwordMatches) {
    await recordFailedAttempt(env, keyHash, now);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  await env.DB.prepare("DELETE FROM workforce_auth_attempts WHERE key_hash = ?1").bind(keyHash).run();
  return createSession(env, toSessionUser(row));
}

export async function registerWorker(
  env: Env,
  body: {
    invitationToken?: unknown;
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
  },
): Promise<{ cookies: string[]; user: SessionUser }> {
  const invitationToken = requireString(body.invitationToken, "Invitation", 64, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(invitationToken)) {
    throw new ApiError(400, "INVALID_INVITATION", "The invitation is invalid or expired.");
  }
  const email = normalizeEmail(body.email);
  const password = requirePassword(body.password);
  const displayName = requireString(body.displayName, "Name", 2, 120);
  const tokenHash = await sha256Hex(invitationToken);
  const now = new Date().toISOString();

  const existing = await env.DB.prepare(
    "SELECT 1 AS found FROM workforce_users WHERE email = ?1 LIMIT 1",
  ).bind(email).first<{ found: number }>();
  if (existing) throw new ApiError(409, "ACCOUNT_EXISTS", "An account already uses this email.");

  const invitation = await env.DB.prepare(
    `SELECT id, organization_id AS organizationId
     FROM workforce_invitations
     WHERE token_hash = ?1 AND claimed_at IS NULL AND expires_at > ?2
     LIMIT 1`,
  ).bind(tokenHash, now).first<InvitationRow>();
  if (!invitation) {
    throw new ApiError(400, "INVALID_INVITATION", "The invitation is invalid or expired.");
  }

  const userId = crypto.randomUUID();
  const claim = await env.DB.prepare(
    `UPDATE workforce_invitations
     SET claimed_at = ?1, claimed_by = ?2
     WHERE id = ?3 AND claimed_at IS NULL AND expires_at > ?1`,
  ).bind(now, userId, invitation.id).run();
  if (Number(claim.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "INVITATION_CLAIMED", "The invitation has already been used.");
  }

  try {
    const passwordRecord = await createPasswordRecord(password, passwordPepper(env));
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO workforce_users
         (id, email, password_salt, password_hash, password_iterations, must_change_password)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)`,
      ).bind(userId, email, passwordRecord.salt, passwordRecord.hash, passwordRecord.iterations),
      env.DB.prepare(
        `INSERT INTO workforce_memberships
         (organization_id, user_id, role, display_name)
         VALUES (?1, ?2, 'worker', ?3)`,
      ).bind(invitation.organizationId, userId, displayName),
      env.DB.prepare(
        `INSERT INTO workforce_audit_events
         (organization_id, actor_user_id, action, subject_id, metadata_json)
         VALUES (?1, ?2, 'staff.invitation.claimed', ?3, '{}')`,
      ).bind(invitation.organizationId, userId, invitation.id),
    ]);
  } catch {
    await env.DB.prepare(
      `UPDATE workforce_invitations
       SET claimed_at = NULL, claimed_by = NULL
       WHERE id = ?1 AND claimed_by = ?2`,
    ).bind(invitation.id, userId).run();
    throw new ApiError(409, "REGISTRATION_FAILED", "The account could not be created.");
  }

  const organization = await env.DB.prepare(
    "SELECT name, timezone FROM workforce_organizations WHERE id = ?1",
  ).bind(invitation.organizationId).first<{ name: string; timezone: string }>();
  if (!organization) throw new ApiError(500, "ORGANIZATION_MISSING", "The team could not be loaded.");
  return createSession(env, {
    id: userId,
    email,
    displayName,
    role: "worker",
    organizationId: invitation.organizationId,
    organizationName: organization.name,
    timezone: organization.timezone,
    mustChangePassword: false,
  });
}

export async function logout(env: Env, auth: AuthContext): Promise<string[]> {
  await env.DB.prepare("DELETE FROM workforce_sessions WHERE session_hash = ?1")
    .bind(auth.sessionHash).run();
  return clearAuthCookies();
}

export function requireReady(auth: AuthContext): void {
  if (auth.user.mustChangePassword) {
    throw new ApiError(403, "MUST_CHANGE_PASSWORD", "Change the temporary password to continue.");
  }
}

export function requireRole(auth: AuthContext, role: Role): void {
  requireReady(auth);
  if (auth.user.role !== role) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}

export async function createInvitation(
  env: Env,
  auth: AuthContext,
): Promise<{ token: string; expiresAt: string }> {
  requireRole(auth, "admin");
  const now = new Date();
  const activeCount = await env.DB.prepare(
    `SELECT count(*) AS count FROM workforce_invitations
     WHERE organization_id = ?1 AND claimed_at IS NULL AND expires_at > ?2`,
  ).bind(auth.user.organizationId, now.toISOString()).first<number>("count");
  if ((activeCount ?? 0) >= 20) {
    throw new ApiError(429, "TOO_MANY_INVITATIONS", "Discard or use an active invitation before creating another.");
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const invitationId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + invitationTtl(env) * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO workforce_invitations
       (id, organization_id, token_hash, role, expires_at, created_by)
       VALUES (?1, ?2, ?3, 'worker', ?4, ?5)`,
    ).bind(invitationId, auth.user.organizationId, tokenHash, expiresAt, auth.user.id),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
       VALUES (?1, ?2, 'staff.invitation.created', ?3, '{}')`,
    ).bind(auth.user.organizationId, auth.user.id, invitationId),
  ]);
  return { token, expiresAt };
}

export async function changePassword(
  env: Env,
  auth: AuthContext,
  body: { password?: unknown },
): Promise<SessionUser> {
  const password = requirePassword(body.password);
  const record = await createPasswordRecord(password, passwordPepper(env));
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE workforce_users
       SET password_salt = ?1,
           password_hash = ?2,
           password_iterations = ?3,
           must_change_password = 0
       WHERE id = ?4`,
    ).bind(record.salt, record.hash, record.iterations, auth.user.id),
    env.DB.prepare(
      "DELETE FROM workforce_sessions WHERE user_id = ?1 AND session_hash <> ?2",
    ).bind(auth.user.id, auth.sessionHash),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events
       (organization_id, actor_user_id, action, subject_id, metadata_json)
       VALUES (?1, ?2, 'account.password.changed', ?2, '{}')`,
    ).bind(auth.user.organizationId, auth.user.id),
  ]);
  return { ...auth.user, mustChangePassword: false };
}
