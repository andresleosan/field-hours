import { createPasswordRecord, randomToken, sha256Hex, timingSafeHexEqual } from "./crypto";
import {
  ApiError,
  cookiesFrom,
  normalizeEmail,
  oauthStateCookie,
  clearOAuthStateCookie,
  requireString,
} from "./http";
import {
  createSession,
  getAuth,
  passwordPepper,
  requireReady,
  requireRole,
} from "./auth";
import type { AuthContext, SessionUser } from "./types";

type GoogleMode = "signin" | "link";

interface OAuthStateRow {
  stateHash: string;
  mode: GoogleMode;
  userId: string | null;
  expiresAt: string;
}

interface GoogleClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  aud: string;
  iss: string;
  exp: number;
}

interface GoogleAuthRequestRow {
  id: string;
  organizationId: string;
  requestType: "access" | "migration";
  email: string;
  displayName: string;
  googleSubject: string;
  existingUserId: string | null;
  requestedAt: string;
}

interface SessionRow {
  userId: string;
  email: string;
  displayName: string;
  role: "admin" | "worker";
  organizationId: string;
  organizationName: string;
  timezone: string;
  mustChangePassword: number;
}

interface GoogleJwks {
  keys: JsonWebKey[];
}

let cachedGoogleJwks: { value: GoogleJwks; expiresAt: number } | null = null;

function googleConfig(env: Env): { clientId: string; clientSecret: string; redirectUri: string; appOrigin: string } {
  const clientId = typeof env.GOOGLE_CLIENT_ID === "string" ? env.GOOGLE_CLIENT_ID.trim() : "";
  const clientSecret = typeof env.GOOGLE_CLIENT_SECRET === "string" ? env.GOOGLE_CLIENT_SECRET.trim() : "";
  const redirectUri = typeof env.GOOGLE_REDIRECT_URI === "string" ? env.GOOGLE_REDIRECT_URI.trim() : "";
  const appOrigin = typeof env.APP_ORIGIN === "string" ? env.APP_ORIGIN.trim().replace(/\/$/, "") : "";
  if (!clientId || !clientSecret || !redirectUri || !/^https:\/\//.test(redirectUri) || !/^https:\/\//.test(appOrigin)) {
    throw new ApiError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "Google sign-in is not configured yet.");
  }
  return { clientId, clientSecret, redirectUri, appOrigin };
}

function appRedirect(env: Env, status: "success" | "pending" | "error", code?: string): string {
  const { appOrigin } = googleConfig(env);
  const params = new URLSearchParams({ google: status });
  if (code) params.set("code", code);
  return `${appOrigin}/?${params.toString()}`;
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    throw new ApiError(502, "GOOGLE_RESPONSE_INVALID", "Google returned an invalid identity response.");
  }
}

async function fetchGoogleJwks(): Promise<GoogleJwks> {
  if (cachedGoogleJwks && cachedGoogleJwks.expiresAt > Date.now()) return cachedGoogleJwks.value;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new ApiError(502, "GOOGLE_UNAVAILABLE", "Google could not verify the sign-in right now.");
  const value = await response.json() as GoogleJwks;
  if (!Array.isArray(value.keys) || value.keys.length === 0) {
    throw new ApiError(502, "GOOGLE_RESPONSE_INVALID", "Google returned no verification keys.");
  }
  cachedGoogleJwks = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
  return value;
}

async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new ApiError(401, "GOOGLE_IDENTITY_INVALID", "Google identity could not be verified.");
  const encodedHeader = parts[0];
  const encodedClaims = parts[1];
  const encodedSignature = parts[2];
  if (!encodedHeader || !encodedClaims || !encodedSignature) {
    throw new ApiError(401, "GOOGLE_IDENTITY_INVALID", "Google identity could not be verified.");
  }
  const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader);
  const claims = decodeJson<GoogleClaims>(encodedClaims);
  if (header.alg !== "RS256" || !header.kid || claims.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) {
    throw new ApiError(401, "GOOGLE_IDENTITY_INVALID", "Google identity could not be verified.");
  }
  if (claims.email_verified !== true || typeof claims.sub !== "string" || !claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "GOOGLE_EMAIL_UNVERIFIED", "The Google account email must be verified.");
  }
  const key = (await fetchGoogleJwks()).keys.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!key) throw new ApiError(401, "GOOGLE_KEY_UNKNOWN", "Google identity could not be verified.");
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
  );
  if (!valid) throw new ApiError(401, "GOOGLE_IDENTITY_INVALID", "Google identity could not be verified.");
  return claims;
}

async function exchangeCode(env: Env, code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = googleConfig(env);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(502, "GOOGLE_TOKEN_EXCHANGE_FAILED", "Google could not complete the sign-in.");
  const payload = await response.json() as { id_token?: unknown };
  if (typeof payload.id_token !== "string") throw new ApiError(502, "GOOGLE_RESPONSE_INVALID", "Google returned no identity token.");
  return payload.id_token;
}

export async function startGoogleAuth(env: Env, request: Request, modeValue: string | null): Promise<{ location: string; cookies: string[] }> {
  const { clientId, redirectUri } = googleConfig(env);
  if (modeValue !== null && modeValue !== "signin" && modeValue !== "link") {
    throw new ApiError(400, "INVALID_INPUT", "The Google sign-in mode is invalid.");
  }
  const mode: GoogleMode = modeValue === "link" ? "link" : "signin";
  let userId: string | null = null;
  if (mode === "link") {
    const auth = await getAuth(request, env);
    requireReady(auth);
    userId = auth.user.id;
  }
  const now = new Date();
  const clientKey = mode === "link"
    ? `user:${userId}`
    : `ip:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`;
  const clientKeyHash = await sha256Hex(`google-oauth:${clientKey}`);
  await env.DB.prepare(
    "DELETE FROM workforce_oauth_states WHERE expires_at <= ?1 OR (consumed_at IS NOT NULL AND created_at <= ?1)",
  ).bind(now.toISOString()).run();
  const activeStates = await env.DB.prepare(
    "SELECT count(*) AS count FROM workforce_oauth_states WHERE client_key_hash = ?1 AND expires_at > ?2 AND consumed_at IS NULL",
  ).bind(clientKeyHash, now.toISOString()).first<number>("count");
  if ((activeStates ?? 0) >= 10) {
    throw new ApiError(429, "RATE_LIMITED", "Too many Google sign-in attempts. Try again later.");
  }
  const state = randomToken(32);
  await env.DB.prepare(
    `INSERT INTO workforce_oauth_states (state_hash, mode, user_id, client_key_hash, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(await sha256Hex(state), mode, userId, clientKeyHash, new Date(now.getTime() + 10 * 60 * 1000).toISOString()).run();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return {
    location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    cookies: [oauthStateCookie(state)],
  };
}

async function loadSessionUser(env: Env, userId: string): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    `SELECT u.id AS userId, u.email, u.must_change_password AS mustChangePassword,
            m.organization_id AS organizationId, m.display_name AS displayName, m.role,
            o.name AS organizationName, o.timezone
     FROM workforce_users u
     JOIN workforce_memberships m ON m.user_id = u.id
     JOIN workforce_organizations o ON o.id = m.organization_id
     WHERE u.id = ?1 AND u.disabled_at IS NULL LIMIT 1`,
  ).bind(userId).first<SessionRow>();
  if (!row) return null;
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

async function createPendingRequest(
  env: Env,
  input: { organizationId: string; requestType: "access" | "migration"; email: string; displayName: string; googleSubject: string; existingUserId: string | null },
): Promise<void> {
  const existing = await env.DB.prepare(
    `SELECT id FROM workforce_auth_requests
     WHERE email = ?1 AND request_type = ?2 AND status = 'pending' LIMIT 1`,
  ).bind(input.email, input.requestType).first<{ id: string }>();
  if (existing) {
    await env.DB.prepare(
      `UPDATE workforce_auth_requests
       SET google_subject = ?1, display_name = ?2, existing_user_id = ?3, requested_at = ?4
       WHERE id = ?5`,
    ).bind(input.googleSubject, input.displayName, input.existingUserId, new Date().toISOString(), existing.id).run();
    return;
  }
  await env.DB.prepare(
    `INSERT INTO workforce_auth_requests
     (id, organization_id, request_type, email, display_name, google_subject, existing_user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(crypto.randomUUID(), input.organizationId, input.requestType, input.email, input.displayName, input.googleSubject, input.existingUserId).run();
}

async function organizationIdForNewRequest(env: Env): Promise<string> {
  const row = await env.DB.prepare("SELECT id FROM workforce_organizations ORDER BY created_at ASC LIMIT 1").first<{ id: string }>();
  if (!row) throw new ApiError(503, "ORGANIZATION_MISSING", "The team is not configured yet.");
  return row.id;
}

export async function googleCallback(env: Env, request: Request): Promise<{ location: string; cookies: string[] }> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const stateCookie = cookiesFrom(request).get("fh_google_state") ?? "";
  const stateHash = await sha256Hex(state);
  const cookieHash = await sha256Hex(stateCookie);
  const clearState = [clearOAuthStateCookie()];
  if (!state || !stateCookie || !timingSafeHexEqual(stateHash, cookieHash)) {
    return { location: appRedirect(env, "error", "oauth_state"), cookies: clearState };
  }
  const row = await env.DB.prepare(
    `SELECT state_hash AS stateHash, mode, user_id AS userId, expires_at AS expiresAt
     FROM workforce_oauth_states WHERE state_hash = ?1 AND consumed_at IS NULL LIMIT 1`,
  ).bind(stateHash).first<OAuthStateRow>();
  if (!row || row.expiresAt <= new Date().toISOString()) {
    return { location: appRedirect(env, "error", "oauth_expired"), cookies: clearState };
  }
  const consumed = await env.DB.prepare(
    `UPDATE workforce_oauth_states SET consumed_at = ?1
     WHERE state_hash = ?2 AND consumed_at IS NULL`,
  ).bind(new Date().toISOString(), stateHash).run();
  if (Number(consumed.meta.changes ?? 0) !== 1) {
    return { location: appRedirect(env, "error", "oauth_replayed"), cookies: clearState };
  }
  if (url.searchParams.get("error")) {
    return { location: appRedirect(env, "error", "oauth_denied"), cookies: clearState };
  }
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096) return { location: appRedirect(env, "error", "oauth_code"), cookies: clearState };

  try {
    const { clientId } = googleConfig(env);
    const claims = await verifyGoogleIdToken(await exchangeCode(env, code), clientId);
    const email = normalizeEmail(claims.email);
    const displayName = typeof claims.name === "string" && claims.name.trim().length > 0
      ? claims.name.trim().slice(0, 120)
      : (email.split("@")[0] ?? "user").slice(0, 120);

    const identity = await env.DB.prepare(
      "SELECT user_id AS userId FROM workforce_google_identities WHERE google_subject = ?1 LIMIT 1",
    ).bind(claims.sub).first<{ userId: string }>();
    if (row.mode === "link") {
      const currentAuth = await getAuth(request, env);
      if (currentAuth.user.id !== row.userId) {
        throw new ApiError(401, "UNAUTHENTICATED", "Sign in again before linking Google.");
      }
    }
    if (identity) {
      if (row.mode === "link" && row.userId !== identity.userId) {
        throw new ApiError(409, "GOOGLE_ALREADY_LINKED", "This Google account is already linked to another user.");
      }
      const user = await loadSessionUser(env, identity.userId);
      if (!user) throw new ApiError(403, "ACCOUNT_DISABLED", "This account is not available.");
      const session = await createSession(env, user);
      return { location: appRedirect(env, "success"), cookies: [...session.cookies, ...clearState] };
    }

    let organizationId = await organizationIdForNewRequest(env);
    let existingUserId: string | null = null;
    if (row.mode === "link") {
      if (!row.userId) throw new ApiError(401, "UNAUTHENTICATED", "Sign in again before linking Google.");
      const current = await env.DB.prepare(
        `SELECT u.email, m.organization_id AS organizationId
         FROM workforce_users u JOIN workforce_memberships m ON m.user_id = u.id
         WHERE u.id = ?1 AND u.disabled_at IS NULL LIMIT 1`,
      ).bind(row.userId).first<{ email: string; organizationId: string }>();
      if (!current || current.email !== email) throw new ApiError(409, "GOOGLE_EMAIL_MISMATCH", "Use the same email as your Field Hours account.");
      existingUserId = row.userId;
      organizationId = current.organizationId;
    } else {
      const current = await env.DB.prepare(
        `SELECT u.id AS userId, m.organization_id AS organizationId
         FROM workforce_users u JOIN workforce_memberships m ON m.user_id = u.id
         WHERE u.email = ?1 AND u.disabled_at IS NULL LIMIT 1`,
      ).bind(email).first<{ userId: string; organizationId: string }>();
      if (current) {
        existingUserId = current.userId;
        organizationId = current.organizationId;
      }
    }

    await createPendingRequest(env, {
      organizationId,
      requestType: existingUserId ? "migration" : "access",
      email,
      displayName,
      googleSubject: claims.sub,
      existingUserId,
    });
    return { location: appRedirect(env, "pending"), cookies: clearState };
  } catch (error) {
    if (error instanceof ApiError) return { location: appRedirect(env, "error", error.code.toLowerCase()), cookies: clearState };
    return { location: appRedirect(env, "error", "google_unavailable"), cookies: clearState };
  }
}

export async function listGoogleAuthRequests(env: Env, auth: AuthContext): Promise<Omit<GoogleAuthRequestRow, "googleSubject">[]> {
  requireRole(auth, "admin");
  const result = await env.DB.prepare(
    `SELECT id, organization_id AS organizationId, request_type AS requestType,
            email, display_name AS displayName, google_subject AS googleSubject,
            existing_user_id AS existingUserId, requested_at AS requestedAt
     FROM workforce_auth_requests
     WHERE organization_id = ?1 AND status = 'pending'
     ORDER BY requested_at ASC LIMIT 100`,
  ).bind(auth.user.organizationId).all<GoogleAuthRequestRow>();
  return result.results.map(({ googleSubject: _googleSubject, ...request }) => request);
}

export async function reviewGoogleAuthRequest(
  env: Env,
  auth: AuthContext,
  requestIdValue: string,
  body: { decision?: unknown; reason?: unknown },
): Promise<{ ok: true }> {
  requireRole(auth, "admin");
  const requestId = requireString(requestIdValue, "Request", 36, 36);
  const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;
  if (!decision) throw new ApiError(400, "INVALID_INPUT", "Choose approve or reject.");
  const pending = await env.DB.prepare(
    `SELECT id, organization_id AS organizationId, request_type AS requestType,
            email, display_name AS displayName, google_subject AS googleSubject,
            existing_user_id AS existingUserId
     FROM workforce_auth_requests
     WHERE id = ?1 AND organization_id = ?2 AND status = 'pending' LIMIT 1`,
  ).bind(requestId, auth.user.organizationId).first<GoogleAuthRequestRow>();
  if (!pending) throw new ApiError(404, "REQUEST_NOT_FOUND", "This Google request is no longer pending.");

  const now = new Date().toISOString();
  if (decision === "reject") {
    const reason = typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : "Rejected by administrator";
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE workforce_auth_requests SET status = 'rejected', rejection_reason = ?1, reviewed_at = ?2, reviewed_by = ?3 WHERE id = ?4 AND status = 'pending'`,
      ).bind(reason, now, auth.user.id, requestId),
      env.DB.prepare(
        `INSERT INTO workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata_json) VALUES (?1, ?2, 'account.google_request.rejected', ?3, ?4)`,
      ).bind(auth.user.organizationId, auth.user.id, requestId, JSON.stringify({ email: pending.email })),
    ]);
    return { ok: true };
  }

  if (pending.existingUserId) {
    const existing = await env.DB.prepare(
      "SELECT id, email FROM workforce_users WHERE id = ?1 AND disabled_at IS NULL LIMIT 1",
    ).bind(pending.existingUserId).first<{ id: string; email: string }>();
    if (!existing || existing.email !== pending.email) throw new ApiError(409, "ACCOUNT_NOT_AVAILABLE", "The requested account is not available.");
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO workforce_google_identities (user_id, google_subject, google_email) VALUES (?1, ?2, ?3)`,
      ).bind(existing.id, pending.googleSubject, pending.email),
      env.DB.prepare(
        `UPDATE workforce_auth_requests SET status = 'approved', reviewed_at = ?1, reviewed_by = ?2 WHERE id = ?3 AND status = 'pending'`,
      ).bind(now, auth.user.id, requestId),
      env.DB.prepare(
        `INSERT INTO workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata_json) VALUES (?1, ?2, 'account.google_request.approved', ?3, ?4)`,
      ).bind(auth.user.organizationId, auth.user.id, existing.id, JSON.stringify({ email: pending.email, requestId })),
    ]);
    return { ok: true };
  }

  const userId = crypto.randomUUID();
  const passwordRecord = await createPasswordRecord(randomToken(32), passwordPepper(env));
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations, must_change_password) VALUES (?1, ?2, ?3, ?4, ?5, 0)`,
    ).bind(userId, pending.email, passwordRecord.salt, passwordRecord.hash, passwordRecord.iterations),
    env.DB.prepare(
      `INSERT INTO workforce_memberships (organization_id, user_id, role, display_name) VALUES (?1, ?2, 'worker', ?3)`,
    ).bind(auth.user.organizationId, userId, pending.displayName),
    env.DB.prepare(
      `INSERT INTO workforce_google_identities (user_id, google_subject, google_email) VALUES (?1, ?2, ?3)`,
    ).bind(userId, pending.googleSubject, pending.email),
    env.DB.prepare(
      `UPDATE workforce_auth_requests SET status = 'approved', existing_user_id = ?1, reviewed_at = ?2, reviewed_by = ?3 WHERE id = ?4 AND status = 'pending'`,
    ).bind(userId, now, auth.user.id, requestId),
    env.DB.prepare(
      `INSERT INTO workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata_json) VALUES (?1, ?2, 'account.google_request.approved', ?3, ?4)`,
    ).bind(auth.user.organizationId, auth.user.id, userId, JSON.stringify({ email: pending.email, requestId, requestType: "access" })),
  ]);
  return { ok: true };
}
