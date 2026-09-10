const CACHE = 'dg-gestionale-v58-dark-readable-20260910';
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
    new URL('noleggi-bus.html', SCOPE_URL).href,
    new URL('manifest.json', SCOPE_URL).href,
    new URL('assets/icon-512.png', SCOPE_URL).href,
    new URL('assets/apple-touch-icon.png', SCOPE_URL).href,
    new URL('assets/logo-sidebar.png', SCOPE_URL).href,
    new URL('assets/dg-v46-professional.css', SCOPE_URL).href,
    new URL('assets/dg-v46-ux.js', SCOPE_URL).href,
    new URL('assets/noleggi-bus-v47.js', SCOPE_URL).href,
    new URL('assets/dg-v47-noleggi.css', SCOPE_URL).href,
    new URL('assets/dg-shell-v41.js', SCOPE_URL).href,
    new URL('assets/dg-shell-v41.css', SCOPE_URL).href,
    new URL('assets/dg-v57-viaggi-fix.css', SCOPE_URL).href,
    new URL('assets/dg-v54-shell.js', SCOPE_URL).href,
    new URL('assets/dg-v54-login.js', SCOPE_URL).href,
    new URL('assets/dg-supabase-sync-v3.js', SCOPE_URL).href,
    new URL('assets/dg-v57-admin-access.js', SCOPE_URL).href,
    new URL('assets/logo-delgrosso-v54.png', SCOPE_URL).href,
    new URL('assets/dg-v58-dark-contrast.css', SCOPE_URL).href,
    new URL('assets/dg-v58-theme.js', SCOPE_URL).href
  ]).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (!url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.includes('/rest/') || url.pathname.includes('/auth/') || url.pathname.includes('/functions/')) return;
  // V48: network-first for every same-origin app asset. Cache is fallback only, so a new deployment
  // cannot remain stuck on an old JS/CSS/HTML version.
  event.respondWith(
    fetch(event.request, {cache:'no-store'}).then(response => {
      if (response && response.ok) caches.open(CACHE).then(c=>c.put(event.request,response.clone())).catch(()=>{});
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || (url.pathname.endsWith('.html') ? caches.match(new URL('login.html',SCOPE_URL).href) : Response.error())))
  );
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
