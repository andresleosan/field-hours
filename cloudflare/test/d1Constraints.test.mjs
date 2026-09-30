// Runs shift logic against a real local D1 (all migrations applied) so SQL limits,
// CHECKs and triggers are exercised — the fake-DB tests cannot catch those.
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getPlatformProxy } from "wrangler";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const esbuild = await import(pathToFileURL(require.resolve("esbuild", { paths: [dirname(require.resolve("lovable-tagger"))] })).href);
async function load(entry) {
  const out = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, format: "esm", platform: "node", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}
const shifts = await load("src/shifts.ts");
const metrics = await load("src/shiftMetrics.ts");
const google = await load("src/googleAuth.ts");
const auth = await load("src/auth.ts");
const http = await load("src/http.ts");
const requestHistory = await load("src/requestHistory.ts");
const payrollProfiles = await load("src/payrollProfiles.ts");

const persist = mkdtempSync(join(tmpdir(), "field-hours-d1-"));
const proxy = await getPlatformProxy({ configPath: join(root, "wrangler.jsonc"), persist: { path: persist } });
const env = proxy.env;
after(async () => { await proxy.dispose(); rmSync(persist, { recursive: true, force: true }); });

for (const file of readdirSync(join(root, "migrations")).sort()) {
  await env.DB.exec(readFileSync(join(root, "migrations", file), "utf8").replace(/--.*$/gm, "").replace(/\s*\n\s*/g, " "));
}
await env.DB.batch([
  env.DB.prepare("INSERT INTO workforce_organizations (id, name, timezone) VALUES ('org', 'Test', 'Europe/Jersey')"),
  env.DB.prepare("INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations) VALUES ('worker-1', 'w@t.test', ?1, ?2, 100000)").bind("s".repeat(32), "h".repeat(64)),
  env.DB.prepare("INSERT INTO workforce_memberships (organization_id, user_id, role, display_name) VALUES ('org', 'worker-1', 'worker', 'Worker')"),
  env.DB.prepare("INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations) VALUES ('admin-1', 'a@t.test', ?1, ?2, 100000)").bind("s".repeat(32), "h".repeat(64)),
]);

const user = { organizationId: "org", organizationName: "Test", timezone: "Europe/Jersey", mustChangePassword: false };
const admin = { sessionHash: "s", csrfHash: "c", user: { ...user, id: "admin-1", email: "a@t.test", displayName: "Admin", role: "admin" } };
const worker = { sessionHash: "s", csrfHash: "c", user: { ...user, id: "worker-1", email: "w@t.test", displayName: "Worker", role: "worker" } };

let seq = 0;
async function insertShift({ day, clockIn, clockOut, breakStart = null, breakEnd = null }) {
  const id = `shift-${++seq}`;
  await env.DB.prepare(
    `INSERT INTO workforce_shifts (id, organization_id, user_id, state, clock_in_at, break_started_at, break_ended_at, clock_out_at, work_date)
     VALUES (?1, 'org', 'worker-1', 'complete', ?2, ?3, ?4, ?5, ?6)`,
  ).bind(id, `${day}T${clockIn}:00.000Z`, breakStart && `${day}T${breakStart}:00.000Z`, breakEnd && `${day}T${breakEnd}:00.000Z`, `${day}T${clockOut}:00.000Z`, day).run();
  return id;
}

test("E0: adjust succeeds when the recorded break falls outside the new times", async () => {
  const id = await insertShift({ day: "2026-09-25", clockIn: "09:08", clockOut: "18:51", breakStart: "18:30", breakEnd: "18:51" });
  await shifts.adminAdjustShift(env, admin, { shiftId: id, clockInAt: "2026-09-25T07:00:00.000Z", clockOutAt: "2026-09-25T18:50:00.000Z", breakMinutes: 25, reason: "ajuste" });
  const row = await env.DB.prepare("SELECT break_started_at, break_minutes_override FROM workforce_shifts WHERE id = ?1").bind(id).first();
  assert.equal(row.break_started_at, null);
  assert.equal(row.break_minutes_override, 25);
});

test("E1: history and totals work with more than 100 shifts (D1 bound-parameter limit)", async () => {
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 150; i += 1) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const id = await insertShift({ day, clockIn: "08:00", clockOut: "16:00" });
    await env.DB.prepare("INSERT INTO workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata_json) VALUES ('org', 'admin-1', 'shift.admin_adjusted', ?1, ?2)")
      .bind(id, JSON.stringify({ reason: "seed" })).run();
  }
  const adminRows = await shifts.adminShiftHistory(env, admin, new URLSearchParams());
  assert.ok(adminRows.length > 100);
  assert.ok(adminRows.every((row) => row.admin_adjustment));
  const workerRows = await shifts.workerShiftHistory(env, worker, new URLSearchParams());
  assert.equal(workerRows.length, 100);
  const totals = await metrics.aggregateCompletedShifts(env, "org", "worker-1");
  assert.ok(totals.shifts > 100);
});

test("E3/E8: an open shift can be corrected without closing it, and cannot be left unusable", async () => {
  const id = `shift-${++seq}`;
  const clockIn = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const breakStart = new Date(Date.now() - 3_600_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO workforce_shifts (id, organization_id, user_id, state, clock_in_at, break_started_at, work_date)
     VALUES (?1, 'org', 'worker-1', 'on_break', ?2, ?3, '2030-01-01')`,
  ).bind(id, clockIn, breakStart).run();
  const earlier = new Date(Date.now() - 4 * 3_600_000).toISOString();
  await shifts.adminAdjustShift(env, admin, { shiftId: id, clockInAt: earlier, reason: "llegó antes" });
  const row = await env.DB.prepare("SELECT state, clock_in_at, clock_out_at, break_started_at FROM workforce_shifts WHERE id = ?1").bind(id).first();
  assert.deepEqual(row, { state: "on_break", clock_in_at: earlier, clock_out_at: null, break_started_at: breakStart });

  await assert.rejects(
    shifts.adminAdjustShift(env, admin, { shiftId: id, clockInAt: new Date(Date.now() + 3_600_000).toISOString(), reason: "futuro" }),
    { status: 400 },
  );
  await assert.rejects(
    shifts.adminAdjustShift(env, admin, { shiftId: id, clockInAt: new Date(Date.now() - 30 * 60_000).toISOString(), reason: "tras la pausa" }),
    { status: 400 },
  );
  await env.DB.prepare("UPDATE workforce_shifts SET state = 'complete', clock_out_at = ?2 WHERE id = ?1").bind(id, new Date().toISOString()).run();
});

test("E4: only the part of a break inside the adjusted times is deducted", () => {
  const events = [{ type: "start_break", at: "2026-09-25T12:00:00.000Z" }, { type: "end_break", at: "2026-09-25T13:00:00.000Z" }];
  const shift = (clockInAt, clockOutAt) => ({ id: "x", userId: "u", clockInAt, clockOutAt, breakStartedAt: null, breakEndedAt: null });
  assert.equal(metrics.netMinutesFromShift(shift("2026-09-25T08:00:00.000Z", "2026-09-25T16:00:00.000Z"), events), 420);
  assert.equal(metrics.netMinutesFromShift(shift("2026-09-25T14:00:00.000Z", "2026-09-25T18:00:00.000Z"), events), 240);
  assert.equal(metrics.netMinutesFromShift(shift("2026-09-25T08:00:00.000Z", "2026-09-25T12:30:00.000Z"), events), 240);
});

async function insertGoogleRequest(email, subject) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO workforce_auth_requests (id, organization_id, request_type, email, display_name, google_subject)
     VALUES (?1, 'org', 'access', ?2, 'Someone', ?3)`,
  ).bind(id, email, subject).run();
  return id;
}

test("E5: the same email can be rejected more than once", async () => {
  await google.reviewGoogleAuthRequest(env, admin, await insertGoogleRequest("again@t.test", "sub-a"), { decision: "reject" });
  await google.reviewGoogleAuthRequest(env, admin, await insertGoogleRequest("again@t.test", "sub-a"), { decision: "reject" });
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM workforce_auth_requests WHERE email = 'again@t.test' AND status = 'rejected'").first();
  assert.equal(n, 2);
});

test("E6: approving a request for an email that already has an account returns a clear 409", async () => {
  const id = await insertGoogleRequest("w@t.test", "sub-w");
  await assert.rejects(google.reviewGoogleAuthRequest(env, admin, id, { decision: "approve" }), { status: 409, code: "ACCOUNT_EXISTS" });
});

test("E9: an adjustment racing another change to the same shift is refused and leaves no audit row", async () => {
  const id = await insertShift({ day: "2020-01-02", clockIn: "08:00", clockOut: "16:00" });
  // Someone else changes the shift after this admin's read but before the write.
  const racingDb = Object.create(env.DB);
  racingDb.batch = async (statements) => {
    await env.DB.prepare("UPDATE workforce_shifts SET clock_in_at = '2020-01-02T09:00:00.000Z' WHERE id = ?1").bind(id).run();
    return env.DB.batch(statements);
  };
  await assert.rejects(
    shifts.adminAdjustShift({ ...env, DB: racingDb }, admin, { shiftId: id, clockInAt: "2020-01-02T07:00:00.000Z", reason: "carrera" }),
    { status: 409, code: "SHIFT_ADJUST_FAILED" },
  );
  const row = await env.DB.prepare("SELECT clock_in_at FROM workforce_shifts WHERE id = ?1").bind(id).first();
  assert.equal(row.clock_in_at, "2020-01-02T09:00:00.000Z");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM workforce_audit_events WHERE subject_id = ?1").bind(id).first();
  assert.equal(n, 0);
});

test("E10: a worker cannot clock in inside a shift an admin already recorded", async () => {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workforce_users (id, email, password_salt, password_hash, password_iterations) VALUES ('worker-2', 'w2@t.test', ?1, ?2, 100000)").bind("s".repeat(32), "h".repeat(64)),
    env.DB.prepare("INSERT INTO workforce_memberships (organization_id, user_id, role, display_name) VALUES ('org', 'worker-2', 'worker', 'Worker 2')"),
  ]);
  const now = Date.now();
  await shifts.adminCreateShift(env, admin, {
    userId: "worker-2",
    clockInAt: new Date(now - 3_600_000).toISOString(),
    clockOutAt: new Date(now + 3_600_000).toISOString(),
    description: "entered by admin",
  });
  await assert.rejects(
    shifts.performShiftAction(env, { ...worker, user: { ...worker.user, id: "worker-2" } }, {
      action: "clock_in",
      projectId: "any-project",
      idempotencyKey: crypto.randomUUID(),
      location: { latitude: 49.18, longitude: -2.1, accuracy: 10, capturedAt: new Date().toISOString() },
    }),
    { status: 409, code: "SHIFT_OVERLAP" },
  );
});

// Workers-only API used by password verification; same polyfill as passwordPepper.test.mjs.
if (typeof crypto.subtle.timingSafeEqual !== "function") {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value: (left, right) => left.byteLength === right.byteLength
      && Buffer.compare(Buffer.from(left.buffer, left.byteOffset, left.byteLength), Buffer.from(right.buffer, right.byteOffset, right.byteLength)) === 0,
  });
}

test("E14: wrong passwords from one address do not lock the account for other addresses", async () => {
  const pepperedEnv = { ...env, PASSWORD_PEPPER_CURRENT: "p".repeat(64) };
  const attempt = (ip) => auth.login(pepperedEnv, { email: "a@t.test", password: "wrong-password-123" }, ip);
  for (let i = 0; i < 5; i += 1) await assert.rejects(attempt("203.0.113.9"), { status: 401 });
  await assert.rejects(attempt("203.0.113.9"), { status: 429 });
  await assert.rejects(attempt("198.51.100.7"), { status: 401 });
});

test("E19: text length is counted in characters, like the database CHECKs", () => {
  assert.throws(() => http.requireString("😀", "Name", 2, 160), { status: 400 });
  assert.equal(http.requireString("😀😀", "Name", 2, 2), "😀😀");
});

test("E22: timestamps outside 2000–2099 are rejected with a 400", async () => {
  const id = await insertShift({ day: "2020-03-03", clockIn: "08:00", clockOut: "16:00" });
  for (const clockOutAt of ["+275760-09-13T00:00:00.000Z", "1999-12-31T23:00:00.000Z"]) {
    await assert.rejects(shifts.adminAdjustShift(env, admin, { shiftId: id, clockOutAt, reason: "año raro" }), { status: 400 });
  }
});

test("E23: each rejected password reset shows its own rejection reason", async () => {
  const insert = (id, requestedAt, reviewedAt, status = "rejected") => env.DB.prepare(
    `INSERT INTO workforce_password_reset_requests (id, organization_id, user_id, email, status, requested_at, reviewed_at)
     VALUES (?1, 'org', 'worker-1', 'w@t.test', ?4, ?2, ?3)`,
  ).bind(id, requestedAt, reviewedAt, status).run();
  const audit = (reason, at) => env.DB.prepare(
    `INSERT INTO workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata_json, created_at)
     VALUES ('org', 'admin-1', 'account.password.reset_rejected', 'worker-1', ?1, ?2)`,
  ).bind(JSON.stringify({ reason }), at).run();
  await insert("reset-1", "2026-01-01T10:00:00.000Z", "2026-01-01T11:00:00.000Z");
  await audit("first", "2026-01-01T11:00:00.010Z");
  await insert("reset-2", "2026-02-01T10:00:00.000Z", "2026-02-01T11:00:00.000Z");
  await audit("second", "2026-02-01T11:00:00.010Z");
  await insert("reset-3", "2026-01-15T10:00:00.000Z", "2026-01-15T11:00:00.000Z", "issued");
  const rows = await requestHistory.listRequestHistory(env, admin);
  const reason = (id) => rows.find((row) => row.id === id).reason;
  assert.equal(reason("reset-1"), "first");
  assert.equal(reason("reset-2"), "second");
  assert.equal(reason("reset-3"), null);
});

test("E24: setting pay before the worker saved their profile explains why", async () => {
  await assert.rejects(
    payrollProfiles.saveAdminPayrollProfileCompensation(env, admin, "worker-1", { hourlyRate: 15, itisRate: 10 }),
    { status: 409, code: "PROFILE_NOT_SUBMITTED" },
  );
});
