const CACHE = 'dg-gestionale-v13-universal';
const SCOPE = '/GESTIONALE/';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    `${SCOPE}login.html`,
    `${SCOPE}dashboard.html`,
    `${SCOPE}viaggi.html`,
    `${SCOPE}prenotazioni.html`,
    `${SCOPE}prenotazione.html`,
    `${SCOPE}clienti.html`,
    `${SCOPE}flotta.html`,
    `${SCOPE}pagamenti.html`,
    `${SCOPE}preventivi.html`,
    `${SCOPE}preventivi-nuovo.html`,
    `${SCOPE}notifiche.html`,
    `${SCOPE}checkin.html`,
    `${SCOPE}statistiche.html`,
    `${SCOPE}impostazioni.html`,
    `${SCOPE}centro-operativo.html`,
    `${SCOPE}manifest.json`,
    `${SCOPE}assets/icon-512.png`,
    `${SCOPE}assets/apple-touch-icon.png`,
    `${SCOPE}assets/logo-sidebar.png`
  ]).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (!url.pathname.startsWith(SCOPE)) return;

  // Never cache API/auth calls. HTML is network-first so deployments are not trapped in stale pages.
  if (url.pathname.includes('/rest/') || url.pathname.includes('/auth/') || url.pathname.includes('/functions/')) return;

  if (url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(event.request).then(r => r || caches.match(`${SCOPE}login.html`))));
    return;
  }

  if (url.pathname.startsWith(`${SCOPE}assets/`) || url.pathname.endsWith('/manifest.json')) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    })));
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    data = { title: 'Del Grosso Viaggi', body: event.data ? event.data.text() : 'Nuova notifica' };
  }
  const title = data.title || 'Nuova prenotazione';
  const options = {
    body: data.body || 'È arrivata una nuova prenotazione.',
    icon: '/GESTIONALE/assets/icon-512.png',
    badge: '/GESTIONALE/assets/icon-512.png',
    tag: data.tag || 'dg-booking',
    renotify: true,
    data: { url: data.url || '/GESTIONALE/prenotazioni.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/GESTIONALE/prenotazioni.html', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        client.navigate(target).catch(() => {});
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
