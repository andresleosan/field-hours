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
      'export { listAdminPayrollProfiles } from "./payrollProfiles.ts";',
      'export { getAdminPayrollPreview } from "./payrollCalculation.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: sourceDirectory,
  },
});
const bundledSource = bundle.outputFiles[0]?.text;
if (!bundledSource) throw new Error("The disabled worker test bundle could not be built.");
const { getAdminPayrollPreview, listAdminPayrollProfiles } = await import(
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

function fakeEnvironment() {
  const allQueries = [];
  const database = {
    prepare(query) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (!query.includes("FROM workforce_payroll_settings")) {
            throw new Error(`Unexpected first query: ${query}`);
          }
          return {
            hourlyRatePence: 1500,
            payFrequency: "monthly",
            payDay: 1,
            workerSocialSecurityRateBps: 600,
            employerSocialSecurityRateBps: 650,
          };
        },
        async all() {
          allQueries.push(query);
          return { results: [] };
        },
      };
    },
  };
  return { env: { DB: database }, allQueries };
}

test("disabled workers are excluded from payroll profile and preview queries", async () => {
  const profiles = fakeEnvironment();
  await listAdminPayrollProfiles(profiles.env, adminAuth);
  assert.equal(profiles.allQueries.length, 1);
  assert.match(
    profiles.allQueries[0],
    /JOIN workforce_users u ON u\.id = m\.user_id AND u\.disabled_at IS NULL/,
  );

  const preview = fakeEnvironment();
  await getAdminPayrollPreview(
    preview.env,
    adminAuth,
    new URLSearchParams({ start_date: "2026-08-01", end_date: "2026-08-31" }),
  );
  assert.equal(preview.allQueries.length, 1);
  assert.match(
    preview.allQueries[0],
    /JOIN workforce_users u ON u\.id = m\.user_id AND u\.disabled_at IS NULL/,
  );
});
