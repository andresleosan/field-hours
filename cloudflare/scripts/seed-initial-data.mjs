import { createHmac, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const configPath = join(scriptDirectory, "..", "wrangler.jsonc");
const sqlPath = join(tmpdir(), `seed-${randomUUID()}.sql`);

const pepper = "f4d8a1c9e3b750162a8c9e4b7d10f35a62e8b9c0d1e2f3a4b5c6d7e8f90123456789abcdef0123456789abcdef";
const iterations = 100_000;

function hashPassword(password) {
  const salt = randomBytes(16);
  const passwordMaterial = createHmac("sha256", pepper).update(password).digest();
  const passwordHash = pbkdf2Sync(passwordMaterial, salt, iterations, 32, "sha256");
  return {
    salt: salt.toString("hex"),
    hash: passwordHash.toString("hex"),
  };
}

const orgId = randomUUID();
const adminId = randomUUID();
const luisId = randomUUID();
const flaviaId = randomUUID();
const proj1Id = randomUUID();
const proj2Id = randomUUID();

const adminCreds = hashPassword("ChangeMeImmediately123!");
const workerCreds = hashPassword("Worker12345678!");

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

const sql = `
PRAGMA foreign_keys = ON;

-- Organization
INSERT INTO workforce_organizations (id, name, timezone)
VALUES ('${orgId}', 'Field Hours Construction', 'Europe/Jersey');

-- Admin user
INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations, must_change_password)
VALUES ('${adminId}', 'admin@field-hours.local', '${adminCreds.salt}', '${adminCreds.hash}', ${iterations}, 0);

INSERT INTO workforce_memberships (organization_id, user_id, role, display_name)
VALUES ('${orgId}', '${adminId}', 'admin', 'Site Administrator');

-- Worker 1: Luis Manuel
INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations, must_change_password)
VALUES ('${luisId}', 'luis.manuel@field-hours.local', '${workerCreds.salt}', '${workerCreds.hash}', ${iterations}, 0);

INSERT INTO workforce_memberships (organization_id, user_id, role, display_name)
VALUES ('${orgId}', '${luisId}', 'worker', 'Luis Manuel');

-- Worker 2: Flavia Goncalves
INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations, must_change_password)
VALUES ('${flaviaId}', 'flavia.goncalves@field-hours.local', '${workerCreds.salt}', '${workerCreds.hash}', ${iterations}, 0);

INSERT INTO workforce_memberships (organization_id, user_id, role, display_name)
VALUES ('${orgId}', '${flaviaId}', 'worker', 'Flávia Gonçalves');

-- Projects
INSERT INTO workforce_projects (id, organization_id, name, code, address, latitude, longitude, radius_m, is_active)
VALUES 
  ('${proj1Id}', '${orgId}', 'Edificio Residencial Los Olivos', 'PRJ-01', 'Av. Principal 450, Santiago', -33.4489, -70.6693, 200, 1),
  ('${proj2Id}', '${orgId}', 'Centro Comercial Costanera Norte', 'PRJ-02', 'Costanera Norte 1200, Santiago', -33.4120, -70.6050, 300, 1);

-- Historical Shifts for Luis Manuel
-- Shift 1 (3 days ago - 8h 30m)
INSERT INTO workforce_shifts (id, organization_id, user_id, work_date, state, clock_in_at, break_started_at, break_ended_at, clock_out_at, project_id)
VALUES ('${randomUUID()}', '${orgId}', '${luisId}', '${threeDaysAgo}', 'complete', 
        '${threeDaysAgo}T08:00:00.000Z', '${threeDaysAgo}T12:30:00.000Z', '${threeDaysAgo}T13:30:00.000Z', '${threeDaysAgo}T17:30:00.000Z', '${proj1Id}');

-- Shift 2 (2 days ago - 8h 00m)
INSERT INTO workforce_shifts (id, organization_id, user_id, work_date, state, clock_in_at, break_started_at, break_ended_at, clock_out_at, project_id)
VALUES ('${randomUUID()}', '${orgId}', '${luisId}', '${twoDaysAgo}', 'complete', 
        '${twoDaysAgo}T08:15:00.000Z', '${twoDaysAgo}T12:30:00.000Z', '${twoDaysAgo}T13:15:00.000Z', '${twoDaysAgo}T17:00:00.000Z', '${proj1Id}');

-- Shift 3 (yesterday - 8h 15m)
INSERT INTO workforce_shifts (id, organization_id, user_id, work_date, state, clock_in_at, break_started_at, break_ended_at, clock_out_at, project_id)
VALUES ('${randomUUID()}', '${orgId}', '${luisId}', '${yesterday}', 'complete', 
        '${yesterday}T08:00:00.000Z', '${yesterday}T12:45:00.000Z', '${yesterday}T13:30:00.000Z', '${yesterday}T17:00:00.000Z', '${proj2Id}');

-- Historical Shifts for Flavia Goncalves
-- Shift 1 (yesterday - 8h 00m)
INSERT INTO workforce_shifts (id, organization_id, user_id, work_date, state, clock_in_at, break_started_at, break_ended_at, clock_out_at, project_id)
VALUES ('${randomUUID()}', '${orgId}', '${flaviaId}', '${yesterday}', 'complete', 
        '${yesterday}T08:30:00.000Z', '${yesterday}T13:00:00.000Z', '${yesterday}T14:00:00.000Z', '${yesterday}T17:30:00.000Z', '${proj1Id}');
`;

writeFileSync(sqlPath, sql, { encoding: "utf8" });

try {
  const result = spawnSync("npx", [
    "wrangler", "d1", "execute", "field-hours-prod", "--remote", "--config", configPath, "--file", sqlPath
  ], {
    cwd: join(scriptDirectory, ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log("Status:", result.status);
  console.log("Stdout:", result.stdout);
  console.log("Stderr:", result.stderr);
} finally {
  unlinkSync(sqlPath);
}
