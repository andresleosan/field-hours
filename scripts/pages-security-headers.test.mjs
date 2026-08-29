import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pagesWorker from "../public/_worker.js";

const vercelConfig = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
);
const expectedHeaders = new Map(
  vercelConfig.headers
    .find(({ source }) => source === "/(.*)")
    .headers.map(({ key, value }) => [key.toLowerCase(), value]),
);
expectedHeaders.set(
  "strict-transport-security",
  "max-age=63072000; includeSubDomains; preload",
);

test("Pages static responses preserve asset metadata and match Vercel security headers", async () => {
  const assetResponse = new Response("app", {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
  const env = {
    ASSETS: {
      fetch: async () => assetResponse,
    },
  };

  const response = await pagesWorker.fetch(
    new Request("https://field-hours-staging.pages.dev/"),
    env,
  );

  assert.equal(await response.text(), "app");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  for (const [name, value] of expectedHeaders) {
    assert.equal(response.headers.get(name), value, `${name} must match vercel.json`);
  }
});

test("Pages API proxy preserves the backend response without static header overrides", async () => {
  const originalFetch = globalThis.fetch;
  let forwardedRequest;
  globalThis.fetch = async (request) => {
    forwardedRequest = request;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await pagesWorker.fetch(
      new Request("https://field-hours-staging.pages.dev/api/health"),
      { ASSETS: { fetch: async () => assert.fail("API route reached static assets") } },
    );

    assert.equal(
      new URL(forwardedRequest.url).hostname,
      "field-hours-api-staging.andres-san1404.workers.dev",
    );
    assert.equal(response.headers.get("content-security-policy"), null);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
