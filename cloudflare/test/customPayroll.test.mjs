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
      'export { getAdminCustomPayrollPreview } from "./payrollCalculation.ts";',
      'export { submitAdminPayrollRun } from "./payrollRuns.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: sourceDirectory,
  },
});
const bundledSource = bundle.outputFiles[0]?.text;
if (!bundledSource) throw new Error("The custom payroll test bundle could not be built.");
const { getAdminCustomPayrollPreview, submitAdminPayrollRun } = await import(
  `data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`
);

const adminAuth = {
  sessionHash: "session",
  csrfHash: "csrf",
  user: {
    id: "admin-1",
    email: "admin@field-hours.test",
    displayName: "Admin Test",
    role: "admin",
    organizationId: "org-1",
    organizationName: "Field Hours Test",
    timezone: "Europe/Jersey",
    mustChangePassword: false,
  },
};

function calculationEnvironment() {
  const settings = {
    hourlyRatePence: 2000,
    payFrequency: "monthly",
    payDay: 1,
    workerSocialSecurityRateBps: 600,
    employerSocialSecurityRateBps: 650,
  };
  return {
    DB: {
      prepare(query) {
        return {
          bind() { return this; },
          async first() {
            if (query.includes("FROM workforce_payroll_settings")) return settings;
            throw new Error(`Unexpected first query: ${query}`);
          },
          async all() {
            if (query.includes("FROM workforce_memberships")) {
              return { results: [{
                userId: "worker-1",
                displayName: "Worker Test",
                email: "worker@field-hours.test",
                employeeNumber: "EMP-001",
                itisRateBps: 1000,
                status: "approved",
                shiftCount: 0,
                netMinutes: 0,
              }] };
            }
            if (query.includes("FROM workforce_shifts")) return { results: [] };
            throw new Error(`Unexpected all query: ${query}`);
          },
        };
      },
    },
  };
}

test("custom payroll calculates a complete single-worker preview from saved settings", async () => {
  const preview = await getAdminCustomPayrollPreview(
    { DB: calculationEnvironment().DB },
    adminAuth,
    "worker-1",
    2400,
  );

  assert.equal(preview.lines.length, 1);
  assert.deepEqual(preview.lines[0], {
    userId: "worker-1",
    displayName: "Worker Test",
    email: "worker@field-hours.test",
    employeeNumber: "EMP-001",
    profileStatus: "approved",
    shiftCount: 0,
    hours: 40,
    itisRate: 10,
    grossPay: 800,
    workerSocialSecurity: 48,
    incomeTax: 80,
    netPay: 672,
    employerSocialSecurity: 52,
    employerTotalCost: 852,
    warnings: ["Hours entered manually by an administrator."],
  });
  assert.deepEqual(preview.totals, {
    grossPay: 800,
    workerSocialSecurity: 48,
    incomeTax: 80,
    netPay: 672,
    employerSocialSecurity: 52,
    employerTotalCost: 852,
  });
});

test("custom payroll rejects malformed hours before accessing D1", async () => {
  const env = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    submitAdminPayrollRun(env, adminAuth, { custom: { userId: "worker-1", hours: 1.234 } }),
    { code: "INVALID_INPUT", status: 400 },
  );
  await assert.rejects(
    submitAdminPayrollRun(env, adminAuth, { custom: { userId: "worker-1", hours: 0 } }),
    { code: "INVALID_INPUT", status: 400 },
  );
});

test("worker role cannot create a custom payroll", async () => {
  const env = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    submitAdminPayrollRun(env, { ...adminAuth, user: { ...adminAuth.user, id: "worker-1", role: "worker" } }, { custom: { userId: "worker-1", hours: 40 } }),
    { code: "FORBIDDEN", status: 403 },
  );
});
