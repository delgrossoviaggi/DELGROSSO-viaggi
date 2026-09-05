// Del Grosso Viaggi — ROOT Service Worker neutralizzato.
// Il Gestionale vive esclusivamente in /GESTIONALE/.
//
// Questo worker serve solo a rimuovere il vecchio Service Worker
// Gestionale che era stato registrato sulla root del sito.

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (_) {}

    try {
      await self.registration.unregister();
    } catch (_) {}

    try {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      clientsList.forEach(client => {
        try {
          client.postMessage({ type: 'DG_ROOT_SW_CLEAN' });
        } catch (_) {}
      });
    } catch (_) {}
  })());
});

// NESSUN fetch handler.
// Niente cache.
// Niente intercettazione.
// Root e /GESTIONALE/ vengono serviti direttamente da Vercel.
