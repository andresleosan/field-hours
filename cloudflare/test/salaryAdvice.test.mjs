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
      'export { calculateAdminSalaryAdvice, calculateMonthlyWorkerSocialSecurity, parseSalaryAdvicePeriod } from "./salaryAdvice.ts";',
      'export { encryptPayrollValue } from "./payrollCrypto.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: sourceDirectory,
  },
});
const bundledSource = bundle.outputFiles[0]?.text;
if (!bundledSource) throw new Error("The Salary Advice test bundle could not be built.");
const {
  calculateAdminSalaryAdvice,
  calculateMonthlyWorkerSocialSecurity,
  encryptPayrollValue,
  parseSalaryAdvicePeriod,
} = await import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`);

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

test("periods are derived by the server as Monday-Sunday or a calendar month", () => {
  assert.deepEqual(parseSalaryAdvicePeriod("weekly", "2026-08-24", "2026-08-30"), {
    type: "weekly",
    start: "2026-08-24",
    end: "2026-08-30",
    payDate: "2026-08-30",
  });
  assert.deepEqual(parseSalaryAdvicePeriod("monthly", "2026-02-01", "2026-02-28"), {
    type: "monthly",
    start: "2026-02-01",
    end: "2026-02-28",
    payDate: "2026-02-28",
  });
  assert.throws(() => parseSalaryAdvicePeriod("weekly", "2026-08-25", "2026-08-30"), { code: "INVALID_PERIOD" });
  assert.throws(() => parseSalaryAdvicePeriod("monthly", "2026-08-02", "2026-08-31"), { code: "INVALID_PERIOD" });
  assert.throws(() => parseSalaryAdvicePeriod("monthly", "2025-08-01", "2025-08-31"), { code: "RULES_NOT_AVAILABLE" });
  assert.throws(() => parseSalaryAdvicePeriod("weekly", "2026-12-28", "2026-12-31"), { code: "RULES_NOT_AVAILABLE" });
  assert.throws(() => parseSalaryAdvicePeriod("monthly", "2026-12-01", "2027-01-01"), { code: "RULES_NOT_AVAILABLE" });
});

test("worker Social Security always uses the fixed 6 percent rate", () => {
  assert.equal(calculateMonthlyWorkerSocialSecurity(61_799), 3_708);
  assert.equal(calculateMonthlyWorkerSocialSecurity(61_899), 3_714);
  assert.equal(calculateMonthlyWorkerSocialSecurity(700_000), 42_000);
  assert.equal(calculateMonthlyWorkerSocialSecurity(0), 0);
});

async function salaryAdviceEnvironment() {
  const env = {
    PAYROLL_ENCRYPTION_KEY: "11".repeat(32),
    DB: null,
  };
  const taxReferenceCiphertext = await encryptPayrollValue(env, "NX17903");
  const socialReferenceCiphertext = await encryptPayrollValue(env, "JY438805C");
  const queries = [];
  env.DB = {
    prepare(query) {
      queries.push(query);
      return {
        bind() { return this; },
        async first() {
          if (query.includes("FROM workforce_salary_advice_settings")) {
            return {
              businessName: "Libertys - Quayside Kitchen",
              businessAddress: "Libertys, Jersey",
              itisRateBps: 1500,
              updatedAt: "2026-08-01T00:00:00.000Z",
            };
          }
          if (query.includes("FROM workforce_memberships")) {
            return {
              userId: "worker-1",
              organizationId: "org-1",
              displayName: "Federico De Freitas",
              email: "worker@field-hours.test",
              legalName: "Mr Federico De Freitas",
              address: "St Helier, Jersey",
              employeeNumber: "D013",
              hourlyRatePence: 1100,
              taxReferenceCiphertext,
              socialReferenceCiphertext,
              savedAt: "2026-01-01T00:00:00.000Z",
            };
          }
          throw new Error(`Unexpected first query: ${query}`);
        },
        async all() {
          if (query.includes("FROM workforce_shifts")) {
            return { results: [{
              id: "shift-1",
              userId: "worker-1",
              clockInAt: "2026-08-01T00:00:00.000Z",
              clockOutAt: "2026-08-04T01:30:00.000Z",
              breakStartedAt: null,
              breakEndedAt: null,
            }] };
          }
          if (query.includes("FROM workforce_shift_events")) return { results: [] };
          throw new Error(`Unexpected all query: ${query}`);
        },
        async run() { return { success: true }; },
      };
    },
  };
  return { env, queries };
}

test("automatic Salary Advice uses the saved profile rate, annual ITIS, fixed 6% and all saved hours", async () => {
  const { env, queries } = await salaryAdviceEnvironment();
  const advice = await calculateAdminSalaryAdvice(env, adminAuth, {
    userId: "worker-1",
    periodType: "monthly",
    periodStart: "2026-08-01",
    payDate: "2026-08-31",
  });

  assert.equal(advice.allowance.hourlyRate, 11);
  assert.equal(advice.grossTaxablePay, 808.5);
  assert.equal(advice.deductions.itisRate, 15);
  assert.equal(advice.deductions.incomeTax, 121.28);
  assert.equal(advice.deductions.workerSocialSecurityRate, 6);
  assert.equal(advice.deductions.workerSocialSecurity, 48.51);
  assert.equal(advice.deductions.workerSocialSecuritySource, "calculated_from_saved_hours");
  assert.equal(advice.totalsToDate.grossTaxablePay, 808.5);
  assert.equal(advice.totalsToDate.taxPaid, 121.28);
  assert.equal(advice.totalsToDate.source, "calculated_from_saved_hours");
  assert.equal(advice.netPay, 638.71);
  assert.ok(queries.filter((query) => query.includes("FROM workforce_shifts")).length >= 2);
});

test("a monthly Salary Advice calculates one selected worker and excludes invented employer fields", async () => {
  const { env, queries } = await salaryAdviceEnvironment();
  const advice = await calculateAdminSalaryAdvice(env, adminAuth, {
    userId: "worker-1",
    periodType: "monthly",
    periodStart: "2026-08-01",
    payDate: "2026-08-31",
  });

  assert.equal(advice.worker.userId, "worker-1");
  assert.equal(advice.allowance.hours, 73.5);
  assert.equal(advice.allowance.amount, 808.5);
  assert.equal(advice.deductions.incomeTax, 121.28);
  assert.equal(advice.deductions.workerSocialSecurity, 48.51);
  assert.equal(advice.deductions.workerSocialSecuritySource, "calculated_from_saved_hours");
  assert.equal(advice.deductions.total, 169.79);
  assert.equal(advice.netPay, 638.71);
  assert.deepEqual(advice.totalsToDate, {
    grossTaxablePay: 808.5,
    taxPaid: 121.28,
    source: "calculated_from_saved_hours",
  });
  assert.deepEqual(advice.warnings, []);
  const serialized = JSON.stringify(advice);
  assert.doesNotMatch(serialized, /employerSocialSecurity|employerCost|businessTaxReference|businessSocialReference|approved|review/i);
  assert.ok(queries.some((query) => query.includes("s.user_id = ?2")));
  assert.ok(queries.some((query) => query.includes("salary_advice.calculated")));
});

test("a weekly advice also calculates Social Security from saved hours", async () => {
  const { env } = await salaryAdviceEnvironment();
  const advice = await calculateAdminSalaryAdvice(env, adminAuth, {
    userId: "worker-1",
    periodType: "weekly",
    periodStart: "2026-08-24",
    payDate: "2026-08-30",
  });
  assert.equal(advice.period.end, "2026-08-30");
  assert.equal(advice.deductions.workerSocialSecurity, 48.51);
  assert.equal(advice.deductions.workerSocialSecurityRate, 6);
  assert.equal(advice.deductions.workerSocialSecuritySource, "calculated_from_saved_hours");
  assert.deepEqual(advice.warnings, []);
});

test("manual payroll amounts are rejected so the server remains the source of calculation", async () => {
  const common = {
    userId: "worker-1",
    periodType: "weekly",
    periodStart: "2026-08-24",
    payDate: "2026-08-30",
    hourlyRate: 11,
  };
  const noDb = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, common), { code: "INVALID_INPUT" });
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, { ...common, itisRate: 15 }), { code: "INVALID_INPUT" });
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, { ...common, yearToDateTaxPaid: 1 }), { code: "INVALID_INPUT" });
});

test("automatic calculation rejects every retired manual input", async () => {
  const noDb = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  const common = {
    userId: "worker-1",
    periodType: "monthly",
    periodStart: "2026-08-01",
    payDate: "2026-08-31",
    itisRate: 15,
  };
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, common), { code: "INVALID_INPUT" });
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, { ...common, workerSocialSecurityRate: 6 }), { code: "INVALID_INPUT" });
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, { ...common, weeklyWorkerSocialSecurity: 1 }), { code: "INVALID_INPUT" });
  await assert.rejects(calculateAdminSalaryAdvice(noDb, adminAuth, { ...common, yearToDateGrossTaxablePay: 1 }), { code: "INVALID_INPUT" });
});

test("worker role and obsolete request fields are rejected before calculation", async () => {
  const env = { DB: { prepare() { throw new Error("D1 must not be accessed"); } } };
  await assert.rejects(
    calculateAdminSalaryAdvice(env, { ...adminAuth, user: { ...adminAuth.user, role: "worker" } }, {
      userId: "worker-1", periodType: "weekly", periodStart: "2026-08-24", payDate: "2026-08-30", hourlyRate: 11,
    }),
    { code: "FORBIDDEN", status: 403 },
  );
  await assert.rejects(
    calculateAdminSalaryAdvice(env, adminAuth, {
      userId: "worker-1", periodType: "weekly", periodStart: "2026-08-24", payDate: "2026-08-30", hourlyRate: 11, decision: "approved",
    }),
    { code: "INVALID_INPUT", status: 400 },
  );
});
