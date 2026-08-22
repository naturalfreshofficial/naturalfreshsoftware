const CACHE_NAME = "naturalfresh-v1.0.2";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/pos-billing",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/app-icon.png",
  "/app-icon.jpeg",
  "/logo.png",
  "/favicon.ico"
];



// Install Event
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Pre-caching partial assets failure:", err);
      });
    })
  );
});

// Activate Event: Clear old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for SKIP_WAITING message
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch Event: Network-first for dynamic API & Firestore, Cache-first for static icons/assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and firestore/descope API calls from cache interception
  if (
    request.method !== "GET" ||
    url.origin.includes("firestore.googleapis.com") ||
    url.origin.includes("descope.com") ||
    url.origin.includes("identitytoolkit.googleapis.com") ||
    url.protocol.startsWith("chrome-extension")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (request.mode === "navigate") {
            return caches.match("/pos-billing") || caches.match("/");
          }
        });
      })
  );
});
