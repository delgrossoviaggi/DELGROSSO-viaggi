const SUPABASE_URL='https://bhsanrbadsqcpbtxupmr.supabase.co';
const SUPABASE_KEY='sb_publishable_jcc3RIJmNnXZdhcmFuIKFg_EpxO_rBp';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const media=arr=>Array.isArray(arr)?arr:[];
const fmtDate=d=>d?new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')):'';
function headerActive(){const p=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('.navlinks a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===p));const h=document.querySelector('.site-header');const sync=()=>h?.classList.toggle('scrolled',scrollY>25);sync();window.addEventListener('scroll',sync,{passive:true});}
function mobileNav(){const b=document.querySelector('.mobile-toggle'),n=document.querySelector('.navlinks');if(!b||!n)return;b.setAttribute('aria-expanded','false');b.onclick=()=>{const open=n.classList.toggle('mobile-open');b.setAttribute('aria-expanded',String(open));b.textContent=open?'✕':'☰';};n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('mobile-open');b.setAttribute('aria-expanded','false');b.textContent='☰';}));document.addEventListener('click',e=>{if(!n.contains(e.target)&&!b.contains(e.target)){n.classList.remove('mobile-open');b.setAttribute('aria-expanded','false');b.textContent='☰';}});}
async function loadSettings(){let {data}=await sb.from('site_settings').select('*').eq('id',1).maybeSingle();if(!data){let r=await sb.from('info_azienda').select('*').eq('id',1).maybeSingle();data=r.data?{company_name:r.data.nome,phone:r.data.telefono,whatsapp:r.data.whatsapp,email:r.data.email,address:r.data.indirizzo,instagram:r.data.instagram,facebook:r.data.facebook}:null;}return data||{};}
function applySettings(s){document.querySelectorAll('[data-setting]').forEach(el=>{const k=el.dataset.setting;if(s[k]){if(el.tagName==='A'&&(k==='phone'||k==='whatsapp'||k==='email'))el.href=k==='email'?`mailto:${s[k]}`:k==='whatsapp'?`https://wa.me/${String(s[k]).replace(/\D/g,'')}`:`tel:${String(s[k]).replace(/\s/g,'')}`;el.textContent=el.textContent.trim()&&k==='whatsapp'?'WhatsApp':s[k];}})}
function fleetCard(x,home=false){const imgs=media(x.gallery_urls);const cover=x.cover_url||imgs[0]||'';if(home)return `<a class="fleet-photo-card" href="flotta.html?bus=${encodeURIComponent(x.id)}" aria-label="Scopri ${esc(x.title)}"><img loading="lazy" src="${esc(cover)}" alt="${esc(x.title)}"><span class="fleet-open" aria-hidden="true">↗</span></a>`;return `<a class="fleet-card fleet-card-link" href="flotta.html?bus=${encodeURIComponent(x.id)}"><img loading="lazy" src="${esc(cover)}" alt="${esc(x.title)}"><div class="fleet-info"><h3>${esc(x.title)}</h3><p>${esc(x.description||'')} ${x.seats?`· ${x.seats} posti`:''}</p><span class="fleet-more">Vedi mezzo e galleria →</span></div></a>`;}
async function home(){
 const [c,v,f,p,posts]=await Promise.all([sb.from('carousel_home').select('*').eq('pubblicato',true).order('sort_order').order('created_at',{ascending:false}),getGestionaleTrips().then(x=>x.slice(0,6)),sb.from('site_fleet').select('*').eq('published',true).order('sort_order').order('created_at').limit(6),sb.from('site_party_events').select('*').eq('published',true).order('sort_order').order('created_at',{ascending:false}).limit(4),sb.from('site_posts').select('*').eq('published',true).order('sort_order').order('published_at',{ascending:false}).limit(3)]);
 const imgs=(c.data||[]).flatMap(x=>media(x.foto_urls)).filter(Boolean);const hero=document.querySelector('#heroMedia');if(hero){hero.innerHTML=imgs.length?imgs.map((u,i)=>`<img src="${esc(u)}" ${i?'loading="lazy"':''} class="${i?'':'show'}" alt="Del Grosso Viaggi">`).join(''):'<div class="hero-fallback"></div>';let i=0,els=[...hero.querySelectorAll('img')];if(els.length>1)setInterval(()=>{els[i]?.classList.remove('show');i=(i+1)%els.length;els[i]?.classList.add('show')},6000);}
 const tripsData=Array.isArray(v)?v:(v.data||[]);window.__dgTrips=tripsData;
 const dr=document.querySelector('#destinationRail');if(dr){const seen=new Map();tripsData.forEach(t=>{const name=(t.destinazione||t.titolo||'').trim();if(name&&!seen.has(name))seen.set(name,t)});const destinations=[...seen.entries()].slice(0,4);dr.innerHTML=destinations.length?destinations.map(([name,t])=>{const im=tripImage(t);return `<a class="destination-card" href="viaggi.html?dest=${encodeURIComponent(name)}">${im?`<img loading="lazy" src="${esc(im)}" alt="${esc(name)}">`:''}<div class="destination-copy"><small>Prossima esperienza</small><strong>${esc(name)}</strong><span>Scopri le partenze →</span></div></a>`}).join(''):'<div class="empty">Nuove destinazioni in arrivo.</div>';}
 const smartDest=document.querySelector('#smartDestination'),smartDate=document.querySelector('#smartDate'),smartAvail=document.querySelector('#smartAvailability');
 if(tripsData.length){const next=tripsData[0],a=gestTripAvailability(next);smartDest&&(smartDest.textContent=next.destinazione||next.titolo||'Prossima destinazione');smartDate&&(smartDate.textContent=fmtDate(next.data_partenza));smartAvail&&(smartAvail.innerHTML=`<span class="live-dot"></span>${a.soldOut?'Ultima disponibilità esaurita':'Disponibilità live'}`);const nx=document.querySelector('#nextExperience');if(nx){const ni=tripImage(next);nx.innerHTML=`<a class="next-experience-card" href="viaggio.html?id=${encodeURIComponent(next.id)}">${ni?`<img src="${esc(ni)}" alt="${esc(tripTitle(next))}">`:''}<div class="next-experience-shade"></div><div class="next-experience-copy"><div class="kicker">PROSSIMA ESPERIENZA · ${esc(tripCountdown(next.data_partenza,String(next.ora_partenza||'').slice(0,5)))}</div><h3>${esc(tripTitle(next))}</h3><p>${esc(next.destinazione||'Scopri la prossima partenza')}</p><span>Apri la scheda completa ↗</span></div><div class="next-experience-date"><b>${esc(String(next.data_partenza||'').slice(8,10)||'—')}</b><small>${esc(String(next.data_partenza||'').slice(5,7)||'')}</small></div></a>`;}}
 const tg=document.querySelector('#tripGrid');if(tg)tg.innerHTML=tripsData.length?tripsData.map(x=>tripCard(x)).join(''):`<div class="empty" style="grid-column:1/-1">Nessuna partenza pubblicata al momento.</div>`;startTripAutoRefresh('#tripGrid',6);
 const fg=document.querySelector('#fleetGrid');if(fg)fg.innerHTML=(f.data||[]).length?(f.data||[]).map(x=>fleetCard(x,true)).join(''):`<div class="empty">Flotta in aggiornamento.</div>`;
 const pe=document.querySelector('#partyPreview');if(pe){const first=(p.data||[])[0];pe.innerHTML=first?`<div class="party-feature"><div class="party-copy"><div class="eyebrow">Party on the Road</div><h2>${esc(first.title)}</h2><p>${esc(first.description||'Un’esperienza diversa, esclusiva e tutta da vivere a bordo.')}</p><div class="actions"><a class="btn btn-primary" href="partyontheroad.html">Scopri l'esperienza</a></div></div><div class="party-image" style="background-image:url('${esc(first.cover_url||media(first.gallery_urls)[0]||'')}')"></div></div>`:`<div class="empty">Nuovi eventi in arrivo.</div>`;}
 const pg=document.querySelector('#postGrid');if(pg)pg.innerHTML=(posts.data||[]).length?posts.data.map(x=>`<a class="news-card" href="news.html?id=${encodeURIComponent(x.id)}"><div class="news-card-img"><img loading="lazy" src="${esc(x.cover_url||'')}" alt="${esc(x.title)}"><span class="news-arrow">↗</span></div><div class="news-card-body"><div class="trip-date">${esc(x.category||'News')} · ${esc(fmtDate((x.published_at||'').slice(0,10)))}</div><h3>${esc(x.title)}</h3><p>${esc(x.excerpt||'Scopri la news completa.')}</p><span class="news-read">Leggi la news →</span></div></a>`).join(''):`<div class="empty" style="grid-column:1/-1">Nessuna news pubblicata al momento.</div>`;
 applySettings(await loadSettings());
}
function tripImage(x){return x.locandina||x.immagine||x.cover_url||x.foto_url||'';}
function tripTitle(x){return x.titolo||x.destinazione||'Partenza Del Grosso';}
function tripField(x,...keys){for(const k of keys){if(x?.[k]!==undefined&&x?.[k]!==null&&String(x[k]).trim()!=='')return x[k]}return ''}
function tripCountdown(date,time=''){if(!date)return '';const t=String(time||'').slice(0,5);const d=new Date(`${date}T${t||'23:59'}:00`);if(Number.isNaN(d.getTime()))return '';const diff=d-new Date();if(diff<=0)return 'Partenza in corso';const days=Math.floor(diff/86400000),hours=Math.floor((diff%86400000)/3600000);return days>1?`Tra ${days} giorni`:days===1?'Domani':`Tra ${hours} ore`;}
function tripLongDate(d){if(!d)return '';return new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${d}T12:00:00`));}
function tripIcon(type){const icons={pin:'⌖',clock:'◷',bus:'▣',seat:'♢',price:'€',spark:'✦'};return icons[type]||'•';}
function tripCard(x){
 const a=typeof gestTripAvailability==='function'?gestTripAvailability(x):{soldOut:Number(x.posti_liberi??0)<=0,total:Number(x.posti_totali??0),free:Number(x.posti_liberi??0)};
 const sold=a.soldOut,free=a.free,total=a.total,occupied=total?Math.max(0,Math.min(total,total-free)):0,pct=total?Math.round((occupied/total)*100):0;
 const img=tripImage(x),title=tripTitle(x),date=String(x.data_partenza||''),day=date.slice(8,10),mon=date.slice(5,7);
 const time=String(x.ora_partenza||'').slice(0,5),place=tripField(x,'luogo_partenza','punto_ritrovo','ritrovo','partenza');
 const price=(x.prezzo!==undefined&&x.prezzo!==null&&x.prezzo!=='')?`€ ${Number(x.prezzo).toFixed(0)}`:'Su richiesta';
 const status=sold?'SOLD OUT':free<=10?'ULTIMI POSTI':(x.stato||'CONFERMATO');
 const countdown=tripCountdown(x.data_partenza,time);
 return `<article class="trip-card ${sold?'is-soldout':''}" data-trip-id="${esc(x.id)}">
  <a class="trip-card-click" href="viaggio.html?id=${encodeURIComponent(x.id)}" aria-label="Scopri ${esc(title)}">
   <div class="trip-img">${img?`<img loading="lazy" src="${esc(img)}" alt="${esc(title)}">`:'<div class="trip-img-placeholder">DELGROSSO<br>VIAGGI</div>'}
    <div class="trip-floating-date"><span>${esc(day||'—')}</span><small>${esc(mon||'')}</small></div>
    <div class="trip-card-topline"><span class="trip-live-pill"><i></i> LIVE</span><span class="trip-status ${sold?'sold':free<=10?'soon':''}">${esc(status)}</span></div>
    <div class="trip-card-destination"><span>DESTINAZIONE</span><b>${esc(x.destinazione||title)}</b></div>
    ${sold?`<div class="soldout-overlay"><span>SOLD OUT</span><small>POSTI ESAURITI</small></div>`:''}
   </div>
  </a>
  ${sold?'<div class="soldout-strip">SOLD OUT · VIAGGIO AL COMPLETO</div>':''}
  <div class="trip-body">
   <div class="trip-card-kicker"><span>${esc(fmtDate(x.data_partenza))}</span>${countdown?`<span class="trip-countdown">${esc(countdown)}</span>`:''}</div>
   <div class="trip-title">${esc(title)}</div>
   <div class="trip-meta"><span class="trip-meta-main">⌖ ${esc(place||'Punto di partenza da comunicare')}</span><strong class="trip-price">${esc(price)}</strong></div>
   <div class="trip-meta"><span class="trip-meta-main">◷ ${esc(time||'—')}</span><strong class="availability ${!sold&&free<=10?'low':''} ${sold?'none':''}">${sold?'POSTI ESAURITI':`${free} posti liberi${total?` / ${total}`:''}`}</strong></div>
   ${total?`<div class="availability-meter" aria-label="${pct}% posti occupati"><span style="width:${pct}%"></span></div><div class="trip-meter-label"><span>${pct}% occupato</span><span>${sold?'Completo':free<=10?'Affrettati':'Disponibilità live'}</span></div>`:''}
   <div class="trip-card-footer"><a class="btn btn-card-detail" href="viaggio.html?id=${encodeURIComponent(x.id)}">Scopri il viaggio <span>↗</span></a><a class="trip-book-mini ${sold?'disabled':''}" ${sold?'aria-disabled="true"':''} href="${sold?'viaggio.html?id='+encodeURIComponent(x.id):'prenota.html?viaggio='+encodeURIComponent(x.id)}">${sold?'Completo':'Prenota'}</a></div>
  </div>
 </article>`;
}
async function tripDetail(){
 const root=document.querySelector('#tripDetail');if(!root)return;
 const id=new URLSearchParams(location.search).get('id');
 if(!id){root.innerHTML='<div class="detail-error"><b>Seleziona una partenza.</b><p>Apri una delle esperienze disponibili per vedere tutti i dettagli.</p><a class="btn btn-blue" href="viaggi.html">Esplora le partenze →</a></div>';return;}
 root.innerHTML='<div class="detail-loading"><span></span><b>Prepariamo la tua esperienza…</b><small>Sincronizzazione live con Del Grosso</small></div>';
 try{
  const trips=window.__dgTrips?.length?window.__dgTrips:await getGestionaleTrips();
  let trip=(trips||[]).find(x=>String(x.id)===String(id));
  if(!trip){root.innerHTML='<div class="detail-error"><b>Partenza non disponibile.</b><p>Potrebbe essere stata rimossa, completata o non essere più pubblicata.</p><a class="btn btn-blue" href="viaggi.html">Torna alle partenze</a></div>';return;}
  window.__dgCurrentTrip=trip;
  const a=gestTripAvailability(trip),img=tripImage(trip),title=tripTitle(trip),date=String(trip.data_partenza||''),time=String(trip.ora_partenza||'').slice(0,5);
  document.title=`${title} | Del Grosso Viaggi`;
  let layout=null;try{layout=await getBusLayout(id)}catch(e){console.warn('Layout bus non disponibile',e)}
  const bus=layout?.bus||{},busName=[tripField(bus,'marca'),tripField(bus,'modello')].filter(Boolean).join(' ')||tripField(trip,'autobus_nome','bus_nome','modello_bus','autobus_modello','bus_modello');
  const seats=Number(tripField(trip,'posti_totali')||layout?.posti_totali||0)||a.total||0,meeting=tripField(trip,'luogo_partenza','punto_ritrovo','ritrovo','partenza');
  const price=(trip.prezzo!==undefined&&trip.prezzo!==null&&trip.prezzo!=='')?`€ ${Number(trip.prezzo).toFixed(0)}`:'Su richiesta';
  const progress=a.total?Math.round(((a.total-a.free)/a.total)*100):0,count=tripCountdown(date,time),description=tripField(trip,'descrizione','note_pubbliche','dettagli','descrizione_breve','excerpt')||'Una partenza da vivere dall’inizio alla fine, con la comodità del viaggio organizzato e l’attenzione Del Grosso Viaggi.';
  const heroBg=img?`style="--detail-bg:url('${esc(img)}')"`:'';
  const shareText=encodeURIComponent(`${title} · ${tripLongDate(date)} — Del Grosso Viaggi`);
  root.innerHTML=`<div class="trip-detail-shell">
   <div class="detail-topbar"><a class="back-link detail-back" href="viaggi.html">← Tutte le partenze</a><div class="detail-top-actions"><button id="shareTrip" class="detail-icon-btn" type="button" title="Condividi viaggio">↗ <span>Condividi</span></button><a class="detail-icon-btn" href="prenota.html?viaggio=${encodeURIComponent(id)}">Prenota <span>→</span></a></div></div>
   <section class="trip-detail-hero" ${heroBg}>
    <div class="trip-detail-hero-image">${img?`<img src="${esc(img)}" alt="${esc(title)}">`:''}</div><div class="trip-detail-hero-shade"></div>
    <div class="trip-detail-hero-content"><div class="trip-detail-eyebrow"><span class="trip-live-pill"><i></i> DISPONIBILITÀ LIVE</span><span>${esc(tripLongDate(date))}</span></div><h1>${esc(title)}</h1><p>${esc(trip.sottotitolo||description)}</p><div class="trip-detail-hero-actions"><a class="btn ${a.soldOut?'btn-soldout':'btn-primary'}" href="${a.soldOut?'#':'prenota.html?viaggio='+encodeURIComponent(id)}">${a.soldOut?'Viaggio al completo':'Scegli il tuo posto'} <span>→</span></a><a class="btn btn-glass" href="#tripInfo">Scopri il programma ↓</a></div></div>
    <div id="tripLiveStatus" class="trip-detail-status ${a.soldOut?'sold':''}"><strong>${a.soldOut?'SOLD OUT':a.free<=10?'ULTIMI POSTI':'DISPONIBILE'}</strong><span>${a.soldOut?'Nessun posto libero':`${a.free} posti ancora disponibili`}</span>${count?`<small>${esc(count)}</small>`:''}</div>
   </section>
   <section class="trip-detail-stats"><div><small>${tripIcon('clock')} PARTENZA</small><strong>${esc(time||'—')}</strong><span>${esc(meeting||'Ritrovo da comunicare')}</span></div><div><small>${tripIcon('pin')} DESTINAZIONE</small><strong>${esc(trip.destinazione||title)}</strong><span>Esperienza Del Grosso</span></div><div><small>${tripIcon('price')} PREZZO</small><strong>${esc(price)}</strong><span>per persona</span></div><div id="tripLiveSeats"><small>${tripIcon('seat')} POSTI</small><strong>${a.soldOut?'0':a.free}</strong><span>disponibili su ${a.total||seats||'—'}</span></div></section>
   <section id="tripInfo" class="trip-detail-main"><div class="trip-detail-copy"><div class="kicker">L'esperienza</div><h2>Il viaggio<br><em>comincia qui.</em></h2><p>${esc(description)}</p>${trip.note?`<div class="detail-note"><b>Nota importante</b><span>${esc(trip.note)}</span></div>`:''}<div class="experience-grid"><div><span>01</span><b>Organizzato</b><small>Partenza e assistenza curate da Del Grosso.</small></div><div><span>02</span><b>Comfort</b><small>Viaggio in autobus Gran Turismo.</small></div><div><span>03</span><b>Posto garantito</b><small>Scegli il tuo sedile direttamente online.</small></div></div></div><aside class="trip-detail-side"><div class="detail-live-line"><i></i><span>Disponibilità sincronizzata</span><span>LIVE</span></div><div class="detail-side-head"><span>Posti disponibili</span><strong id="tripSideFree">${a.soldOut?'SOLD OUT':`${a.free}`}</strong></div><div class="detail-progress"><span id="tripSideProgress" style="width:${progress}%"></span></div><div class="detail-side-meta"><span><b>Data</b>${esc(fmtDate(date))}</span><span><b>Partenza</b>${esc(time||'—')}</span><span><b>Ritrovo</b>${esc(meeting||'—')}</span><span><b>Bus</b>${esc(busName||'Gran Turismo')}</span></div><a class="btn ${a.soldOut?'btn-soldout':'btn-blue'} detail-full-btn" href="${a.soldOut?'viaggi.html':'prenota.html?viaggio='+encodeURIComponent(id)}">${a.soldOut?'Scopri altre partenze':'Prenota ora'} <span>→</span></a><small class="secure-note">✓ Disponibilità sincronizzata con il Gestionale</small></aside></section>
   <section class="trip-timeline"><div class="kicker">Come si vive</div><h2>Quattro momenti.<br>Un'unica esperienza.</h2><div class="timeline"><div class="timeline-step"><span>01</span><div><b>Ritrovo</b><p>${esc(meeting||'Punto di ritrovo indicato nella conferma')}</p></div></div><div class="timeline-step"><span>02</span><div><b>Partenza</b><p>${esc(time||'Orario indicato nella conferma')}</p></div></div><div class="timeline-step"><span>03</span><div><b>In viaggio</b><p>Comfort Gran Turismo, organizzazione e assistenza.</p></div></div><div class="timeline-step"><span>04</span><div><b>${esc(trip.destinazione||'Destinazione')}</b><p>Arrivo e tempo per vivere l'esperienza.</p></div></div></div></section>
   ${busName||seats?`<section class="trip-bus-card"><div><div class="kicker">A bordo</div><h2>Il comfort<br>fa la differenza.</h2><p>${busName?`Viaggerai a bordo di <strong>${esc(busName)}</strong>.`:''}${seats?` ${esc(String(seats))} posti configurati per questa partenza.`:''}</p></div><div class="bus-card-icon">🚍</div></section>`:''}
   <div class="detail-final-cta"><div><span class="kicker">DELGROSSO LIVE</span><h2>${a.soldOut?"Cerchi un'altra partenza?":"Pronto a partire?"}</h2><p>${a.soldOut?'Scopri subito le prossime esperienze disponibili.':'Scegli il posto e completa la richiesta in pochi passaggi.'}</p></div><a class="btn btn-primary" href="${a.soldOut?'viaggi.html':'prenota.html?viaggio='+encodeURIComponent(id)}">${a.soldOut?'Esplora partenze':'Vai alla prenotazione'} →</a></div>
  </div>`;
  document.querySelector('#shareTrip')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:title,text:`${title} · ${tripLongDate(date)}`,url:location.href});else{await navigator.clipboard.writeText(location.href);const b=document.querySelector('#shareTrip');if(b){b.innerHTML='✓ <span>Link copiato</span>';setTimeout(()=>b.innerHTML='↗ <span>Condividi</span>',1800)}}}catch{}});
  const rel=document.querySelector('#relatedTrips');if(rel){const more=(trips||[]).filter(x=>String(x.id)!==String(id)).slice(0,3);rel.innerHTML=more.length?more.map(tripCard).join(''):'<div class="empty">Altre partenze in arrivo.</div>';}
  startTripDetailLive(id);
  applySettings(await loadSettings());
 }catch(e){console.error(e);root.innerHTML='<div class="detail-error"><b>Non riesco a caricare questa partenza.</b><p>Controlla la connessione e riprova tra poco.</p><a class="btn btn-blue" href="viaggi.html">Torna alle partenze</a></div>';}
}

function startTripDetailLive(id){
 if(window.__dgDetailTimer)clearInterval(window.__dgDetailTimer);
 const refresh=async()=>{try{const list=await getGestionaleTrips(),t=list.find(x=>String(x.id)===String(id));if(!t)return;const a=gestTripAvailability(t),status=document.querySelector('#tripLiveStatus'),side=document.querySelector('#tripSideFree'),bar=document.querySelector('#tripSideProgress'),seat=document.querySelector('#tripLiveSeats');if(status){status.classList.toggle('sold',a.soldOut);const strong=status.querySelector('strong'),sp=status.querySelector('span');if(strong)strong.textContent=a.soldOut?'SOLD OUT':a.free<=10?'ULTIMI POSTI':'DISPONIBILE';if(sp)sp.textContent=a.soldOut?'Nessun posto libero':`${a.free} posti ancora disponibili`;const sm=status.querySelector('small');if(sm)sm.textContent=tripCountdown(t.data_partenza,String(t.ora_partenza||'').slice(0,5));}if(side)side.textContent=a.soldOut?'SOLD OUT':a.free;if(bar)bar.style.width=`${a.total?Math.round(((a.total-a.free)/a.total)*100):0}%`;if(seat){const strong=seat.querySelector('strong'),span=seat.querySelector('span');if(strong)strong.textContent=a.soldOut?'0':a.free;if(span)span.textContent=`disponibili su ${a.total||'—'}`;}}catch(e){console.warn('Aggiornamento dettaglio non riuscito',e)}};
 window.__dgDetailTimer=setInterval(refresh,30000);
}
async function fleet(){const {data}=await sb.from('site_fleet').select('*').eq('published',true).order('sort_order').order('created_at');const g=document.querySelector('#fleetFull');if(!g)return;const id=new URLSearchParams(location.search).get('bus');if(id){const item=(data||[]).find(x=>String(x.id)===String(id));if(item){renderFleetDetail(item);applySettings(await loadSettings());return;}}
g.innerHTML=(data||[]).length?data.map(x=>fleetCard(x,false)).join(''):`<div class="empty">Nessun mezzo pubblicato.</div>`;applySettings(await loadSettings());}
function renderFleetDetail(x){const g=document.querySelector('#fleetFull');const imgs=[x.cover_url,...media(x.gallery_urls)].filter(Boolean);document.querySelector('.fleet-page-title')?.remove();g.className='fleet-detail';g.innerHTML=`<div class="fleet-detail-top"><a class="back-link" href="flotta.html">← Tutta la flotta</a><div class="fleet-detail-head"><div><div class="eyebrow">DELGROSSO FLOTTA</div><h2>${esc(x.title)}</h2><div class="fleet-pills">${x.seats?`<span>💺 ${x.seats} posti</span>`:''}<span>✓ Comfort e sicurezza</span><span>📸 ${imgs.length} foto</span></div></div><a class="btn btn-blue" href="preventivo.html">Richiedi preventivo →</a></div></div><div class="fleet-gallery">${imgs.map((u,i)=>`<button type="button" class="fleet-gallery-item ${i===0?'featured':''}" data-lightbox="${encodeURIComponent(u)}"><img loading="lazy" src="${esc(u)}" alt="${esc(x.title)} · foto ${i+1}"><span>↗</span></button>`).join('')}</div><div class="fleet-description"><div><div class="kicker">Scheda mezzo</div><h3>Scopri ${esc(x.title)}</h3></div><div class="fleet-description-text">${formatText(x.description||'Informazioni e dotazioni del mezzo.')}</div></div></div>`;setupLightbox();}
function formatText(t){return esc(t).split(/\n\n+/).map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('')}
function setupLightbox(){let box=document.querySelector('#siteLightbox');if(!box){box=document.createElement('div');box.id='siteLightbox';box.className='site-lightbox';box.innerHTML='<button class="lightbox-close" aria-label="Chiudi">✕</button><button class="lightbox-prev" aria-label="Foto precedente">‹</button><img alt=""><button class="lightbox-next" aria-label="Foto successiva">›</button>';document.body.appendChild(box);box.addEventListener('click',e=>{if(e.target===box||e.target.classList.contains('lightbox-close'))closeLightbox();});}const buttons=[...document.querySelectorAll('[data-lightbox]')];let current=0;const urls=buttons.map(b=>decodeURIComponent(b.dataset.lightbox));const img=box.querySelector('img');const open=i=>{current=i;img.src=urls[current];box.classList.add('open');document.body.classList.add('lightbox-open');};buttons.forEach((b,i)=>b.onclick=()=>open(i));box.querySelector('.lightbox-prev').onclick=e=>{e.stopPropagation();open((current-1+urls.length)%urls.length)};box.querySelector('.lightbox-next').onclick=e=>{e.stopPropagation();open((current+1)%urls.length)};document.onkeydown=e=>{if(!box.classList.contains('open'))return;if(e.key==='Escape')closeLightbox();if(e.key==='ArrowLeft')open((current-1+urls.length)%urls.length);if(e.key==='ArrowRight')open((current+1)%urls.length)};function closeLightbox(){box.classList.remove('open');document.body.classList.remove('lightbox-open');}}
async function party(){const {data}=await sb.from('site_party_events').select('*').eq('published',true).order('sort_order').order('created_at',{ascending:false});const g=document.querySelector('#partyGallery');if(g)g.innerHTML=(data||[]).length?data.flatMap(e=>{const a=[e.cover_url,...media(e.gallery_urls)].filter(Boolean);return a.map((u,i)=>`<a class="gallery-item" href="${esc(u)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(u)}" alt="${esc(e.title)}"></a>`)}).join(''):`<div class="empty">Nessun evento pubblicato.</div>`;applySettings(await loadSettings());}
async function trips(){const g=document.querySelector('#tripFull');try{const data=await getGestionaleTrips();window.__dgTrips=data||[];g.innerHTML=(data||[]).length?data.map(tripCard).join(''):`<div class="empty">Nessuna partenza disponibile.</div>`;startTripAutoRefresh('#tripFull');}catch(e){console.error(e);g.innerHTML='<div class="empty">Non riesco a collegarmi al Gestionale. Riprova tra poco.</div>';}applySettings(await loadSettings());}
function startTripAutoRefresh(selector,limit=null){if(window.__dgTripRefreshTimer)clearInterval(window.__dgTripRefreshTimer);const refresh=async()=>{try{const data=await getGestionaleTrips();const list=limit?data.slice(0,limit):data;window.__dgTrips=data;if(typeof window.__dgTripRender==='function' && selector==='#tripFull'){window.__dgTripRender(data);return;}const g=document.querySelector(selector);if(g)g.innerHTML=list.length?list.map(tripCard).join(''):`<div class="empty">Nessuna partenza disponibile.</div>`;}catch(e){console.warn('Aggiornamento disponibilità non riuscito',e)}};window.__dgTripRefresh=refresh;window.__dgTripRefreshTimer=setInterval(refresh,30000);if(!window.__dgTripVisibilityBound){document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')window.__dgTripRefresh?.();});window.addEventListener('focus',()=>window.__dgTripRefresh?.(),{passive:true});window.__dgTripVisibilityBound=true;}}
async function newsPage(){const g=document.querySelector('#newsList');if(!g)return;try{const {data,error}=await sb.from('site_posts').select('*').eq('published',true).order('published_at',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;const id=new URLSearchParams(location.search).get('id');if(id){const post=(data||[]).find(x=>String(x.id)===String(id));if(!post){g.innerHTML='<div class="empty">News non trovata.</div>';return;}document.title=`${post.title} | Del Grosso Viaggi`;g.innerHTML=`<article class="news-article"><a class="back-link" href="news.html">← Tutte le news</a><div class="news-article-grid"><div class="news-article-media">${post.cover_url?`<img src="${esc(post.cover_url)}" alt="${esc(post.title)}">`:''}</div><div class="news-article-head"><div class="trip-date">${esc(post.category||'News')} · ${esc(fmtDate((post.published_at||'').slice(0,10)))}</div><h2>${esc(post.title)}</h2><p>${esc(post.excerpt||'')}</p><div class="news-share"><button id="shareNews" class="btn btn-blue">Condividi ↗</button><a class="btn btn-ghost dark-btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(post.title+' — '+location.href)}">WhatsApp</a></div></div></div><div class="news-body">${formatText(post.body||post.excerpt||'')}</div></article>`;document.querySelector('#shareNews')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:post.title,text:post.excerpt||'',url:location.href});else await navigator.clipboard.writeText(location.href);}catch{}});return;}g.innerHTML=(data||[]).length?data.map(x=>`<a class="news-row" href="news.html?id=${encodeURIComponent(x.id)}"><div class="news-row-img">${x.cover_url?`<img loading="lazy" src="${esc(x.cover_url)}" alt="${esc(x.title)}">`:''}</div><div><div class="trip-date">${esc(x.category||'News')} · ${esc(fmtDate((x.published_at||'').slice(0,10)))}</div><h2>${esc(x.title)}</h2><p>${esc(x.excerpt||'')}</p><span class="news-read">Leggi la news completa →</span></div><span class="news-row-arrow">↗</span></a>`).join(''):`<div class="empty">Nessuna news pubblicata al momento.</div>`;applySettings(await loadSettings());}catch(e){console.error(e);g.innerHTML='<div class="empty">Impossibile caricare le news. Riprova tra poco.</div>';}}
async function contacts(){applySettings(await loadSettings());}
headerActive();mobileNav();
function premiumMotion(){let bar=document.querySelector('.scroll-progress');if(!bar){bar=document.createElement('div');bar.className='scroll-progress';bar.innerHTML='<span></span>';document.body.appendChild(bar)}const progress=bar.querySelector('span');const sync=()=>{const h=document.documentElement.scrollHeight-window.innerHeight;progress.style.width=`${h>0?(scrollY/h)*100:0}%`};sync();window.addEventListener('scroll',sync,{passive:true});const media=document.querySelector('.hero-media');if(media && !matchMedia('(prefers-reduced-motion: reduce)').matches){media.classList.add('hero-parallax');window.addEventListener('mousemove',e=>{const x=(e.clientX/innerWidth-.5)*6,y=(e.clientY/innerHeight-.5)*4;media.style.transform=`scale(1.035) translate(${x}px,${y}px)`},{passive:true});}}
function siteUX(){const loader=document.querySelector('.page-loader');window.addEventListener('load',()=>setTimeout(()=>loader?.classList.add('hide'),180),{once:true});document.querySelectorAll('img').forEach((img,i)=>{if(i>0&&!img.loading)img.loading='lazy';img.decoding='async';});if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');observer.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -35px'});document.querySelectorAll('.section-head,.trip-card,.fleet-card,.fleet-photo-card,.news-card,.news-row,.party-feature,.contact-card,.gallery-item,.quote,.trip-toolbar').forEach(el=>{el.classList.add('reveal');observer.observe(el)});}}
siteUX();premiumMotion();v5GlobalUX();


/* =========================
   TECH PREMIUM V5 — GLOBAL EXPERIENCE LAYER
   ========================= */
function v5TripDateShort(d){if(!d)return '—';return String(d).slice(8,10)+'/'+String(d).slice(5,7)}
function v5InjectCommandSearch(){
 if(document.querySelector('#globalSearchOverlay'))return;
 const tools=document.querySelector('.site-tools');
 if(tools){const b=document.createElement('button');b.className='global-search-trigger';b.type='button';b.innerHTML='<span>Cerca un viaggio</span><kbd>⌕</kbd>';b.setAttribute('aria-label','Cerca un viaggio');tools.prepend(b);b.onclick=v5OpenSearch;}
 const o=document.createElement('div');o.id='globalSearchOverlay';o.className='global-search-overlay';o.setAttribute('aria-hidden','true');o.innerHTML='<div class="global-search-panel" role="dialog" aria-modal="true" aria-label="Cerca un viaggio"><div class="global-search-head"><span style="font-size:19px">⌕</span><input id="globalSearchInput" type="search" autocomplete="off" placeholder="Cerca destinazione, viaggio…"><button class="global-search-close" type="button" aria-label="Chiudi">✕</button></div><div class="global-search-hint">Cerca tra le partenze ufficiali · disponibilità sincronizzata live</div><div id="globalSearchResults" class="global-search-results"><div class="search-empty">Sto preparando le partenze…</div></div><div class="search-status"><span><strong>● LIVE</strong> · calendario ufficiale</span><span>ESC per chiudere</span></div></div>';
 document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)v5CloseSearch();});o.querySelector('.global-search-close').onclick=v5CloseSearch;
 const input=o.querySelector('#globalSearchInput');input.addEventListener('input',()=>v5RenderSearch(input.value));
 document.addEventListener('keydown',e=>{if((e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();v5OpenSearch();}if(e.key==='Escape'&&o.classList.contains('open'))v5CloseSearch();});
}
async function v5OpenSearch(){const o=document.querySelector('#globalSearchOverlay');if(!o)return;o.classList.add('open');o.setAttribute('aria-hidden','false');const i=o.querySelector('#globalSearchInput');setTimeout(()=>i?.focus(),30);if(!window.__dgTrips?.length){try{window.__dgTrips=await getGestionaleTrips()}catch{}}v5RenderSearch(i?.value||'')}
function v5CloseSearch(){const o=document.querySelector('#globalSearchOverlay');o?.classList.remove('open');o?.setAttribute('aria-hidden','true')}
function v5RenderSearch(q=''){const box=document.querySelector('#globalSearchResults');if(!box)return;const needle=q.trim().toLowerCase();const list=(window.__dgTrips||[]).filter(t=>{const text=(tripTitle(t)+' '+(t.destinazione||'')).toLowerCase();return !needle||text.includes(needle)}).slice(0,12);if(!list.length){box.innerHTML='<div class="search-empty">Nessuna partenza trovata.<br><a href="viaggi.html" style="color:#0878c9;font-weight:900">Apri tutte le partenze →</a></div>';return;}box.innerHTML=list.map(t=>{const a=gestTripAvailability(t),img=tripImage(t),title=tripTitle(t),time=String(t.ora_partenza||'').slice(0,5);return `<a class="search-result" href="viaggio.html?id=${encodeURIComponent(t.id)}"><div>${img?`<img src="${esc(img)}" alt="${esc(title)}">`:'<div style="width:82px;height:64px;border-radius:12px;background:#071a2b"></div>'}</div><div class="search-result-copy"><small>${esc(t.destinazione||'Partenza')} · ${esc(v5TripDateShort(t.data_partenza))}</small><b>${esc(title)}</b><span>${esc(time||'—')} · ${a.soldOut?'SOLD OUT':`${a.free} posti disponibili`}</span></div><span class="search-result-arrow">→</span></a>`}).join('')}
function v5HomeCommand(){const root=document.querySelector('#homeLiveCommand');if(!root)return;const trips=window.__dgTrips||[];const available=trips.filter(t=>!gestTripAvailability(t).soldOut);const next=available[0]||trips[0];const free=trips.reduce((n,t)=>n+gestTripAvailability(t).free,0);const sold=trips.filter(t=>gestTripAvailability(t).soldOut).length;const destinations=new Set(trips.map(t=>(t.destinazione||'').trim()).filter(Boolean)).size;root.innerHTML=`<div class="live-command-shell"><div class="live-command-main"><div class="command-label"><i></i> DELGROSSO LIVE · CALENDARIO UFFICIALE</div><h2>Il tuo prossimo viaggio,<br>in un colpo d'occhio.</h2><p>Partenze, disponibilità e destinazioni vengono lette dal calendario operativo e aggiornate automaticamente.</p><div class="command-stats"><div class="command-stat"><small>Partenze</small><b>${trips.length}</b></div><div class="command-stat"><small>Posti liberi</small><b>${free}</b></div><div class="command-stat"><small>Destinazioni</small><b>${destinations}</b></div></div><div class="actions" style="margin-top:24px"><a class="btn btn-primary" href="viaggi.html">Esplora il calendario →</a>${sold?`<span style="align-self:center;font-size:8px;color:rgba(255,255,255,.48);font-weight:900">${sold} ${sold===1?'partenza completa':'partenze complete'}</span>`:''}</div></div><div class="live-command-next">${next?`<a class="command-next-card" href="viaggio.html?id=${encodeURIComponent(next.id)}">${tripImage(next)?`<img src="${esc(tripImage(next))}" alt="${esc(tripTitle(next))}">`:''}<div class="command-next-date"><b>${esc(String(next.data_partenza||'').slice(8,10)||'—')}</b><small>${esc(String(next.data_partenza||'').slice(5,7)||'')}</small></div><div class="command-next-copy"><small>PROSSIMA PARTENZA · ${esc(tripCountdown(next.data_partenza,String(next.ora_partenza||'').slice(0,5)))}</small><b>${esc(tripTitle(next))}</b><span>${esc(next.destinazione||'Scopri la destinazione')} · ${gestTripAvailability(next).soldOut?'SOLD OUT':gestTripAvailability(next).free+' posti disponibili'} →</span></div></a>`:'<div class="search-empty">Nessuna partenza pubblicata.</div>'}</div></div>`}
function v5GlobalUX(){
 v5InjectCommandSearch();
 if(!document.querySelector('.page-transition')){const p=document.createElement('div');p.className='page-transition';document.body.appendChild(p);}
 const top=document.createElement('button');top.className='back-to-top';top.type='button';top.setAttribute('aria-label','Torna su');top.textContent='↑';document.body.appendChild(top);const sync=()=>top.classList.toggle('show',scrollY>650);sync();window.addEventListener('scroll',sync,{passive:true});top.onclick=()=>scrollTo({top:0,behavior:'smooth'});
 document.querySelectorAll('a[href]').forEach(a=>a.addEventListener('click',e=>{const href=a.getAttribute('href')||'';if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('http')||a.target==='_blank'||e.metaKey||e.ctrlKey)return;const p=document.querySelector('.page-transition');if(p){p.style.animation='none';void p.offsetWidth;p.style.animation='v5page .7s cubic-bezier(.76,0,.24,1) forwards';}}));
}
function v5EnhanceHome(){v5HomeCommand();}

/* =========================
   TECH PREMIUM V7 — TRAVEL EXPERIENCE LAYER
   ========================= */
function v7Saved(){try{return JSON.parse(localStorage.getItem('dg_saved_trips')||'[]')}catch{return[]}}
function v7Save(id){const a=v7Saved(),i=a.indexOf(String(id));i>=0?a.splice(i,1):a.unshift(String(id));try{localStorage.setItem('dg_saved_trips',JSON.stringify(a.slice(0,30)))}catch{}return a}
function v7IsSaved(id){return v7Saved().includes(String(id))}
function v7Toast(text){let t=document.querySelector('.v7-toast');if(!t){t=document.createElement('div');t.className='v7-toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2200)}
function v7CalendarUrl(t){const d=String(t.data_partenza||'');if(!d)return '#';const time=String(t.ora_partenza||'09:00').slice(0,5);const start=d.replaceAll('-','')+'T'+time.replace(':','')+'00';const end=d.replaceAll('-','')+'T235900';const title=encodeURIComponent(tripTitle(t));const details=encodeURIComponent('Del Grosso Viaggi · '+(t.destinazione||''));return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`}
function v7EnhanceCards(){document.querySelectorAll('.trip-card[data-trip-id]').forEach(card=>{const id=card.dataset.tripId;if(card.querySelector('.v7-save'))return;const tools=document.createElement('div');tools.className='v7-card-tools';const b=document.createElement('button');b.type='button';b.className='v7-save';b.setAttribute('aria-label',v7IsSaved(id)?'Rimuovi dai preferiti':'Salva viaggio');b.innerHTML=v7IsSaved(id)?'★':'☆';b.title=v7IsSaved(id)?'Salvato':'Salva';b.onclick=e=>{e.preventDefault();e.stopPropagation();const list=v7Save(id);b.innerHTML=list.includes(String(id))?'★':'☆';b.classList.toggle('saved',list.includes(String(id)));b.setAttribute('aria-label',list.includes(String(id))?'Rimuovi dai preferiti':'Salva viaggio');v7Toast(list.includes(String(id))?'Viaggio salvato':'Viaggio rimosso dai salvati');};tools.appendChild(b);card.querySelector('.trip-img')?.appendChild(tools)})}
function v7EnhanceHome(){
 const rail=document.querySelector('#destinationRail');if(rail&&!rail.querySelector('.v7-destination-note')){const n=document.createElement('div');n.className='v7-destination-note';n.innerHTML='<span>✦</span><b>Lasciati ispirare</b><small>Le prossime esperienze partono da qui.</small>';rail.prepend(n)}
 v7EnhanceCards();
}
function v7EnhanceDepartures(){
 const grid=document.querySelector('#tripFull');if(!grid)return;
 const toolbar=document.querySelector('.trip-toolbar');
 if(toolbar&&!toolbar.querySelector('.v7-saved-toggle')){const b=document.createElement('button');b.type='button';b.className='v7-saved-toggle';b.innerHTML='☆ Salvati <span>0</span>';b.onclick=()=>{b.classList.toggle('active');const only=b.classList.contains('active');const list=window.__dgTrips||[];const saved=v7Saved();const render=window.__dgTripRender; if(typeof render==='function'){if(!only)render(list);else render(list.filter(t=>saved.includes(String(t.id))))}b.querySelector('span').textContent=v7Saved().length};toolbar.appendChild(b)}
 const updateSaved=()=>{const b=document.querySelector('.v7-saved-toggle');if(b)b.querySelector('span').textContent=v7Saved().length};updateSaved();v7EnhanceCards();
 const observer=new MutationObserver(()=>{v7EnhanceCards();updateSaved()});observer.observe(grid,{childList:true});
}
function v7EnhanceTripDetail(){
 const root=document.querySelector('#tripDetail');if(!root)return;
 if(!root.__v7Observer){root.__v7Observer=new MutationObserver(()=>{if(root.querySelector('.trip-detail-shell')){v7EnhanceTripDetail();root.__v7Observer.disconnect();root.__v7Observer=null}});root.__v7Observer.observe(root,{childList:true,subtree:true})}
 const id=new URLSearchParams(location.search).get('id');if(!id)return;
 const actions=root.querySelector('.detail-top-actions')||root.querySelector('.trip-detail-hero-actions');
 if(actions&&!actions.querySelector('.v7-detail-actions')){const wrap=document.createElement('div');wrap.className='v7-detail-actions';const save=document.createElement('button');save.type='button';save.className='detail-icon-btn';save.innerHTML=v7IsSaved(id)?'★ Salvato':'☆ Salva';save.onclick=()=>{const list=v7Save(id);save.innerHTML=list.includes(String(id))?'★ Salvato':'☆ Salva';v7Toast(list.includes(String(id))?'Viaggio salvato':'Viaggio rimosso dai salvati')};const share=document.createElement('button');share.type='button';share.className='detail-icon-btn';share.textContent='↗ Condividi';share.onclick=async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);v7Toast('Link copiato')}}catch{}};wrap.append(save,share);actions.appendChild(wrap)}
 const final=root.querySelector('.detail-final-cta');if(final&&!final.querySelector('.v7-calendar')){const t=window.__dgCurrentTrip;if(t){const a=document.createElement('a');a.className='v7-calendar';a.target='_blank';a.rel='noopener';a.href=v7CalendarUrl(t);a.textContent='＋ Aggiungi al calendario';final.appendChild(a)}}
}
function v7GlobalPolish(){
 document.querySelectorAll('a[href="viaggi.html"]').forEach(a=>{if(a.textContent.trim().toLowerCase()==='partenze')a.setAttribute('aria-label','Scopri le prossime partenze')});
 document.querySelectorAll('img').forEach(img=>{if(!img.alt)img.alt='Del Grosso Viaggi'});
 const liveWords=[...document.querySelectorAll('body *')].filter(el=>el.children.length===0&&/sincronizzazion|gestionale.*disponibilit|disponibilit.*gestionale/i.test(el.textContent||''));liveWords.forEach(el=>{el.textContent=el.textContent.replace(/sincronizzat[ae]? in tempo reale con il gestionale del grosso/ig,'Disponibilità aggiornata').replace(/sincronizzazione…/ig,'Disponibilità aggiornata').replace(/sincronizzazione/ig,'Disponibilità aggiornata').replace(/aggiornati dal gestionale/ig,'aggiornati automaticamente').replace(/dal gestionale/ig,'automaticamente').replace(/calendario operativo/ig,'calendario ufficiale')});
}
v7GlobalPolish();
setTimeout(()=>{v7EnhanceCards();v7EnhanceDepartures();v7EnhanceTripDetail()},350);




/* =========================
   TECH PREMIUM V8 — SMART TRAVEL COMMAND
   ========================= */
function v8SearchTrips(q=''){
 const list=window.__dgTrips||[];
 const term=String(q).trim().toLowerCase();
 return list.filter(t=>{
   if(!term)return true;
   const hay=[tripTitle(t),t.destinazione,t.luogo_partenza,t.data_partenza].filter(Boolean).join(' ').toLowerCase();
   return hay.includes(term);
 }).slice(0,8);
}
function v8FormatSearchResult(t){
 const a=gestTripAvailability(t), img=tripImage(t), title=tripTitle(t), date=gestFmtDate(t.data_partenza), time=gestFmtTime(t.ora_partenza);
 return `<a class="v8-search-item" href="viaggio.html?id=${encodeURIComponent(t.id)}"><span class="v8-search-thumb">${img?`<img src="${esc(img)}" alt="">`:'✦'}</span><span class="v8-search-copy"><small>${esc(date)} · ${esc(time||'—')}</small><b>${esc(title)}</b><span>${esc(t.destinazione||'')} · ${a.soldOut?'SOLD OUT':`${a.free} posti disponibili`}</span></span><strong>→</strong></a>`;
}
function v8OpenSearch(prefill=''){
 let modal=document.querySelector('.v8-search-modal');
 if(!modal){
  modal=document.createElement('div');modal.className='v8-search-modal';modal.innerHTML=`<div class="v8-search-backdrop"></div><section class="v8-search-panel" role="dialog" aria-modal="true" aria-labelledby="v8SearchTitle"><div class="v8-search-head"><div><small>DELGROSSO TRAVEL</small><h2 id="v8SearchTitle">Dove vuoi andare?</h2></div><button type="button" class="v8-search-close" aria-label="Chiudi">×</button></div><label class="v8-search-input-wrap"><span>⌕</span><input id="v8SearchInput" type="search" autocomplete="off" placeholder="Cerca destinazione, viaggio o partenza…"><kbd>ESC</kbd></label><div class="v8-search-meta"><span id="v8SearchStatus">Le prossime esperienze, in un unico posto.</span><span>↵ Apri · ↑↓ Naviga</span></div><div id="v8SearchResults" class="v8-search-results"></div><div class="v8-search-foot"><span>Non sai dove andare?</span><a href="viaggi.html">Esplora tutte le partenze →</a></div></section></div>`;
  document.body.appendChild(modal);
  const input=modal.querySelector('#v8SearchInput'), results=modal.querySelector('#v8SearchResults'), status=modal.querySelector('#v8SearchStatus');
  const render=()=>{const data=v8SearchTrips(input.value);results.innerHTML=data.length?data.map(v8FormatSearchResult).join(''):`<div class="v8-search-empty"><b>Nessun viaggio trovato.</b><span>Prova con un'altra destinazione.</span></div>`;status.textContent=data.length?`${data.length} ${data.length===1?'esperienza trovata':'esperienze trovate'}`:'Nessun risultato'};
  modal.querySelector('.v8-search-close').onclick=()=>v8CloseSearch();modal.querySelector('.v8-search-backdrop').onclick=()=>v8CloseSearch();input.addEventListener('input',render);input.addEventListener('keydown',e=>{if(e.key==='Escape'){v8CloseSearch();return}if(e.key==='Enter'){const first=results.querySelector('a');if(first)location.href=first.href}});
  modal._render=render;modal._input=input;
 }
 modal.classList.add('open');document.body.classList.add('v8-search-open');modal._input.value=prefill;modal._render();setTimeout(()=>modal._input.focus(),30);
}
function v8CloseSearch(){const modal=document.querySelector('.v8-search-modal');if(modal){modal.classList.remove('open');document.body.classList.remove('v8-search-open')}}
function v8InjectSearchTrigger(){
 if(document.querySelector('.v8-search-trigger'))return;
 const b=document.createElement('button');b.type='button';b.className='v8-search-trigger';b.innerHTML='<span>⌕</span><span class="v8-search-trigger-label">Cerca un viaggio</span><kbd>/</kbd>';b.setAttribute('aria-label','Cerca un viaggio');b.onclick=()=>v8OpenSearch();document.body.appendChild(b);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')v8CloseSearch();if((e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();v8OpenSearch()}});
}
function v8AddHomeDestinations(){
 const rail=document.querySelector('#destinationRail');if(!rail)return;
 const trips=window.__dgTrips||[];const groups=[];const seen=new Set();
 trips.forEach(t=>{const d=String(t.destinazione||'').trim();if(!d||seen.has(d.toLowerCase()))return;seen.add(d.toLowerCase());const a=gestTripAvailability(t);groups.push({d,t,a})});
 const current=rail.querySelectorAll('.destination-card');
 if(groups.length && !current.length){rail.innerHTML=groups.slice(0,6).map(({d,t,a})=>`<a class="destination-card v8-destination-card" href="viaggi.html?dest=${encodeURIComponent(d)}"><span class="destination-card-media">${tripImage(t)?`<img loading="lazy" src="${esc(tripImage(t))}" alt="${esc(d)}">`:''}</span><span class="destination-card-overlay"></span><span class="destination-card-copy"><small>${a.soldOut?'COMPLETO':a.free<=10?'ULTIMI POSTI':'PROSSIMA ESPERIENZA'}</small><b>${esc(d)}</b><span>${esc(gestFmtDate(t.data_partenza))} · ${a.soldOut?'SOLD OUT':`${a.free} posti`}</span></span></a>`).join('')}
}
function v8HomeHeroPulse(){
 const hero=document.querySelector('.hero');if(!hero||hero.querySelector('.v8-hero-orbit'))return;
 const o=document.createElement('div');o.className='v8-hero-orbit';o.innerHTML='<span></span><span></span><span></span>';hero.appendChild(o);
}
function v8Polish(){
 v8InjectSearchTrigger();
 if(document.querySelector('.hero'))v8HomeHeroPulse();
 if(document.querySelector('#destinationRail'))v8AddHomeDestinations();
 document.querySelectorAll('.trip-card').forEach(card=>{card.addEventListener('mouseenter',()=>card.classList.add('v8-hover'),{passive:true});card.addEventListener('mouseleave',()=>card.classList.remove('v8-hover'),{passive:true})});
}
setTimeout(v8Polish,650);

/* =========================================================
   TECH PREMIUM V9 — HOMEPAGE INTELLIGENCE / POLISH
   ========================================================= */
function v9HomeUpgrade(){
  if(!document.querySelector('.home-v9')) return;
  const trips=window.__dgTrips||[];
  const pulse=document.querySelector('#homePulse');
  if(pulse){
    const available=trips.filter(t=>!gestTripAvailability(t).soldOut);
    const free=trips.reduce((n,t)=>n+gestTripAvailability(t).free,0);
    const destinations=new Set(trips.map(t=>String(t.destinazione||'').trim().toLowerCase()).filter(Boolean)).size;
    pulse.innerHTML=`<div><small>Partenze</small><b>${trips.length}</b></div><div><small>Posti liberi</small><b>${free}</b></div><div><small>Destinazioni</small><b>${destinations}</b></div>`;
  }
  document.querySelectorAll('.v9-search-open').forEach(b=>{if(b.dataset.v9Bound)return;b.dataset.v9Bound='1';b.addEventListener('click',()=>v8OpenSearch())});
  const grid=document.querySelector('#tripGrid');
  if(grid && !grid.children.length){
    grid.innerHTML='<div class="empty" style="grid-column:1/-1">Le prossime partenze stanno arrivando…</div>';
  }
  // Keep the homepage destination rail focused: remove empty cards if data is unavailable.
  const rail=document.querySelector('#destinationRail');
  if(rail && !rail.querySelector('.destination-card') && trips.length===0){rail.innerHTML='<div class="empty" style="grid-column:1/-1">Nuove destinazioni in arrivo.</div>'}
}

/* V9 destination rail replaces the first-generation homepage cards with a cleaner editorial rail. */
function v9RefreshDestinationRail(){
 const rail=document.querySelector('#destinationRail');if(!rail)return;
 const trips=window.__dgTrips||[];const map=new Map();
 trips.forEach(t=>{const d=String(t.destinazione||'').trim();if(!d)return;const key=d.toLowerCase();const old=map.get(key);if(!old || String(t.data_partenza||'')<String(old.data_partenza||''))map.set(key,t)});
 const groups=[...map.values()].slice(0,4);
 if(!groups.length){rail.innerHTML='<div class="empty" style="grid-column:1/-1">Nuove destinazioni in arrivo.</div>';return;}
 rail.innerHTML=groups.map(t=>{const d=String(t.destinazione||'').trim(),a=gestTripAvailability(t),img=tripImage(t),label=a.soldOut?'COMPLETO':a.free<=10?'ULTIMI POSTI':'PROSSIMA ESPERIENZA';return `<a class="destination-card v8-destination-card" href="viaggi.html?dest=${encodeURIComponent(d)}"><span class="destination-card-media">${img?`<img loading="lazy" src="${esc(img)}" alt="${esc(d)}">`:''}</span><span class="destination-card-overlay"></span><span class="destination-card-copy"><small>${label}</small><b>${esc(d)}</b><span>${esc(gestFmtDate(t.data_partenza))} · ${a.soldOut?'SOLD OUT':`${a.free} posti disponibili`}</span></span></a>`}).join('');
}
const v9OldPolish=window.v8Polish;
window.v8Polish=function(){try{v9OldPolish?.()}catch(e){console.warn(e)}try{v9RefreshDestinationRail()}catch(e){console.warn(e)}};

/* =========================================================
   TECH PREMIUM V10 — AGENCY EXPERIENCE LAYER
   ========================================================= */
(function(){
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  function addSkip(){
    if(qs('.v10-skip')) return;
    const a=document.createElement('a'); a.className='v10-skip'; a.href='#main-content'; a.textContent='Vai al contenuto';
    document.body.prepend(a);
    const main=qs('main'); if(main && !main.id) main.id='main-content';
  }
  function activeNav(){
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    qsa('.navlinks a').forEach(a=>{
      const href=(a.getAttribute('href')||'').split('?')[0].split('#')[0].toLowerCase();
      if(href===path) a.classList.add('active');
    });
  }
  function backTop(){
    if(qs('.v10-backtop')) return;
    const b=document.createElement('button'); b.type='button'; b.className='v10-backtop'; b.setAttribute('aria-label','Torna in alto'); b.textContent='↑';
    b.onclick=()=>window.scrollTo({top:0,behavior:'smooth'}); document.body.appendChild(b);
    const sync=()=>b.classList.toggle('show',window.scrollY>600); window.addEventListener('scroll',sync,{passive:true}); sync();
  }
  function improveButtons(){
    qsa('a.btn,button.btn').forEach(el=>{ if(!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label','Azione'); });
  }
  function agencyStats(){
    const grid=qs('#homePulse'); if(!grid) return;
    const trips=window.__dgTrips||[];
    if(!trips.length) return;
    const next=trips.find(t=>!gestTripAvailability(t).soldOut) || trips[0];
    const nextCell=document.createElement('div'); nextCell.className='v10-next-pulse';
    nextCell.innerHTML=`<small>Prossima esperienza</small><b>${esc(tripTitle(next))}</b><span>${esc(gestFmtDate(next.data_partenza))}</span>`;
    if(!grid.querySelector('.v10-next-pulse')) grid.appendChild(nextCell);
  }
  function init(){
    addSkip(); activeNav(); backTop(); improveButtons();
    setTimeout(agencyStats,900);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();

/* =========================================================
   TECH PREMIUM V11 — PUBLIC AGENCY EXPERIENCE
   ========================================================= */
(function(){
  const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  function breadcrumbs(){
    const main=qs('main'); if(!main || qs('.v11-breadcrumb')) return;
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    if(path==='index.html') return;
    const labels={"viaggi.html":"Partenze","prenota.html":"Prenota","viaggio.html":"Dettaglio viaggio","flotta.html":"La Flotta","partyontheroad.html":"Party on the Road","limousine.html":"Limousine Bus","chi-siamo.html":"Chi siamo","contatti.html":"Contatti","preventivo.html":"Preventivo","news.html":"News"};
    const b=document.createElement('div'); b.className='v11-breadcrumb wrap'; b.innerHTML=`<a href="index.html">Home</a><span>›</span><span>${labels[path]||'Del Grosso Viaggi'}</span>`;
    main.prepend(b);
  }
  function mobileActions(){
    if(qs('.v11-contact-fab') || !document.body) return;
    const wrap=document.createElement('div'); wrap.className='v11-contact-fab';
    wrap.innerHTML='<a href="https://wa.me/393205730466" target="_blank" rel="noopener" aria-label="Contatta Del Grosso Viaggi su WhatsApp">WhatsApp</a><a href="prenota.html" aria-label="Apri le prenotazioni">Prenota</a>';
    document.body.appendChild(wrap);
  }
  function formGuard(){
    qsa('form').forEach(form=>{
      form.addEventListener('invalid',e=>{ const el=e.target; if(el && el.matches('input,select,textarea')) el.classList.add('v11-invalid'); },true);
      form.addEventListener('input',e=>{if(e.target?.classList?.contains('v11-invalid')) e.target.classList.remove('v11-invalid')});
    });
  }
  function year(){qsa('[data-current-year]').forEach(x=>x.textContent=new Date().getFullYear());}
  function init(){breadcrumbs();mobileActions();formGuard();year();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
