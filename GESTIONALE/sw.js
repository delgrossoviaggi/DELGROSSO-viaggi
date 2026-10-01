const CACHE='delgrosso-gestionale-pwa-v54-safe-v7-1';
const OPTIONAL=['./assistente360.js','./manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of OPTIONAL){
      try{
        const r=await fetch(url,{cache:'no-store'});
        if(r.ok) await cache.put(url,r.clone());
      }catch(e){}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

async function navigation(request){
  try{
    const r=await fetch(request,{cache:'no-store'});
    if(!r.ok) return r;
    let html=await r.text();
    if(!html.includes('assistente360.js')){
      html=html.replace('</body>','<script src="./assistente360.js?v=7.1"></script></body>');
    }
    const headers=new Headers(r.headers);
    headers.set('Cache-Control','no-store, no-cache, must-revalidate');
    return new Response(html,{status:r.status,statusText:r.statusText,headers});
  }catch(e){
    const cached=await caches.match(request);
    if(cached) return cached;
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>DELGROSSO</title><body style="font-family:system-ui;padding:24px"><h2>DELGROSSO Gestionale</h2><p>Connessione non disponibile. Riprova quando sei online.</p></body>',
      {headers:{'Content-Type':'text/html; charset=utf-8'}}
    );
  }
}

self.addEventListener('fetch',event=>{
  const r=event.request;
  if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(u.origin!==self.location.origin) return;

  if(r.mode==='navigate'||r.destination==='document'){
    event.respondWith(navigation(r));
    return;
  }

  if(u.pathname.endsWith('/assistente360.js')){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(r,{cache:'no-store'});
        if(fresh.ok){
          const c=await caches.open(CACHE);
          await c.put(r,fresh.clone());
        }
        return fresh;
      }catch(e){
        return (await caches.match(r)) || new Response('',{status:503});
      }
    })());
  }
});
