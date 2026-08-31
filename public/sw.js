const CACHE_NAME = "field-hours-v4";
const BUILD_ASSET_URLS = /* __PWA_BUILD_ASSETS__ */ [];
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-icon.svg",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/favicon.ico",
];
const INSTALL_URLS = [...new Set([...PRECACHE_URLS, ...BUILD_ASSET_URLS])];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(INSTALL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    const current = await caches.open(CACHE_NAME);
    const allowed = new Set(INSTALL_URLS.map((url) => new URL(url, self.location.origin).href));
    const requests = await current.keys();
    await Promise.all(requests
      .filter((request) => !allowed.has(request.url))
      .map((request) => current.delete(request)));
  })());
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Navigation must prefer the network so an installed PWA cannot keep serving
  // an old application shell after a release. The cache remains an offline-only
  // fallback for field use.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", networkResponse.clone())),
            );
          }
          return networkResponse;
        })
        .catch(async () => (await caches.match("/index.html")) ?? Response.error()),
    );
    return;
  }

  // Hashed static assets can use stale-while-revalidate. Keep the refresh tied
  // to the fetch event so the runtime does not discard a floating promise.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        const refresh = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              return caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        event.waitUntil(refresh);
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone())),
            );
          }
          return networkResponse;
        })
        .catch(() => Response.error());
    }),
  );
});
