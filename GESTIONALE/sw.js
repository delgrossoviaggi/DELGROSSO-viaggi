const CACHE = 'dg-gestionale-v50-critical-booking-fix-20260905';
const SCOPE_URL = new URL('./', self.registration.scope);
const SCOPE = SCOPE_URL.pathname;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
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
    ]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (!url.pathname.startsWith(SCOPE)) return;

  // Never cache Supabase REST/Auth/Edge Functions traffic.
  if (url.pathname.includes('/rest/') || url.pathname.includes('/auth/') || url.pathname.includes('/functions/')) return;

  // Network-first for all app HTML/assets: prevents an old hashed JS bundle from
  // being served forever after a deployment. Fall back to cache only when offline.
  if (url.pathname.endsWith('.html') || url.pathname.startsWith(`${SCOPE}assets/`) || url.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() =>
        caches.match(event.request).then(r => r || (url.pathname.endsWith('.html')
          ? caches.match(new URL('login.html', SCOPE_URL).href)
          : Response.error()))
      )
    );
  }
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Del Grosso Gestionale';
  const options = {
    body: data.body || 'Hai una nuova notifica.',
    icon: data.icon || './assets/icon-512.png',
    badge: data.badge || './assets/icon-512.png',
    data: data.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow('./dashboard.html');
  }));
});
