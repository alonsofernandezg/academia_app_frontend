const STATIC_CACHE = "deportiva-static-v20260528a";
const PAGE_CACHE = "deportiva-pages-v20260528a";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./stats.html",
  "./reset.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/config.js",
  "./js/app.js",
  "./js/reset.js",
  "./js/stats.js",
  "./js/dashboard-common.js",
  "./js/dashboard.js",
  "./js/dashboard-users.js",
  "./js/dashboard-coach-assignments.js",
  "./js/dashboard-athletes.js",
  "./js/dashboard-maintenance.js",
  "./js/dashboard-operations.js",
  "./js/dashboard-reports.js",
  "./js/dashboard-billing.js",
  "./js/dashboard-communications.js",
  "./js/coaches.js",
  "./js/callups.js",
  "./js/pwa.js",
  "./images/deportiva-logo.png",
  "./favicon-16x16.png",
  "./favicon-32x32.png",
  "./favicon.ico",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./pwa-192x192.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![STATIC_CACHE, PAGE_CACHE].includes(key))
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (
      await caches.match(request, { ignoreSearch: true }) ||
      await caches.match("./index.html", { ignoreSearch: true })
    );
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});