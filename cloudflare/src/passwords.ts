import { createPasswordRecord, verifyPassword } from "./crypto";
import { ApiError } from "./http";

const CURRENT_HASH_PREFIX = "v2$";
const HEX_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const DUMMY_SALT = "00000000000000000000000000000000";
const DUMMY_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
const DUMMY_ITERATIONS = 100_000;

export interface PasswordPepperConfig {
  current: string;
  legacy?: string;
}

export interface PasswordVerification {
  matches: boolean;
  needsUpgrade: boolean;
}

function pepperSecret(env: Env, name: "PASSWORD_PEPPER_CURRENT" | "PASSWORD_PEPPER_LEGACY"): string | undefined {
  const value = (env as Env & Record<typeof name, unknown>)[name];
  if (value === undefined && name === "PASSWORD_PEPPER_LEGACY") return undefined;
  if (typeof value !== "string" || value.length < 64 || value.length > 256) {
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Password sign-in is temporarily unavailable.",
    );
  }
  return value;
}

export function passwordPepperConfig(env: Env): PasswordPepperConfig {
  const current = pepperSecret(env, "PASSWORD_PEPPER_CURRENT");
  if (!current) {
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Password sign-in is temporarily unavailable.",
    );
  }
  const legacy = pepperSecret(env, "PASSWORD_PEPPER_LEGACY");
  if (legacy === current) {
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Password sign-in is temporarily unavailable.",
    );
  }
  return legacy === undefined ? { current } : { current, legacy };
}

export function isCurrentPasswordHash(hash: string): boolean {
  return hash.startsWith(CURRENT_HASH_PREFIX)
    && HEX_HASH_PATTERN.test(hash.slice(CURRENT_HASH_PREFIX.length));
}

export async function createCurrentPasswordRecord(
  env: Env,
  password: string,
): Promise<{ salt: string; hash: string; iterations: number }> {
  const { current } = passwordPepperConfig(env);
  const record = await createPasswordRecord(password, current);
  return { ...record, hash: `${CURRENT_HASH_PREFIX}${record.hash}` };
}

async function consumeDummyVerification(password: string, currentPepper: string): Promise<void> {
  await verifyPassword(password, DUMMY_SALT, DUMMY_HASH, DUMMY_ITERATIONS, currentPepper);
}

export async function verifyStoredPassword(
  password: string,
  salt: string,
  storedHash: string,
  iterations: number,
  peppers: PasswordPepperConfig,
): Promise<PasswordVerification> {
  if (isCurrentPasswordHash(storedHash)) {
    return {
      matches: await verifyPassword(
        password,
        salt,
        storedHash.slice(CURRENT_HASH_PREFIX.length),
        iterations,
        peppers.current,
      ),
      needsUpgrade: false,
    };
  }

  if (HEX_HASH_PATTERN.test(storedHash) && peppers.legacy) {
    const matches = await verifyPassword(password, salt, storedHash, iterations, peppers.legacy);
    return { matches, needsUpgrade: matches };
  }

  await consumeDummyVerification(password, peppers.current);
  return { matches: false, needsUpgrade: false };
}

export async function verifyMissingUserPassword(
  password: string,
  peppers: PasswordPepperConfig,
): Promise<void> {
  await consumeDummyVerification(password, peppers.current);
}
