import { sha256Hex } from "./crypto";
import { ApiError } from "./http";
import type { AuthContext } from "./types";

export type PayrollRateLimitOperation = "profile_reveal" | "payslip_generate";

interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
  envLimitKey: string;
  envWindowKey: string;
  message: string;
}

interface RateLimitRow {
  attemptCount: number;
  windowStartedAt: string;
}

const DEFAULT_POLICIES: Record<PayrollRateLimitOperation, RateLimitPolicy> = {
  profile_reveal: {
    limit: 10,
    windowSeconds: 900,
    envLimitKey: "PAYROLL_PROFILE_REVEAL_LIMIT",
    envWindowKey: "PAYROLL_PROFILE_REVEAL_WINDOW_SECONDS",
    message: "Too many payroll profile reveals. Try again later.",
  },
  payslip_generate: {
    limit: 30,
    windowSeconds: 900,
    envLimitKey: "PAYROLL_PAYSLIP_LIMIT",
    envWindowKey: "PAYROLL_PAYSLIP_WINDOW_SECONDS",
    message: "Too many Salary Advice preparations. Try again later.",
  },
};

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function policyFor(env: Env, operation: PayrollRateLimitOperation): RateLimitPolicy {
  const defaults = DEFAULT_POLICIES[operation];
  const dynamicEnv = env as Env & Record<string, unknown>;
  return {
    ...defaults,
    limit: boundedInteger(dynamicEnv[defaults.envLimitKey], defaults.limit, 1, 1_000),
    windowSeconds: boundedInteger(dynamicEnv[defaults.envWindowKey], defaults.windowSeconds, 60, 86_400),
  };
}

/**
 * Counts sensitive payroll operations per organization/admin pair in the
 * existing D1 auth-attempts table. Only a keyed hash is persisted; references,
 * names and monetary values never enter the limiter record or its errors.
 */
export async function enforcePayrollRateLimit(
  env: Env,
  auth: AuthContext,
  operation: PayrollRateLimitOperation,
): Promise<void> {
  const policy = policyFor(env, operation);
  const now = new Date();
  const threshold = new Date(now.getTime() - policy.windowSeconds * 1000);
  const keyHash = await sha256Hex(`payroll-rate:${operation}:${auth.user.organizationId}:${auth.user.id}`);

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
  ).bind(keyHash, now.toISOString(), threshold.toISOString()).run();

  const row = await env.DB.prepare(
    `SELECT attempt_count AS attemptCount, window_started_at AS windowStartedAt
     FROM workforce_auth_attempts WHERE key_hash = ?1`,
  ).bind(keyHash).first<RateLimitRow>();

  if (
    row
    && row.attemptCount > policy.limit
    && new Date(row.windowStartedAt).getTime() > threshold.getTime()
  ) {
    throw new ApiError(429, "PAYROLL_RATE_LIMITED", policy.message, policy.windowSeconds);
  }
}
