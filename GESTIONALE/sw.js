// Del Grosso Gestionale - CLEAN STABLE V48.2
// No application caching. This worker only removes old workers/caches and then unregisters itself.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const regs = await self.registration.scope;
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clientsList.forEach(c => { try { c.postMessage({ type: 'DG_SW_CLEAN' }); } catch (_) {} });
  })());
});
self.addEventListener('fetch', () => {});
