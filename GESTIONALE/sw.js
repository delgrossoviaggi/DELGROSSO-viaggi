/* DEL GROSSO GESTIONALE — SYNC BUILD 152 */
const CACHE=`dg-gestionale-sync-152`;
const BASE=new URL(`./`,self.registration.scope);
const PRECACHE=[
 `login.html`,`index.html`,`dashboard.html`,`viaggi.html`,`prenotazioni.html`,`prenotazione.html`,`clienti.html`,`dossier-cliente.html`,`flotta.html`,`pagamenti.html`,`preventivi.html`,`preventivi-nuovo.html`,`notifiche.html`,`checkin.html`,`statistiche.html`,`impostazioni.html`,`centro-operativo.html`,`noleggi-bus.html`,`agenda.html`,`archivio.html`,`economia.html`,`setup-amministratori.html`,
 `assets/dg-supabase-sync-v4.js`,`assets/settingsService-SYNC152.js`,`assets/prenotazioni-SYNC152.js`,`manifest.json`
];
const network=async(req)=>{const r=await fetch(req,{cache:`no-store`});if(r?.ok){const c=await caches.open(CACHE);c.put(req,r.clone()).catch(()=>{});}return r};
self.addEventListener(`install`,e=>e.waitUntil(caches.open(CACHE).then(c=>Promise.all(PRECACHE.map(x=>c.add(new URL(x,BASE).href).catch(()=>{})))).then(()=>self.skipWaiting())));
self.addEventListener(`activate`,e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener(`fetch`,e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!==`GET`||!u.pathname.startsWith(BASE.pathname))return;if(/\/rest\/|\/auth\/|\/functions\//.test(u.pathname))return;e.respondWith(network(e.request).catch(()=>caches.match(e.request).then(r=>r||Response.error())))});
self.addEventListener(`push`,e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={title:`Del Grosso Viaggi`,body:e.data?e.data.text():`Nuova notifica`}}e.waitUntil(self.registration.showNotification(d.title||`Nuova prenotazione`,{body:d.body||`È arrivata una nuova notifica.`,icon:new URL(`assets/icon-512.png`,BASE).href,badge:new URL(`assets/icon-512.png`,BASE).href,tag:d.tag||`dg-booking`,renotify:true,data:{url:d.url||`prenotazioni.html`}}))});
self.addEventListener(`notificationclick`,e=>{e.notification.close();const t=new URL(e.notification.data?.url||`prenotazioni.html`,BASE).href;e.waitUntil(clients.matchAll({type:`window`,includeUncontrolled:true}).then(list=>{for(const c of list){if(`focus`in c){c.navigate(t).catch(()=>{});return c.focus()}}return clients.openWindow(t)}))});
