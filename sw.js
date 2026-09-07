// DELGROSSO VIAGGI — V51: no application cache.
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{try{for(const k of await caches.keys())await caches.delete(k)}catch{}try{await self.registration.unregister()}catch{}})()));
