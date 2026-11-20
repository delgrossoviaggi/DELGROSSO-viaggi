/* DELGROSSO Gestionale - AI 360 recovery-safe
   Navigation is network-first and never stores index.html.
   Only DELGROSSO Gestionale caches are cleaned. */
const CACHE='delgrosso-business-suite-v2-fusion-dg34-20261116';

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>/^delgrosso-(gestionale|business-suite)/i.test(k) && k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;
  // Never intercept or cache authenticated/API actions.
  if(url.pathname.startsWith('/api/')) return;

  if(req.mode==='navigate' || req.destination==='document'){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px"><h2>Connessione non disponibile</h2><p>Riprova quando la rete è disponibile.</p></body>',
      {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
    )));
    return;
  }

  // Assets: network first, fallback cache.
  event.respondWith((async()=>{
    try{
      const res=await fetch(req,{cache:'no-cache'});
      if(res && res.ok){
        const cache=await caches.open(CACHE);
        cache.put(req,res.clone()).catch(()=>{});
      }
      return res;
    }catch(e){
      const cached=await caches.match(req);
      if(cached) return cached;
      throw e;
    }
  })());
});

/* Background Web Push: only notifications sent to an explicitly subscribed device. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }
    const title = String(data.title || 'DELGROSSO VIAGGI');
    const body = String(data.body || 'Nuova notifica dal gestionale').slice(0, 240);
    const destination = new URL('./index.html#prenotazioni', self.registration.scope).href;
    await self.registration.showNotification(title, {
      body, icon: './assets/delgrosso-app-icon-180.png',
      badge: './assets/delgrosso-app-icon-152.png',
      tag: data.tag ? String(data.tag).slice(0, 100) : 'delgrosso-prenotazione',
      data: { url: destination }
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('./index.html#prenotazioni', self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
