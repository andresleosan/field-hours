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
    if (request.url === "/manifest.webmanifest") {
      response.writeHead(200, { "Content-Type": "application/manifest+json" });
      response.end(JSON.stringify({
        display: "standalone",
        icons: [{ src: "/pwa-icon-192.png" }, { src: "/pwa-icon-512.png" }],
      }));
      return;
    }
    if (request.url === "/sw.js") {
      response.writeHead(200, { "Content-Type": "application/javascript" });
      response.end("const CACHE_NAME = 'field-hours-v4'; const ASSETS = ['/']; self.addEventListener('fetch', () => {});");
      return;
    }
    if (request.url === "/pwa-icon-192.png" || request.url === "/pwa-icon-512.png") {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end("png");
      return;
    }
    if (
      request.url === "/api/worker/today"
      || (
        request.url === "/api/admin/salary-advice"
        && request.method === "POST"
        && request.headers.origin === origin
      )
    ) {
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
  assert.equal(report.results.length, 10);
  assert(report.results.every((result) => result.ok));
  assert.equal(report.results.find((result) => result.name === "retired payroll review route")?.status, 404);
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
