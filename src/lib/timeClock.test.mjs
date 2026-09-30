import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = await import(pathToFileURL(require.resolve("esbuild", { paths: [dirname(require.resolve("lovable-tagger"))] })).href);
const out = await esbuild.build({ entryPoints: [fileURLToPath(new URL("./timeClock.ts", import.meta.url))], bundle: true, format: "esm", platform: "neutral", write: false });
const { formatWorkedDuration } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);

test("E13: the worked-time counter stops 24 hours after clock-in", () => {
  const events = [{ id: "1", type: "clock_in", at: "2026-09-25T08:00:00.000Z" }];
  assert.equal(formatWorkedDuration(events, "working", Date.parse("2026-09-25T10:30:00.000Z")), "2h 30m");
  assert.equal(formatWorkedDuration(events, "working", Date.parse("2026-09-27T08:00:00.000Z")), "24h 00m");
});
