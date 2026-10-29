import assert from "node:assert/strict";
import test from "node:test";
import { periodDateRange } from "./shiftDateTime.ts";

const tz = "Europe/Jersey";
test("E2: period ranges use the organization calendar, not UTC", () => {
  // 00:30 BST on Wed 30 Sep 2026 is still 29 Sep in UTC.
  const now = new Date("2026-09-29T23:30:00Z");
  assert.deepEqual(periodDateRange("today", tz, now), { start: "2026-09-30", end: "2026-09-30" });
  assert.deepEqual(periodDateRange("this_month", tz, now), { start: "2026-09-01", end: "2026-09-30" });
  assert.deepEqual(periodDateRange("this_week", tz, now), { start: "2026-09-28", end: "2026-09-30" });
  assert.deepEqual(periodDateRange("last_week", tz, now), { start: "2026-09-21", end: "2026-09-27" });
  // Sunday belongs to the week that started on Monday.
  assert.deepEqual(periodDateRange("this_week", tz, new Date("2026-10-04T12:00:00Z")), { start: "2026-09-28", end: "2026-10-04" });
  assert.deepEqual(periodDateRange("all", tz, now), { start: undefined, end: undefined });
});
