import { expect, test } from "@playwright/test";
import { shiftDateTime, shiftDateTimeToIso } from "../src/lib/shiftDateTime";

const timezone = "Europe/Jersey";

test("organization wall times round-trip in winter, summer and across midnight", () => {
  for (const [iso, wall] of [
    ["2026-01-15T08:15:00.000Z", "2026-01-15T08:15"],
    ["2026-08-24T08:15:00.000Z", "2026-08-24T09:15"],
    ["2026-08-24T23:30:00.000Z", "2026-08-25T00:30"],
  ]) {
    expect(shiftDateTime(iso, timezone)).toBe(wall);
    expect(shiftDateTimeToIso(wall, timezone)).toBe(iso);
  }
  expect(shiftDateTimeToIso("2026-08-24T14:15", "Asia/Kathmandu")).toBe("2026-08-24T08:30:00.000Z");
});

test("unchanged fields retain seconds and the recorded occurrence of autumn's repeated hour", () => {
  for (const original of ["2026-08-24T08:15:42.123Z", "2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]) {
    expect(shiftDateTimeToIso(shiftDateTime(original, timezone), timezone, original)).toBe(original);
  }
  expect(shiftDateTimeToIso("2026-10-25T01:45", timezone, "2026-10-25T01:30:00.000Z")).toBe("2026-10-25T01:45:00.000Z");
});

test("invalid dates and nonexistent spring-forward times are rejected", () => {
  for (const value of ["", "2026-02-30T08:00", "2026-08-24T25:00", "2026-03-29T01:30"]) {
    expect(shiftDateTimeToIso(value, timezone)).toBeNull();
  }
  expect(shiftDateTimeToIso("2026-03-29T02:30", timezone)).toBe("2026-03-29T01:30:00.000Z");
});
