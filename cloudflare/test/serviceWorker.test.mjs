import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

function serviceWorkerHarness(fetchImplementation) {
  const listeners = new Map();
  const entries = new Map();
  const cache = {
    async addAll() {},
    async put(key, response) {
      entries.set(typeof key === "string" ? key : key.url, response);
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
    clients: { claim() {} },
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchImplementation, Response, Promise, console });

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

  return { dispatchFetch, entries };
}

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
