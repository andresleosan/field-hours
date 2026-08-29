import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { runProductionHealthChecks } from "./production-health.mjs";

let origin;
let server;

before(async () => {
  server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, {
        "Content-Security-Policy": "default-src 'self'; object-src 'none'",
        "Strict-Transport-Security": "max-age=31536000",
        "X-Content-Type-Options": "nosniff",
      });
      response.end("ok");
      return;
    }
    if (request.url === "/api/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "field-hours-api" }));
      return;
    }
    if (request.url === "/api/worker/today" || request.url === "/api/admin/payroll-runs") {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "UNAUTHENTICATED" }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("monitor accepts healthy frontend, API and auth boundaries", async () => {
  const report = await runProductionHealthChecks({ appOrigin: origin, workerOrigin: origin, retries: 1 });
  assert.equal(report.ok, true);
  assert.equal(report.results.length, 5);
  assert(report.results.every((result) => result.ok));
});

test("monitor reports a failed contract without throwing", async () => {
  const report = await runProductionHealthChecks({
    appOrigin: origin,
    workerOrigin: `${origin}/missing-prefix`,
    retries: 1,
  });
  assert.equal(report.ok, false);
  assert(report.results.some((result) => !result.ok));
});
