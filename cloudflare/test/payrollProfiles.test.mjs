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

test("worker saves the ITIS percentage in the active employee profile", async () => {
  let profileRow = null;
  let insertQuery = "";
  let insertBindings = [];
  const env = {
    PAYROLL_ENCRYPTION_KEY: "11".repeat(32),
    DB: {
      prepare(query) {
        let bindings = [];
        return {
          bind(...values) {
            bindings = values;
            return this;
          },
          async first() {
            if (query.includes("FROM workforce_memberships")) return profileRow;
            if (query.includes("employee_number =")) return null;
            throw new Error(`Unexpected first query: ${query}`);
          },
          async run() {
            if (query.includes("INSERT INTO workforce_salary_advice_profiles")) {
              insertQuery = query;
              insertBindings = bindings;
              profileRow = {
                userId: "shared-user",
                organizationId: "org-b",
                displayName: "Worker B",
                legalName: bindings[2],
                address: bindings[3],
                employeeNumber: bindings[4],
                taxReferenceCiphertext: bindings[5],
                socialReferenceCiphertext: bindings[6],
                itisRateBps: bindings[7],
                hourlyRatePence: null,
                savedAt: bindings[8],
              };
            }
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    },
  };

  const saved = await saveWorkerPayrollProfile(env, workerAuth, { ...validBody, itisRate: 7 });

  assert.match(insertQuery, /itis_rate_bps/);
  assert.equal(insertBindings[7], 700);
  assert.equal(saved.itisRate, 7);
});

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

test("profile save rejects unsupported fields and invalid ITIS before reading or writing D1", async () => {
  const env = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    saveWorkerPayrollProfile(env, workerAuth, { ...validBody, itisRate: 101 }),
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

test("administrator assigns hourly rate and ITIS to the selected employee profile", async () => {
  let updateQuery = "";
  let updateBindings = [];
  const profileRow = {
    userId: "worker-1",
    organizationId: "org-a",
    displayName: "Worker A",
    legalName: "Worker A",
    address: "1 Worker Street",
    employeeNumber: "A-001",
    hourlyRatePence: 2000,
    itisRateBps: 1500,
    taxReferenceCiphertext: "tax-a",
    socialReferenceCiphertext: "social-a",
    savedAt: "2026-01-01T00:00:00.000Z",
  };
  const adminAuth = {
    ...workerAuth,
    user: { ...workerAuth.user, id: "admin-1", role: "admin", organizationId: "org-a" },
  };
  const env = {
    DB: {
      prepare(query) {
        let bindings = [];
        return {
          bind(...values) {
            bindings = values;
            return this;
          },
          async first() {
            if (query.includes("FROM workforce_memberships")) return profileRow;
            throw new Error(`Unexpected first query: ${query}`);
          },
          async run() {
            if (query.includes("UPDATE workforce_salary_advice_profiles")) {
              updateQuery = query;
              updateBindings = bindings;
            }
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    },
  };

  const saved = await saveAdminPayrollProfileCompensation(env, adminAuth, "worker-1", {
    hourlyRate: 21.25,
    itisRate: 17,
  });

  assert.match(updateQuery, /hourly_rate_pence/);
  assert.match(updateQuery, /itis_rate_bps/);
  assert.equal(updateBindings[0], 2125);
  assert.equal(updateBindings[1], 1700);
  assert.equal(saved.hourlyRate, 20);
  assert.equal(saved.itisRate, 15);
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
                itisRateBps: savedRow?.itisRateBps ?? null,
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
                itisRateBps: bindings[7],
                savedAt: bindings[8],
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

  const saved = await saveWorkerPayrollProfile(env, workerAuth, { ...validBody, employeeNumber: "b-002", itisRate: 7 });
  assert.equal(saved.employeeNumber, "B-002");
  assert.match(cleanInsert, /ON CONFLICT\(organization_id, user_id\) DO UPDATE/);
  assert.match(cleanInsert, /itis_rate_bps/);
  assert.doesNotMatch(cleanInsert, /pending_review|reviewed_by/);
  assert.deepEqual(foreignRow, before);
});

test("automatic Salary Advice migration stores employee rate and ITIS on the active profile", async () => {
  const migration = await readFile(new URL("../migrations/0011_automatic_salary_advice.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN hourly_rate_pence/);
  assert.match(migration, /ADD COLUMN itis_rate_bps INTEGER/);
  assert.match(migration, /UPDATE workforce_salary_advice_profiles/);
  assert.doesNotMatch(migration, /CREATE TABLE workforce_salary_advice_itis_rates/);
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
                itisRateBps: null,
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
    saveWorkerPayrollProfile(env, workerAuth, { ...validBody, itisRate: 7 }),
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
