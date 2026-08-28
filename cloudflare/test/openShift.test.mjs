import assert from "node:assert/strict";
import test from "node:test";
import { findOpenShiftForWorker } from "../src/openShift.ts";

function recordingDatabase(result) {
  const recording = { query: "", bindings: [] };
  const database = {
    prepare(query) {
      recording.query = query;
      return {
        bind(...bindings) {
          recording.bindings = bindings;
          return {
            async first() {
              return result;
            },
          };
        },
      };
    },
  };
  return { database, recording };
}

test("finds the worker's open shift without restricting it to today's work date", async () => {
  const openShift = {
    id: "overnight-shift",
    state: "working",
    clockInAt: "2026-08-27T07:43:00.000Z",
    breakStartedAt: null,
    breakEndedAt: "2026-08-27T12:15:00.000Z",
    clockOutAt: null,
    projectId: "project-1",
    projectName: "Centro Comercial Costanera Norte",
  };
  const { database, recording } = recordingDatabase(openShift);

  const result = await findOpenShiftForWorker(database, "org-1", "luis-1");

  assert.equal(result, openShift);
  assert.deepEqual(recording.bindings, ["org-1", "luis-1"]);
  assert.match(recording.query, /s\.state <> 'complete'/);
  assert.match(recording.query, /ORDER BY s\.clock_in_at DESC/);
  assert.doesNotMatch(recording.query, /work_date/);
});

test("returns null when the worker has no open shift", async () => {
  const { database } = recordingDatabase(null);
  assert.equal(await findOpenShiftForWorker(database, "org-1", "worker-1"), null);
});
