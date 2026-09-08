const CACHE = 'dg-gestionale-v46-professional-20260904';
const SCOPE_URL = new URL('./', self.registration.scope);
const SCOPE = SCOPE_URL.pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    new URL('login.html', SCOPE_URL).href,
    new URL('dashboard.html', SCOPE_URL).href,
    new URL('viaggi.html', SCOPE_URL).href,
    new URL('prenotazioni.html', SCOPE_URL).href,
    new URL('prenotazione.html', SCOPE_URL).href,
    new URL('clienti.html', SCOPE_URL).href,
    new URL('flotta.html', SCOPE_URL).href,
    new URL('pagamenti.html', SCOPE_URL).href,
    new URL('preventivi.html', SCOPE_URL).href,
    new URL('preventivi-nuovo.html', SCOPE_URL).href,
    new URL('notifiche.html', SCOPE_URL).href,
    new URL('checkin.html', SCOPE_URL).href,
    new URL('statistiche.html', SCOPE_URL).href,
    new URL('impostazioni.html', SCOPE_URL).href,
    new URL('centro-operativo.html', SCOPE_URL).href,
    new URL('manifest.json', SCOPE_URL).href,
    new URL('assets/icon-512.png', SCOPE_URL).href,
    new URL('assets/apple-touch-icon.png', SCOPE_URL).href,
    new URL('assets/logo-sidebar.png', SCOPE_URL).href,
    new URL('assets/dg-v46-professional.css', SCOPE_URL).href,
    new URL('assets/dg-v46-ux.js', SCOPE_URL).href
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
    }).catch(() => caches.match(event.request).then(r => r || caches.match(new URL('login.html', SCOPE_URL).href))));
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
    icon: new URL('assets/icon-512.png', SCOPE_URL).href,
    badge: new URL('assets/icon-512.png', SCOPE_URL).href,
    tag: data.tag || 'dg-booking',
    renotify: true,
    data: { url: data.url || 'prenotazioni.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || 'prenotazioni.html', SCOPE_URL).href;
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
