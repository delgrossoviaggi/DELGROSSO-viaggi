
import {fleet,carousel,gallery,settings,esc,publicAsset} from './site.js';
import {getTrips} from './gestionale.js';
const imgFallback='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80';
const money=v=>Number(v||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const date=v=>v?new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'Data da definire';
async function home(){
 const [c,f,t,g,s]=await Promise.allSettled([carousel(),fleet(),getTrips(),gallery(),settings()]);
 const car=c.status==='fulfilled'?c.value:[], fl=f.status==='fulfilled'?f.value:[], tr=t.status==='fulfilled'?t.value:[], ga=g.status==='fulfilled'?g.value:[], st=s.status==='fulfilled'?s.value[0]:null;
 if(st){document.querySelectorAll('[data-phone]').forEach(e=>e.textContent=st.telefono||'320 573 0466');document.querySelectorAll('[data-whatsapp]').forEach(e=>e.href=`https://wa.me/${st.whatsapp||'393205730466'}`)}
 const hero=document.querySelector('#heroVisual');
 const heroImages=car.flatMap(x=>Array.isArray(x.foto_urls)?x.foto_urls:[]).filter(Boolean);
 if(heroImages.length){hero.style.backgroundImage=`linear-gradient(160deg,rgba(16,19,35,.12),rgba(16,19,35,.9)),url('${heroImages[0]}')`}
 const tg=document.querySelector('#homeTrips'); if(tg) tg.innerHTML=tr.slice(0,3).map(t=>`<article class="card"><div class="media"><img src="${esc(t.locandina||imgFallback)}" onerror="this.src='${imgFallback}'"><span class="badge">${esc(t.destinazione||'Prossima partenza')}</span></div><div class="card-body"><span class="kicker">${date(t.data_partenza)}</span><h3>${esc(t.titolo||'Viaggio Del Grosso')}</h3><div class="meta"><span>🕒 ${esc(t.ora_partenza||'—')}</span><span>💺 ${Number(t.posti_liberi||0)} posti</span></div><div class="card-foot"><div><span class="muted">A persona</span><div class="price">${money(t.prezzo)}</div></div><a class="outline" href="prenota.html?viaggio=${encodeURIComponent(t.id)}">Prenota →</a></div></div></article>`).join('')||'<div class="status">Nessuna partenza pubblicata al momento.</div>';
 const fg=document.querySelector('#homeFleet'); if(fg) fg.innerHTML=fl.slice(0,3).map(v=>`<article class="card"><div class="media"><img src="${esc(publicAsset(v)||imgFallback)}" onerror="this.src='${imgFallback}'"><span class="badge">${esc(v.categoria||'Flotta')}</span></div><div class="card-body"><h3>${esc(v.titolo||'Mezzo Del Grosso')}</h3><p class="muted">${esc(v.descrizione||'Comfort, sicurezza e qualità per ogni viaggio.')}</p><div class="card-foot"><span class="muted">${esc(v.posti||'')} posti</span><a class="outline" href="flotta.html">Scopri →</a></div></div></article>`).join('')||'<div class="status">La flotta verrà mostrata qui.</div>';
 const gg=document.querySelector('#homeGallery'); if(gg) gg.innerHTML=ga.slice(0,3).flatMap(e=>(e.foto_urls||[]).slice(0,1).map(u=>`<article class="card"><div class="media"><img src="${esc(u)}" alt="${esc(e.titolo||'Evento')}" loading="lazy"></div><div class="card-body"><span class="tag">${date(e.data_evento)}</span><h3>${esc(e.titolo||'Momenti Del Grosso')}</h3></div></article>`)).join('')||'';
}
if(document.body.dataset.page==='home')home().catch(console.error);
