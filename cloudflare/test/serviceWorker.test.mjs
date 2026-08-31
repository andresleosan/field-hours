import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

test("Android install manifest exposes real PNG icons at the declared sizes", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");

  for (const size of [192, 512]) {
    const icon = manifest.icons.find((entry) => entry.src === `/pwa-icon-${size}.png`);
    assert.ok(icon, `missing ${size}px PNG icon`);
    assert.equal(icon.type, "image/png");
    assert.match(icon.purpose, /maskable/);
    const bytes = await readFile(new URL(`../../public/pwa-icon-${size}.png`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});

function serviceWorkerHarness(fetchImplementation, serviceWorkerSource = source) {
  const listeners = new Map();
  const entries = new Map();
  let installedUrls = [];
  const cache = {
    async addAll(urls) {
      installedUrls = [...urls];
      for (const url of urls) entries.set(url, new Response(`cached:${url}`, { status: 200 }));
    },
    async put(key, response) {
      entries.set(typeof key === "string" ? key : key.url, response);
    },
    async keys() {
      return [...entries.keys()].map((key) => ({
        url: new URL(key, "https://field-hours.vercel.app").href,
        cacheKey: key,
      }));
    },
    async delete(key) {
      const raw = key.cacheKey ?? key.url ?? key;
      const pathname = typeof raw === "string" && raw.startsWith("http") ? new URL(raw).pathname : raw;
      return entries.delete(pathname) || entries.delete(raw);
    },
  };
  const caches = {
    async open() { return cache; },
    async keys() { return ["field-hours-v1", "field-hours-v2"]; },
    async delete() { return true; },
    async match(key) { return entries.get(typeof key === "string" ? key : key.url); },
  };
  const self = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    skipWaiting() {},
    location: { origin: "https://field-hours.vercel.app" },
    clients: { claim() {} },
  };
  vm.runInNewContext(serviceWorkerSource, { self, caches, fetch: fetchImplementation, Response, URL, Promise, Set, console });

  async function dispatchInstall() {
    const waits = [];
    listeners.get("install")({ waitUntil(value) { waits.push(Promise.resolve(value)); } });
    await Promise.all(waits);
  }

  async function dispatchActivate() {
    const waits = [];
    listeners.get("activate")({ waitUntil(value) { waits.push(Promise.resolve(value)); } });
    await Promise.all(waits);
  }

  async function dispatchFetch(request) {
    let responsePromise;
    const waits = [];
    listeners.get("fetch")({
      request,
      respondWith(value) { responsePromise = Promise.resolve(value); },
      waitUntil(value) { waits.push(Promise.resolve(value)); },
    });
    const response = responsePromise ? await responsePromise : null;
    await Promise.all(waits);
    return response;
  }

  return { dispatchFetch, dispatchInstall, dispatchActivate, entries, get installedUrls() { return installedUrls; } };
}

test("production-injected hashed bundles are precached on first installation", async () => {
  const injected = source.replace(
    "/* __PWA_BUILD_ASSETS__ */ []",
    '["/assets/index-a1b2.js","/assets/index-c3d4.css","/assets/route-e5f6.js"]',
  );
  const harness = serviceWorkerHarness(async () => new Response("network"), injected);
  await harness.dispatchInstall();
  for (const asset of ["/assets/index-a1b2.js", "/assets/index-c3d4.css", "/assets/route-e5f6.js"]) {
    assert.ok(harness.installedUrls.includes(asset));
    assert.ok(harness.entries.has(asset));
  }
});

test("activation purges hashed assets that are no longer in the current build", async () => {
  const injected = source.replace(
    "/* __PWA_BUILD_ASSETS__ */ []",
    '["/assets/current.js"]',
  );
  const harness = serviceWorkerHarness(async () => new Response("network"), injected);
  harness.entries.set("/assets/retired.js", new Response("old"));
  await harness.dispatchInstall();
  await harness.dispatchActivate();
  assert.ok(harness.entries.has("/assets/current.js"));
  assert.equal(harness.entries.has("/assets/retired.js"), false);
});

test("PWA navigation prefers the current network shell and refreshes the offline fallback", async () => {
  const harness = serviceWorkerHarness(async () => new Response("fresh-shell", { status: 200 }));
  harness.entries.set("/index.html", new Response("stale-shell", { status: 200 }));

  const response = await harness.dispatchFetch({
    method: "GET",
    mode: "navigate",
    url: "https://field-hours.vercel.app/clock",
  });

  assert.equal(await response.text(), "fresh-shell");
  assert.equal(await harness.entries.get("/index.html").text(), "fresh-shell");
});

test("PWA navigation uses the cached shell only when the network is unavailable", async () => {
  const harness = serviceWorkerHarness(async () => { throw new TypeError("offline"); });
  harness.entries.set("/index.html", new Response("offline-shell", { status: 200 }));

  const response = await harness.dispatchFetch({
    method: "GET",
    mode: "navigate",
    url: "https://field-hours.vercel.app/clock",
  });

  assert.equal(await response.text(), "offline-shell");
});

test("service worker never intercepts API writes", async () => {
  const harness = serviceWorkerHarness(async () => new Response("unexpected"));
  const response = await harness.dispatchFetch({
    method: "POST",
    mode: "cors",
    url: "https://field-hours.vercel.app/api/shift/action",
  });
  assert.equal(response, null);
});

test("an offline JS or CSS miss never receives the cached HTML shell", async () => {
  const harness = serviceWorkerHarness(async () => { throw new TypeError("offline"); });
  harness.entries.set("/", new Response("html-shell", { status: 200, headers: { "content-type": "text/html" } }));
  const response = await harness.dispatchFetch({
    method: "GET",
    mode: "cors",
    url: "https://field-hours.vercel.app/assets/missing.js",
  });
  assert.equal(response.type, "error");
  assert.notEqual(await response.text(), "html-shell");
});
