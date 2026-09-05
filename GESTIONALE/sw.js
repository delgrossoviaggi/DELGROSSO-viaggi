// Del Grosso Gestionale V50.2 — no app-shell caching.
// The browser must always receive the currently deployed HTML/assets.
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", event => {
  // Intentionally do not intercept requests. Supabase/API and app assets go direct to network.
});
