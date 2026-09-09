import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const taggerDirectory = dirname(require.resolve("lovable-tagger"));
const esbuildModule = await import(pathToFileURL(require.resolve("esbuild", { paths: [taggerDirectory] })).href);

const bundled = await esbuildModule.build({
  entryPoints: [fileURLToPath(new URL("../src/shifts.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`;
const { adminAdjustShift, adminCreateShift } = await import(moduleUrl);

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

function fakeEnvironment(firstResult) {
  const batches = [];
  const database = {
    prepare(query) {
      return {
        query,
        bindings: [],
        bind(...bindings) {
          this.bindings = bindings;
          return this;
        },
        async first() {
          return firstResult(query, this.bindings);
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return { env: { DB: database }, batches };
}

test("admin creates a complete non-overlapping shift with an audited description", async () => {
  const { env, batches } = fakeEnvironment((query) => {
    if (query.includes("FROM workforce_memberships")) return { id: "worker-1" };
    if (query.includes("FROM workforce_projects")) return { id: "project-1" };
    if (query.includes("FROM workforce_shifts")) return null;
    throw new Error(`Unexpected query: ${query}`);
  });

  const result = await adminCreateShift(env, adminAuth, {
    userId: "worker-1",
    projectId: "project-1",
    clockInAt: "2026-08-25T07:00:00.000Z",
    clockOutAt: "2026-08-25T16:00:00.000Z",
    description: "Approved paper timesheet for site work.",
  });

  assert.equal(result.ok, true);
  assert.equal(batches.length, 1);
  assert.match(batches[0][0].query, /INSERT INTO workforce_shifts/);
  assert.deepEqual(batches[0][0].bindings.slice(1), [
    "org-1",
    "worker-1",
    "2026-08-25T07:00:00.000Z",
    "2026-08-25T16:00:00.000Z",
    "2026-08-25",
    "project-1",
    0,
  ]);
  assert.match(batches[0][1].query, /shift\.admin_created/);
  const audit = JSON.parse(batches[0][1].bindings[3]);
  assert.equal(audit.description, "Approved paper timesheet for site work.");
  assert.equal(audit.target_user_id, "worker-1");
});

test("admin-created shift rejects a missing description and an overlapping interval", async () => {
  const unused = fakeEnvironment(() => {
    throw new Error("Validation should fail before accessing the database");
  });
  await assert.rejects(
    adminCreateShift(unused.env, adminAuth, {
      userId: "worker-1",
      clockInAt: "2026-08-25T07:00:00.000Z",
      clockOutAt: "2026-08-25T16:00:00.000Z",
      description: "",
    }),
    { code: "INVALID_INPUT", status: 400 },
  );

  const overlapping = fakeEnvironment((query) => {
    if (query.includes("FROM workforce_memberships")) return { id: "worker-1" };
    if (query.includes("FROM workforce_shifts")) return { id: "existing-shift" };
    throw new Error(`Unexpected query: ${query}`);
  });
  await assert.rejects(
    adminCreateShift(overlapping.env, adminAuth, {
      userId: "worker-1",
      clockInAt: "2026-08-25T07:00:00.000Z",
      clockOutAt: "2026-08-25T16:00:00.000Z",
      description: "Approved paper timesheet.",
    }),
    { code: "SHIFT_OVERLAP", status: 409 },
  );
  assert.equal(overlapping.batches.length, 0);
});

test("worker role cannot create an administrative workday", async () => {
  const unused = fakeEnvironment(() => {
    throw new Error("Authorization should fail before accessing the database");
  });
  await assert.rejects(
    adminCreateShift(unused.env, {
      ...adminAuth,
      user: { ...adminAuth.user, id: "worker-1", role: "worker" },
    }, {
      userId: "worker-1",
      clockInAt: "2026-08-25T07:00:00.000Z",
      clockOutAt: "2026-08-25T16:00:00.000Z",
      description: "Attempted unauthorized workday.",
    }),
    { code: "FORBIDDEN", status: 403 },
  );
});

test("admin adjustment also rejects an interval that overlaps another shift", async () => {
  const { env, batches } = fakeEnvironment((query) => {
    if (query.includes("SELECT id, user_id")) {
      return {
        id: "shift-1",
        user_id: "worker-1",
        clock_in_at: "2026-08-25T07:00:00.000Z",
        clock_out_at: "2026-08-25T12:00:00.000Z",
        state: "complete",
      };
    }
    if (query.includes("FROM workforce_shifts")) return { id: "shift-2" };
    throw new Error(`Unexpected query: ${query}`);
  });

  await assert.rejects(
    adminAdjustShift(env, adminAuth, {
      shiftId: "shift-1",
      clockInAt: "2026-08-25T10:00:00.000Z",
      clockOutAt: "2026-08-25T14:00:00.000Z",
      reason: "Correct the submitted paper timesheet.",
    }),
    { code: "SHIFT_OVERLAP", status: 409 },
  );
  assert.equal(batches.length, 0);
});


test("break totals are validated, persisted and audited on creation and adjustment", async () => {
  const current = { id: "shift-1", user_id: "worker-1", clock_in_at: "2026-08-25T08:00:00Z", clock_out_at: "2026-08-25T16:00:00Z", state: "complete", break_minutes_override: 30 };
  const { env, batches } = fakeEnvironment(query => query.includes("FROM workforce_memberships") ? { id: "worker-1" } : query.includes("SELECT id, user_id") ? current : null);
  const create = { userId: "worker-1", clockInAt: current.clock_in_at, clockOutAt: current.clock_out_at, description: "Recorded break", breakMinutes: 75 };
  await adminCreateShift(env, adminAuth, create);
  assert.equal(batches[0][0].bindings.at(-1), 75);
  assert.equal(JSON.parse(batches[0][1].bindings[3]).break_minutes, 75);
  for (const value of [-1, 1.5, 481, "30", null]) {
    await assert.rejects(adminCreateShift(env, adminAuth, { ...create, breakMinutes: value }), /Break must/);
    await assert.rejects(adminAdjustShift(env, adminAuth, { shiftId: "shift-1", reason: "Correct break", breakMinutes: value }), /Break must/);
  }
  await adminAdjustShift(env, adminAuth, { shiftId: "shift-1", reason: "Remove break", breakMinutes: 0 });
  assert.equal(batches[1][0].bindings.at(-1), 0);
  assert.deepEqual([JSON.parse(batches[1][1].bindings[3]).old_break_minutes_override, JSON.parse(batches[1][1].bindings[3]).new_break_minutes_override], [30, 0]);
  await adminAdjustShift(env, adminAuth, { shiftId: "shift-1", reason: "Preserve break" });
  assert.equal(batches[2][0].bindings.at(-1), 30);
});

test("break override migration preserves existing rows and net minutes honor zero and legacy events", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { readFileSync } = await import("node:fs");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE workforce_shifts (id TEXT); INSERT INTO workforce_shifts VALUES ('old');");
  db.exec(readFileSync(new URL("../migrations/0012_admin_break_duration.sql", import.meta.url), "utf8"));
  assert.equal(db.prepare("SELECT break_minutes_override AS value FROM workforce_shifts").get().value, null);
  assert.throws(() => db.exec("UPDATE workforce_shifts SET break_minutes_override = -1"));
  db.close();
  const output = await esbuildModule.build({ entryPoints: [fileURLToPath(new URL("../src/shiftMetrics.ts", import.meta.url))], bundle: true, format: "esm", platform: "node", write: false });
  const { netMinutesFromShift } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`);
  const shift = { clockInAt: "2026-08-25T08:00:00Z", clockOutAt: "2026-08-25T16:00:00Z", breakStartedAt: null, breakEndedAt: null };
  const events = [{ type: "start_break", at: "2026-08-25T12:00:00Z" }, { type: "end_break", at: "2026-08-25T12:30:00Z" }];
  assert.equal(netMinutesFromShift(shift, events), 450);
  assert.equal(netMinutesFromShift({ ...shift, breakMinutesOverride: 75 }, events), 405);
  assert.equal(netMinutesFromShift({ ...shift, breakMinutesOverride: 0 }, events), 480);
});
