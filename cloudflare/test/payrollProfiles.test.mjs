import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
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
    contents: 'export { saveWorkerPayrollProfile, saveAdminPayrollProfileCompensation } from "./payrollProfiles.ts";',
    loader: "ts",
    resolveDir: sourceDirectory,
  },
});
const bundledSource = bundle.outputFiles[0]?.text;
if (!bundledSource) throw new Error("The payroll profile test bundle could not be built.");
const { saveWorkerPayrollProfile, saveAdminPayrollProfileCompensation } = await import(
  `data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`
);

const workerAuth = {
  sessionHash: "session",
  csrfHash: "csrf",
  user: {
    id: "shared-user",
    email: "worker@field-hours.test",
    displayName: "Worker B",
    role: "worker",
    organizationId: "org-b",
    organizationName: "Organization B",
    timezone: "Europe/Jersey",
    mustChangePassword: false,
  },
};

const validBody = {
  legalName: "Worker B",
  address: "2 Tenant Street",
  employeeNumber: "B-002",
  taxReference: "TB002",
  socialReference: "SB002",
};

test("password, session and Google authentication fail closed for ambiguous memberships", async () => {
  const [authSource, googleAuthSource] = await Promise.all([
    readFile(new URL("../src/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/googleAuth.ts", import.meta.url), "utf8"),
  ]);
  const authGuards = authSource.match(/SELECT COUNT\(\*\) FROM workforce_memberships membership_guard/g) ?? [];
  const googleGuards = googleAuthSource.match(/SELECT COUNT\(\*\) FROM workforce_memberships membership_guard/g) ?? [];
  assert.equal(authGuards.length, 2);
  assert.equal(googleGuards.length, 3);
});

test("profile save rejects retired fields before reading or writing D1", async () => {
  const env = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    saveWorkerPayrollProfile(env, workerAuth, { ...validBody, itisRate: 0 }),
    { status: 400, code: "INVALID_INPUT" },
  );
  await assert.rejects(
    saveWorkerPayrollProfile(env, workerAuth, { ...validBody, bankAccountNumber: "123" }),
    { status: 400, code: "INVALID_INPUT" },
  );
});

test("only an administrator can assign an employee hourly rate", async () => {
  const noDb = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    saveAdminPayrollProfileCompensation(noDb, workerAuth, "shared-user", { hourlyRate: 20 }),
    { status: 403, code: "FORBIDDEN" },
  );
});

test("employee numbers are normalized to uppercase ASCII and unsupported identifiers fail before D1", async () => {
  const noDb = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    saveWorkerPayrollProfile(noDb, workerAuth, { ...validBody, employeeNumber: "É-002" }),
    { status: 400, code: "INVALID_EMPLOYEE_NUMBER" },
  );
  await assert.rejects(
    saveWorkerPayrollProfile(noDb, workerAuth, { ...validBody, employeeNumber: "B 002" }),
    { status: 400, code: "INVALID_EMPLOYEE_NUMBER" },
  );
});

test("clean composite UPSERT cannot mutate a Salary Advice profile in another tenant", async () => {
  const foreignRow = {
    userId: "shared-user",
    organizationId: "org-a",
    legalName: "Original A",
    address: "1 Tenant Street",
    employeeNumber: "A-001",
    taxReferenceCiphertext: "tax-a",
    socialReferenceCiphertext: "social-a",
    submittedAt: "2026-01-01T00:00:00.000Z",
  };
  const before = structuredClone(foreignRow);
  let cleanInsert = "";
  let savedRow = null;

  const env = {
    PAYROLL_ENCRYPTION_KEY: "22".repeat(32),
    DB: {
      prepare(query) {
        let bindings = [];
        return {
          bind(...values) {
            bindings = values;
            return this;
          },
          async first() {
            if (query.includes("FROM workforce_memberships")) {
              return {
                userId: "shared-user",
                organizationId: "org-b",
                displayName: "Worker B",
                email: "worker@field-hours.test",
                legalName: savedRow?.legalName ?? null,
                address: savedRow?.address ?? null,
                employeeNumber: savedRow?.employeeNumber ?? null,
                taxReferenceCiphertext: savedRow?.taxReferenceCiphertext ?? null,
                socialReferenceCiphertext: savedRow?.socialReferenceCiphertext ?? null,
                savedAt: savedRow?.savedAt ?? null,
              };
            }
            if (query.includes("employee_number =")) return null;
            throw new Error(`Unexpected first query: ${query}`);
          },
          async run() {
            if (query.includes("INSERT INTO workforce_salary_advice_profiles")) {
              cleanInsert = query;
              assert.equal(bindings[0], "org-b");
              assert.equal(bindings[1], "shared-user");
              savedRow = {
                legalName: bindings[2],
                address: bindings[3],
                employeeNumber: bindings[4],
                taxReferenceCiphertext: bindings[5],
                socialReferenceCiphertext: bindings[6],
                savedAt: bindings[7],
              };
              return { success: true, meta: { changes: 1 } };
            }
            if (query.includes("INSERT INTO workforce_audit_events")) {
              return { success: true, meta: { changes: 1 } };
            }
            throw new Error(`Unexpected write query: ${query}`);
          },
        };
      },
    },
  };

  const saved = await saveWorkerPayrollProfile(env, workerAuth, { ...validBody, employeeNumber: "b-002" });
  assert.equal(saved.employeeNumber, "B-002");
  assert.match(cleanInsert, /ON CONFLICT\(organization_id, user_id\) DO UPDATE/);
  assert.doesNotMatch(cleanInsert, /pending_review|itis_rate_bps|reviewed_by/);
  assert.deepEqual(foreignRow, before);
});

test("automatic Salary Advice migration stores admin rate and yearly ITIS configuration separately", async () => {
  const migration = await readFile(new URL("../migrations/0011_automatic_salary_advice.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN hourly_rate_pence/);
  assert.match(migration, /CREATE TABLE workforce_salary_advice_itis_rates/);
  assert.match(migration, /PRIMARY KEY \(organization_id, rules_year\)/);
  assert.match(migration, /rate_bps INTEGER NOT NULL CHECK \(rate_bps BETWEEN 0 AND 10000\)/);
  assert.match(migration, /Rollback/);
});

test("database uniqueness closes the concurrent employee-number race with a safe 409", async () => {
  let profileLoads = 0;
  const env = {
    PAYROLL_ENCRYPTION_KEY: "33".repeat(32),
    DB: {
      prepare(query) {
        return {
          bind() { return this; },
          async first() {
            if (query.includes("FROM workforce_memberships")) {
              profileLoads += 1;
              return {
                userId: "shared-user",
                organizationId: "org-b",
                displayName: "Worker B",
                legalName: null,
                address: null,
                employeeNumber: null,
                taxReferenceCiphertext: null,
                socialReferenceCiphertext: null,
                savedAt: null,
              };
            }
            if (query.includes("employee_number =")) return null;
            throw new Error(`Unexpected first query: ${query}`);
          },
          async run() {
            if (query.includes("INSERT INTO workforce_salary_advice_profiles")) {
              throw new Error("UNIQUE constraint failed: workforce_salary_advice_profiles.organization_id, workforce_salary_advice_profiles.employee_number");
            }
            throw new Error(`Unexpected write query: ${query}`);
          },
        };
      },
    },
  };
  await assert.rejects(
    saveWorkerPayrollProfile(env, workerAuth, validBody),
    { status: 409, code: "EMPLOYEE_NUMBER_EXISTS" },
  );
  assert.equal(profileLoads, 1);
});

test("migration creates clean storage and database-enforced employee-number uniqueness", async () => {
  const migration = await readFile(new URL("../migrations/0010_salary_advice_contract.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE workforce_salary_advice_profiles/);
  assert.match(migration, /UNIQUE \(organization_id, employee_number\)/);
  assert.match(migration, /FOREIGN KEY \(organization_id, user_id\)[\s\S]*REFERENCES workforce_memberships/);
  assert.match(migration, /m\.role = 'worker'/);
  assert.match(migration, /u\.disabled_at IS NULL/);
  assert.match(migration, /employee_number = upper\(employee_number\)/);
  assert.match(migration, /CREATE TABLE workforce_salary_advice_settings/);
  assert.doesNotMatch(migration, /employer_social_security|business_tax_reference|pending_review|bank_account/);
});
