/* DELGROSSO Gestionale - AI 360 recovery-safe
   Navigation is network-first and never stores index.html.
   Only DELGROSSO Gestionale caches are cleaned. */
const CACHE='delgrosso-gestionale-v9-delete-payments';

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>/^delgrosso-gestionale-/i.test(k) && k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;

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
