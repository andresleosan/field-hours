import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const fixture = join(root, "cloudflare", "test", "fixtures", "recovery-seed.sql");
const database = "field-hours-recovery-test";
const rehearsalRoot = mkdtempSync(join(tmpdir(), "field-hours-d1-recovery-"));
const sourceRoot = join(rehearsalRoot, "source");
const restoredRoot = join(rehearsalRoot, "restored");
const exportPath = join(rehearsalRoot, "synthetic-backup.sql");
const sourceConfig = join(sourceRoot, "wrangler.jsonc");
const restoredConfig = join(restoredRoot, "wrangler.jsonc");
mkdirSync(sourceRoot);
mkdirSync(restoredRoot);
const localConfig = {
  name: "field-hours-recovery-rehearsal",
  main: join(root, "cloudflare", "src", "index.ts"),
  compatibility_date: "2026-08-19",
  d1_databases: [{
    binding: "DB",
    database_name: database,
    database_id: "00000000-0000-0000-0000-000000000001",
    migrations_dir: join(root, "cloudflare", "migrations"),
  }],
};
writeFileSync(sourceConfig, JSON.stringify(localConfig));
writeFileSync(restoredConfig, JSON.stringify(localConfig));

const schemaQuery = `SELECT type, name FROM sqlite_schema
WHERE name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'
ORDER BY type, name`;
const countsQuery = `SELECT
  (SELECT COUNT(*) FROM d1_migrations) AS migrations,
  (SELECT COUNT(*) FROM workforce_organizations) AS organizations,
  (SELECT COUNT(*) FROM workforce_users) AS users,
  (SELECT COUNT(*) FROM workforce_memberships) AS memberships,
  (SELECT COUNT(*) FROM workforce_projects) AS projects,
  (SELECT COUNT(*) FROM workforce_shifts) AS shifts,
  (SELECT COUNT(*) FROM workforce_shift_events) AS shift_events,
  (SELECT COUNT(*) FROM workforce_google_identities) AS google_identities,
  (SELECT COUNT(*) FROM workforce_payroll_profiles) AS payroll_profiles,
  (SELECT COUNT(*) FROM workforce_payroll_settings) AS payroll_settings,
  (SELECT COUNT(*) FROM workforce_salary_advice_profiles) AS salary_advice_profiles,
  (SELECT COUNT(*) FROM workforce_salary_advice_settings) AS salary_advice_settings,
  (SELECT COUNT(*) FROM workforce_payroll_runs) AS payroll_runs,
  (SELECT COUNT(*) FROM workforce_payroll_run_lines) AS payroll_run_lines,
  (SELECT COUNT(*) FROM workforce_audit_events) AS audit_events`;

function runWrangler(args, { json = false, cwd = root, config = sourceConfig } = {}) {
  assert(args.includes("--local"), "Recovery rehearsal refuses to run without --local");
  assert(!args.includes("--remote"), "Recovery rehearsal refuses remote D1 access");
  const result = spawnSync(process.execPath, [wrangler, ...args, "--config", config], {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      CI: "1",
      WRANGLER_LOG_PATH: join(rehearsalRoot, "wrangler.log"),
      XDG_CONFIG_HOME: rehearsalRoot,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler failed (${args[0]} ${args[1]}): ${result.stderr || result.stdout}`);
  }
  if (json && !result.stdout.trim()) {
    throw new Error(`Wrangler returned no JSON (${args[0]} ${args[1]}): ${result.stderr}`);
  }
  return json ? JSON.parse(result.stdout) : result.stdout;
}

function executeLocal(localRoot, config, sql) {
  const output = runWrangler([
    "d1", "execute", database, "--local", "--command", sql, "--json",
  ], { json: true, cwd: localRoot, config });
  assert(Array.isArray(output) && output[0]?.success === true, "D1 query did not succeed");
  return output[0].results;
}

try {
  runWrangler(["d1", "migrations", "apply", database, "--local"], { cwd: sourceRoot, config: sourceConfig });
  runWrangler(["d1", "execute", database, "--local", "--file", fixture, "--yes"], { cwd: sourceRoot, config: sourceConfig });

  const sourceSchema = executeLocal(sourceRoot, sourceConfig, schemaQuery);
  const sourceCounts = executeLocal(sourceRoot, sourceConfig, countsQuery);
  const sourceForeignKeys = executeLocal(sourceRoot, sourceConfig, "PRAGMA foreign_key_check");
  assert.equal(sourceForeignKeys.length, 0, "Synthetic source has foreign-key violations");

  runWrangler([
    "d1", "export", database, "--local", "--output", exportPath, "--skip-confirmation",
  ], { cwd: sourceRoot, config: sourceConfig });
  runWrangler([
    "d1", "execute", database, "--local", "--file", exportPath, "--yes",
  ], { cwd: restoredRoot, config: restoredConfig });

  const restoredSchema = executeLocal(restoredRoot, restoredConfig, schemaQuery);
  const restoredCounts = executeLocal(restoredRoot, restoredConfig, countsQuery);
  const restoredForeignKeys = executeLocal(restoredRoot, restoredConfig, "PRAGMA foreign_key_check");

  assert.deepEqual(restoredSchema, sourceSchema, "Restored schema objects differ from the source");
  assert.deepEqual(restoredCounts, sourceCounts, "Restored row counts differ from the source");
  assert.equal(restoredForeignKeys.length, 0, "Restored database has foreign-key violations");

  console.log("D1 recovery rehearsal passed: synthetic export/import, schema, row counts and foreign keys match.");
  console.log(`Verified ${sourceSchema.length} schema objects across ${Object.keys(sourceCounts[0]).length} counters; production was not accessed.`);
} finally {
  rmSync(rehearsalRoot, { recursive: true, force: true });
}
