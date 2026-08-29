import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const sourceDirectory = fileURLToPath(new URL("../src/", import.meta.url));
const bundle = await build({
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  write: false,
  stdin: {
    contents: [
      'export { createPasswordRecord } from "./crypto.ts";',
      'export { login } from "./auth.ts";',
      'export { createCurrentPasswordRecord, isCurrentPasswordHash, passwordPepperConfig, verifyStoredPassword } from "./passwords.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: sourceDirectory,
  },
});
const bundledSource = bundle.outputFiles[0]?.text;
if (!bundledSource) throw new Error("The password test bundle could not be built.");
const {
  createCurrentPasswordRecord,
  createPasswordRecord,
  isCurrentPasswordHash,
  login,
  passwordPepperConfig,
  verifyStoredPassword,
} = await import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`);

if (typeof crypto.subtle.timingSafeEqual !== "function") {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value(left, right) {
      if (left.byteLength !== right.byteLength) return false;
      const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
      const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
      let difference = 0;
      for (let index = 0; index < leftBytes.length; index += 1) {
        difference |= leftBytes[index] ^ rightBytes[index];
      }
      return difference === 0;
    },
  });
}

const CURRENT_PEPPER = "c".repeat(64);
const LEGACY_PEPPER = "l".repeat(64);
const PASSWORD = "A-safe-password-123!";

function envWithSecrets(overrides = {}) {
  return {
    PASSWORD_PEPPER_CURRENT: CURRENT_PEPPER,
    PASSWORD_PEPPER_LEGACY: LEGACY_PEPPER,
    ...overrides,
  };
}

test("fails closed when the current pepper is missing or malformed", async () => {
  assert.throws(
    () => passwordPepperConfig({ PASSWORD_PEPPER_LEGACY: LEGACY_PEPPER }),
    (error) => error?.status === 503 && error?.code === "AUTH_NOT_CONFIGURED",
  );
  assert.throws(
    () => passwordPepperConfig(envWithSecrets({ PASSWORD_PEPPER_CURRENT: "too-short" })),
    (error) => error?.status === 503 && error?.code === "AUTH_NOT_CONFIGURED",
  );
  assert.throws(
    () => passwordPepperConfig(envWithSecrets({ PASSWORD_PEPPER_CURRENT: LEGACY_PEPPER })),
    (error) => error?.status === 503 && error?.code === "AUTH_NOT_CONFIGURED",
  );
  await assert.rejects(
    () => createCurrentPasswordRecord({}, PASSWORD),
    (error) => error?.status === 503 && error?.code === "AUTH_NOT_CONFIGURED",
  );
});

test("creates and verifies only versioned hashes with the current pepper", async () => {
  const record = await createCurrentPasswordRecord(envWithSecrets(), PASSWORD);
  assert.equal(isCurrentPasswordHash(record.hash), true);
  assert.match(record.hash, /^v2\$[a-f0-9]{64}$/);

  assert.deepEqual(
    await verifyStoredPassword(
      PASSWORD,
      record.salt,
      record.hash,
      record.iterations,
      passwordPepperConfig(envWithSecrets()),
    ),
    { matches: true, needsUpgrade: false },
  );
  assert.deepEqual(
    await verifyStoredPassword(
      "wrong-password-123!",
      record.salt,
      record.hash,
      record.iterations,
      passwordPepperConfig(envWithSecrets()),
    ),
    { matches: false, needsUpgrade: false },
  );
});

test("accepts a legacy hash only with the temporary legacy secret", async () => {
  const legacy = await createPasswordRecord(PASSWORD, LEGACY_PEPPER);
  assert.deepEqual(
    await verifyStoredPassword(
      PASSWORD,
      legacy.salt,
      legacy.hash,
      legacy.iterations,
      passwordPepperConfig(envWithSecrets()),
    ),
    { matches: true, needsUpgrade: true },
  );

  const currentOnly = passwordPepperConfig(envWithSecrets({ PASSWORD_PEPPER_LEGACY: undefined }));
  assert.deepEqual(
    await verifyStoredPassword(PASSWORD, legacy.salt, legacy.hash, legacy.iterations, currentOnly),
    { matches: false, needsUpgrade: false },
  );
});

test("rejects unknown hash versions without exposing a parser error", async () => {
  assert.deepEqual(
    await verifyStoredPassword(
      PASSWORD,
      "0".repeat(32),
      `v3$${"0".repeat(64)}`,
      100_000,
      passwordPepperConfig(envWithSecrets()),
    ),
    { matches: false, needsUpgrade: false },
  );
});

function recordingDatabase(loginRow) {
  const batches = [];
  const runs = [];

  function prepared(query) {
    return {
      bind(...bindings) {
        return {
          query,
          bindings,
          async first() {
            if (query.includes("FROM workforce_auth_attempts")) return null;
            if (query.includes("FROM workforce_users u")) return loginRow;
            return null;
          },
          async run() {
            runs.push({ query, bindings });
            return { meta: { changes: 1 } };
          },
        };
      },
    };
  }

  return {
    database: {
      prepare: prepared,
      async batch(statements) {
        batches.push(statements.map(({ query, bindings }) => ({ query, bindings })));
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    },
    batches,
    runs,
  };
}

test("upgrades a valid legacy login before creating the session", async () => {
  const legacy = await createPasswordRecord(PASSWORD, LEGACY_PEPPER);
  const row = {
    userId: "user-admin",
    email: "admin@example.invalid",
    passwordSalt: legacy.salt,
    passwordHash: legacy.hash,
    passwordIterations: legacy.iterations,
    mustChangePassword: 0,
    organizationId: "org-1",
    organizationName: "Test Org",
    timezone: "UTC",
    role: "admin",
    displayName: "Test Admin",
  };
  const { database, batches, runs } = recordingDatabase(row);

  const result = await login(
    { ...envWithSecrets(), DB: database, SESSION_TTL_SECONDS: "3600" },
    { email: row.email, password: PASSWORD },
  );

  assert.equal(result.user.role, "admin");
  assert.equal(batches.length, 1);
  assert.match(batches[0][0].query, /account\.password\.pepper_upgraded/);
  assert.match(batches[0][1].query, /UPDATE workforce_users/);
  assert.match(batches[0][1].bindings[1], /^v2\$[a-f0-9]{64}$/);
  assert.equal(runs.some(({ query }) => query.includes("INSERT INTO workforce_sessions")), true);
});

test("does not upgrade a legacy hash when the password is invalid", async () => {
  const legacy = await createPasswordRecord(PASSWORD, LEGACY_PEPPER);
  const row = {
    userId: "user-worker",
    email: "worker@example.invalid",
    passwordSalt: legacy.salt,
    passwordHash: legacy.hash,
    passwordIterations: legacy.iterations,
    mustChangePassword: 0,
    organizationId: "org-1",
    organizationName: "Test Org",
    timezone: "UTC",
    role: "worker",
    displayName: "Test Worker",
  };
  const { database, batches, runs } = recordingDatabase(row);

  await assert.rejects(
    () => login(
      { ...envWithSecrets(), DB: database, SESSION_TTL_SECONDS: "3600" },
      { email: row.email, password: "wrong-password-123!" },
    ),
    (error) => error?.status === 401 && error?.code === "INVALID_CREDENTIALS",
  );

  assert.equal(batches.length, 0);
  assert.equal(runs.some(({ query }) => query.includes("workforce_auth_attempts")), true);
  assert.equal(runs.some(({ query }) => query.includes("INSERT INTO workforce_sessions")), false);
});

test("opens a current login without running the legacy upgrade batch", async () => {
  const current = await createCurrentPasswordRecord(envWithSecrets(), PASSWORD);
  const row = {
    userId: "user-current",
    email: "current@example.invalid",
    passwordSalt: current.salt,
    passwordHash: current.hash,
    passwordIterations: current.iterations,
    mustChangePassword: 0,
    organizationId: "org-1",
    organizationName: "Test Org",
    timezone: "UTC",
    role: "worker",
    displayName: "Current Worker",
  };
  const { database, batches, runs } = recordingDatabase(row);

  await login(
    { ...envWithSecrets(), DB: database, SESSION_TTL_SECONDS: "3600" },
    { email: row.email, password: PASSWORD },
  );

  assert.equal(batches.length, 0);
  assert.equal(runs.some(({ query }) => query.includes("INSERT INTO workforce_sessions")), true);
});
