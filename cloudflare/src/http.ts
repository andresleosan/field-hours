import { sha256Hex, timingSafeHexEqual } from "./crypto";
import type { AuthContext } from "./types";

const MAX_JSON_BYTES = 16 * 1024;
export const SESSION_COOKIE = "fh_session";
export const CSRF_COOKIE = "fh_csrf";
export const GOOGLE_STATE_COOKIE = "fh_google_state";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function responseHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.append("Vary", "Origin");
  }
  return headers;
}

export function json(
  request: Request,
  env: Env,
  value: unknown,
  status = 200,
  cookies: string[] = [],
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = responseHeaders(request, env);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
  return new Response(JSON.stringify(value), { status, headers });
}

export function optionsResponse(request: Request, env: Env): Response {
  assertAllowedOrigin(request, env);
  const headers = responseHeaders(request, env);
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean));
}

export function assertAllowedOrigin(request: Request, env: Env): void {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).has(origin)) {
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  if (!request.body) throw new ApiError(400, "INVALID_JSON", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

export function cookiesFrom(request: Request): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    result.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return result;
}

export function authCookies(
  sessionToken: string,
  csrfToken: string,
  maxAgeSeconds: number,
): string[] {
  const common = `Path=/; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  return [
    `${SESSION_COOKIE}=${sessionToken}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
    `${CSRF_COOKIE}=${csrfToken}; ${common}`,
  ];
}

export function clearAuthCookies(): string[] {
  return [
    `${SESSION_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${CSRF_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`,
  ];
}

export function oauthStateCookie(state: string): string {
  return `${GOOGLE_STATE_COOKIE}=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function clearOAuthStateCookie(): string {
  return `${GOOGLE_STATE_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function assertCsrf(request: Request, auth: AuthContext): Promise<void> {
  const cookieToken = cookiesFrom(request).get(CSRF_COOKIE) ?? "";
  const headerToken = request.headers.get("X-CSRF-Token") ?? "";
  if (!cookieToken || !headerToken || cookieToken.length > 128 || headerToken.length > 128) {
    throw new ApiError(403, "CSRF_FAILED", "The security token is missing or invalid.");
  }
  const [cookieHash, headerHash] = await Promise.all([
    sha256Hex(cookieToken),
    sha256Hex(headerToken),
  ]);
  if (
    !timingSafeHexEqual(cookieHash, auth.csrfHash)
    || !timingSafeHexEqual(headerHash, auth.csrfHash)
  ) {
    throw new ApiError(403, "CSRF_FAILED", "The security token is missing or invalid.");
  }
}

export function requireString(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "INVALID_INPUT", `${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new ApiError(400, "INVALID_INPUT", `${field} has an invalid length.`);
  }
  return normalized;
}

export function normalizeEmail(value: unknown): string {
  const email = requireString(value, "Email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "INVALID_INPUT", "Enter a valid email address.");
  }
  return email;
}

export function requirePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    throw new ApiError(400, "INVALID_PASSWORD", "Use a password between 12 and 128 characters.");
  }
  return value;
}
