const CACHE = 'delgrosso-gestionale-pwa-v8-maxperf';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/delgrosso-app-icon-180.png',
  './assets/delgrosso-app-icon-152.png',
  './assets/delgrosso-app-icon-512.png',
  './assets/delgrosso-app-icon-1024.png',
  './assets/delgrosso-logo-iphone-ui.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never interfere with Supabase/Auth/REST traffic.
  if (url.origin !== self.location.origin ||
      url.pathname.includes('/rest/v1/') ||
      url.pathname.includes('/auth/v1/') ||
      url.pathname.includes('/storage/v1/') ||
      url.pathname.includes('/realtime/')) {
    return;
  }

  // HTML/navigation: network first, cached shell as offline fallback.
  if (request.mode === 'navigate' ||
      request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: cache first, then network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
