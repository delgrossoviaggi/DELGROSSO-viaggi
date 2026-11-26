/* DELGROSSO Viaggi — sito pubblico 2026.
   Legge solo dati pubblici: partenze dal gestionale tramite il bridge (js/gestionale.js),
   foto, flotta e news dal progetto Supabase del sito. Nessun segreto in questo file. */
(()=>{'use strict';
const SITE='https://bhsanrbadsqcpbtxupmr.supabase.co';
const SITE_KEY='sb_publishable_jcc3RIJmNnXZdhcmFuIKFg_EpxO_rBp'; // chiave pubblicabile (sola lettura pubblica)
const WA='https://wa.me/393208815899';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=document.body.dataset.page||'';
const MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GIORNI=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const dparts=iso=>{const d=new Date(String(iso).slice(0,10)+'T12:00:00');return {d:d.getDate(),m:MESI[d.getMonth()],w:GIORNI[d.getDay()],y:d.getFullYear(),mi:d.getMonth()}};
const dLong=iso=>{const p=dparts(iso);return `${p.w} ${p.d} ${p.m} ${p.y}`};
const hhmm=t=>t?String(t).slice(0,5):'';
const eur=v=>{const n=Number(v)||0;return '€ '+(Number.isInteger(n)?n:n.toFixed(2).replace('.',','))};
const small=s=>String(s||'').replace(/\s+/g,' ').trim();
/* Nomi scritti in maiuscolo nel gestionale -> lettura più gradevole */
const nice=s=>{s=small(s).replace(/\s*\(\s*[A-Za-z]{2}\s*\)\s*$/,'').replace(/\s*[-–—]?\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\s*$/,'').replace(/\s*[—–]\s*BIS.*$/i,'');
  if(!/[a-zà-ù]/.test(s.replace(/\bG\.co\b/gi,'')))s=s.toLowerCase().replace(/(^|[\s'(&/-])([a-zà-ù])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(E|Di|De|Del|Della|In|A|Al|Alla|Da|Con|Per)\b/g,(w,_,i)=>i===0?w:w.toLowerCase()).replace(/\bG\.co\b/i,'G.co').replace(/\b(?!(?:Di|Da|De|Al|In|Lo|La|Le|Il)\b)([A-Z][a-z])\b/g,m=>m.toUpperCase());
  return s};
const stopsOf=t=>[...new Set(String(t.luogo_partenza||'').split(/\s*(?:\||;|,|\n|\/|•|\s-\s|\s-|-\s)\s*/).map(x=>nice(x)).filter(Boolean))];
const tripName=t=>nice(t.titolo||t.destinazione||'Gita');
const poster=t=>{const u=String(t.locandina||t.immagine||'');return /^https:\/\//.test(u)?u:''};

/* ---------- menu e anno ---------- */
const hdr=$('.site-header'),mb=$('.menu-btn');
if(mb)mb.addEventListener('click',()=>{const o=hdr.classList.toggle('open');mb.setAttribute('aria-expanded',String(o));mb.setAttribute('aria-label',o?'Chiudi il menu':'Apri il menu')});
if(page==='home'&&hdr){const f=()=>hdr.classList.toggle('scrolled',scrollY>40);addEventListener('scroll',f,{passive:true});f()}
document.querySelectorAll('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());

/* ---------- dati del sito (foto, flotta, news) ---------- */
async function rows(table,query){
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),9000);
  try{const r=await fetch(`${SITE}/rest/v1/${table}?${query}`,{headers:{apikey:SITE_KEY,Accept:'application/json'},signal:ctl.signal});if(!r.ok)throw new Error(r.status);const d=await r.json();return Array.isArray(d)?d:[]}
  finally{clearTimeout(tm)}
}
const okUrl=u=>/^https:\/\/bhsanrbadsqcpbtxupmr\.supabase\.co\/storage\/v1\/object\/public\/site-media\//.test(String(u||''));
const urlsOf=x=>{const g=(Array.isArray(x&&x.gallery_urls)?x.gallery_urls:[]).filter(okUrl);return g.length?g:(okUrl(x&&x.cover_url)?[x.cover_url]:[])};

/* ---------- foto (gite, pullman, limousine) ---------- */
let PHOTOS=null;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
async function photos(){
  if(PHOTOS)return PHOTOS;
  const [car,cv,fl,pa]=await Promise.all([
    rows('carousel_home','select=foto_urls&pubblicato=eq.true&order=sort_order.asc,created_at.desc').catch(()=>[]),
    rows('site_carousel_viaggi','select=image_url&published=eq.true&order=sort_order.asc').catch(()=>[]),
    rows('site_fleet','select=title,cover_url,gallery_urls&published=eq.true&order=sort_order.asc,created_at.asc').catch(()=>[]),
    rows('site_party_events','select=cover_url,gallery_urls&published=eq.true').catch(()=>[])]);
  const uniq=a=>[...new Set(a.filter(okUrl))];
  const gite=uniq(car.flatMap(r=>r.foto_urls||[]).concat(cv.map(r=>r.image_url)));
  const pullman=uniq(fl.filter(x=>!/limo/i.test(x.title)).flatMap(urlsOf));
  const limo=uniq(fl.filter(x=>/limo/i.test(x.title)).flatMap(urlsOf).concat(pa.flatMap(urlsOf)));
  return PHOTOS={gite,pullman,limo,tutte:uniq(gite.concat(pullman,limo))};
}
const FALLBACK=['assets/bus-extra-1400.jpg','assets/bus-bianco-reale-1400.jpg'];
function mosaic(box,urls){
  box.innerHTML=urls.map((u,i)=>`<button type="button" data-g="${i}" aria-label="Ingrandisci la foto ${i+1}"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></button>`).join('');
  box.onclick=e=>{const b=e.target.closest('[data-g]');if(b)lightbox(urls,Number(b.dataset.g))};
}
function windowShow(box,urls){
  if(!box||!urls.length)return;
  const list=urls.slice(0,8);let i=0;
  box.innerHTML=`<img src="${esc(list[0])}" alt="" fetchpriority="high"><img class="out" alt="" decoding="async"><div class="dots">${list.map((_,k)=>`<i class="${k?'':'on'}"></i>`).join('')}</div>`;
  if(list.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const [a,b]=box.querySelectorAll('img'),dots=box.querySelectorAll('.dots i');let front=a,back=b;
  setInterval(()=>{if(document.hidden)return;i=(i+1)%list.length;back.onload=()=>{back.classList.remove('out');front.classList.add('out');[front,back]=[back,front];dots.forEach((d,k)=>d.classList.toggle('on',k===i))};back.src=list[i]},5000);
}
async function pageTopPhoto(){
  const top=document.querySelector('.page-top[data-photo]');if(!top)return;
  const kind=top.dataset.photo;
  let p;try{p=await photos()}catch{return}
  const pool=(kind==='fleet'?p.pullman:kind==='limo'?(p.limo.length?p.limo:p.pullman):p.gite);
  const u=pool.length?shuffle(pool)[0]:null;if(!u)return;
  const img=new Image();img.className='pt-photo';img.alt='';img.decoding='async';img.src=u;top.prepend(img);
}
async function galleria(){
  const grid=$('#photoGrid'),more=$('#moreFoto'),f=$('#photoFilters');
  let p;try{p=await photos()}catch{grid.innerHTML='<div class="empty">Non riesco a caricare le foto in questo momento.</div>';return}
  let cat='tutte',n=24;
  const draw=()=>{const all=p[cat]||[];if(!all.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Nessuna foto in questa sezione per ora.</div>';more.hidden=true;return}mosaic(grid,all.slice(0,n));more.hidden=all.length<=n};
  f.addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;cat=b.dataset.f;n=24;f.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()});
  more.addEventListener('click',()=>{n+=24;draw()});
  draw();
}

/* ---------- partenze ---------- */
function avail(t){
  const a=typeof gestTripAvailability==='function'?gestTripAvailability(t):{soldOut:false,known:false,free:0};
  return {sold:a.soldOut,known:a.known,free:a.free};
}
function statusPill(t){
  const a=avail(t);
  if(a.sold)return '<span class="pill sold">Sold out</span>';
  if(!a.known)return '<span class="pill info">Posti da verificare</span>';
  if(a.free<=5)return `<span class="pill poco">${a.free===1?'Ultimo posto':'Ultimi '+a.free+' posti'}</span>`;
  return `<span class="pill ok">${a.free} posti liberi</span>`;
}
/* linea del percorso: le prime fermate collegate, poi quante ne restano */
function route(st){
  if(!st.length)return '';
  const show=st.slice(0,1),rest=st.length-show.length;
  return `<span class="route" aria-label="Partenza da ${esc(st.join(', '))}">${show.map((s,i)=>`${i?'<span class="ln"></span>':''}<span class="st">${esc(s)}</span>`).join('')}${rest>0?`<span class="ln"></span><span class="more">+${rest} ${rest===1?'altra fermata':'altre fermate'}</span>`:''}</span>`;
}
function ticket(t){
  const p=dparts(t.data_partenza),a=avail(t),img=poster(t),st=stopsOf(t);
  const href=`viaggio.html?id=${encodeURIComponent(t.id)}`;
  return `<a class="ticket${a.sold?' sold':''}" href="${href}">
   <div class="stub"><span class="d">${p.d}</span><span class="m">${p.m.slice(0,3)}</span><span class="w">${p.w.slice(0,3)}</span>${hhmm(t.ora_partenza)&&hhmm(t.ora_partenza)!=='00:00'?`<span class="h">ore ${hhmm(t.ora_partenza)}</span>`:''}</div>
   <div class="tb"><div class="tt"><div><span class="dest">${esc(tripName(t))}</span>${route(st)}</div>${img?`<img class="thumb" src="${esc(img)}" alt="" loading="lazy">`:''}</div>
    ${statusPill(t)}
    <div class="row"><span class="price">${eur(t.prezzo)} <small>a persona</small></span><span class="go">${a.sold?'Al completo':'Prenota'}</span></div></div>
   ${img?`<img class="poster" src="${esc(img)}" alt="" loading="lazy">`:''}
  </a>`;
}
/* scheda della gita con foto (locandina, oppure una foto dei nostri viaggi) */
function card(t,photo){
  const p=dparts(t.data_partenza),a=avail(t),img=poster(t)||photo||FALLBACK[0],st=stopsOf(t);
  return `<a class="tcard${a.sold?' sold':''}" href="viaggio.html?id=${encodeURIComponent(t.id)}">
   <div class="ph"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"><span class="dt"><b>${p.d}</b>${p.m.slice(0,3)}</span>${statusPill(t)}</div>
   <div class="in"><h3>${esc(tripName(t))}</h3><span class="meta">${esc(p.w.charAt(0).toUpperCase()+p.w.slice(1))}${hhmm(t.ora_partenza)&&hhmm(t.ora_partenza)!=='00:00'?' · ore '+hhmm(t.ora_partenza):''}${st.length?' · da '+esc(st[0])+(st.length>1?' +'+(st.length-1):''):''}</span>
   <div class="bot"><span class="price">${eur(t.prezzo)} <small>a persona</small></span><span class="go">${a.sold?'Completo':'Prenota'}</span></div></div></a>`;
}
const photoFor=(p,i)=>p&&p.gite.length?p.gite[i%p.gite.length]:FALLBACK[i%FALLBACK.length];
let TRIPS=null;
async function trips(){
  if(TRIPS)return TRIPS;
  if(typeof getGestionaleTrips!=='function')return TRIPS=[];
  const all=await getGestionaleTrips();
  TRIPS=all.slice().sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))||String(a.ora_partenza||'').localeCompare(String(b.ora_partenza||'')));
  return TRIPS;
}
const tripsError=`<div class="empty">Non riesco a caricare le partenze in questo momento. Riprova tra poco oppure <a href="${WA}" target="_blank" rel="noopener">scrivici su WhatsApp</a>.</div>`;

async function home(){
  const box=$('#homeTrips');
  try{
    const list=await trips();
    // prima le gite con posti, poi le altre; massimo 4
    const open=list.filter(t=>!avail(t).sold),sold=list.filter(t=>avail(t).sold);
    const show=open.concat(sold).slice(0,6).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
    const ph=await photos().catch(()=>null);
    const next=open.find(t=>avail(t).known&&avail(t).free>0);
    if(next){const c=$('#liveChip');c.querySelector('span').textContent=`${avail(next).free} ${avail(next).free===1?'posto libero':'posti liberi'} · ${tripName(next)}`;c.href=`viaggio.html?id=${encodeURIComponent(next.id)}`;c.hidden=false}
    box.innerHTML=show.length?show.map((t,i)=>card(t,photoFor(ph,i))).join(''):`<div class="empty">Nuove partenze in arrivo. <a href="${WA}" target="_blank" rel="noopener">Scrivici</a> per sapere le prossime date.</div>`;
  }catch(e){console.warn(e);box.innerHTML=tripsError}
  // foto della Home (stesse del gestionale) e foto dei mezzi per i servizi
  photos().then(p=>{
    if(p.gite.length)windowShow($('#heroWindow'),p.gite);
    const mix=p.gite.slice(0,6).concat(p.pullman.slice(0,2),p.limo.slice(0,2),p.gite.slice(6,8)).slice(0,10);
    if(mix.length)mosaic($('#homeMosaic'),mix);else mosaic($('#homeMosaic'),FALLBACK);
  }).catch(()=>mosaic($('#homeMosaic'),FALLBACK));
  rows('site_fleet','select=title,cover_url,gallery_urls&published=eq.true&order=sort_order.asc,created_at.asc').then(r=>{
    const limo=r.find(x=>/limo/i.test(x.title)),gt=r.find(x=>!/limo/i.test(x.title));
    const set=(k,x)=>{const u=x&&urlsOf(x)[0],img=document.querySelector(`[data-fleet-img="${k}"]`);if(u&&img)img.src=u};
    set('gt',gt);set('limo',limo);
  }).catch(()=>{});
  rows('site_posts','select=id,title,excerpt,cover_url,category,published_at&published=eq.true&order=published_at.desc&limit=3').then(r=>{
    if(!r.length)return;$('#homeNewsWrap').hidden=false;$('#homeNews').innerHTML=r.map(newsCard).join('');
  }).catch(()=>{});
}

async function catalog(){
  const box=$('#allTrips'),fbox=$('#monthFilters'),only=$('#onlyFree');
  let list,PH=null;try{[list,PH]=await Promise.all([trips(),photos().catch(()=>null)])}catch(e){console.warn(e);box.innerHTML=tripsError;return}
  const months=[...new Map(list.map(t=>{const p=dparts(t.data_partenza);return [p.y+'-'+p.mi,p.m+(p.y!==new Date().getFullYear()?' '+p.y:'')]})).entries()];
  let month='tutti';
  const q=new URLSearchParams(location.search).get('cerca');
  fbox.innerHTML=`<button class="chip" type="button" data-m="tutti" aria-pressed="true">Tutti i mesi</button>`+months.map(([k,l])=>`<button class="chip" type="button" data-m="${k}" aria-pressed="false" style="text-transform:capitalize">${esc(l)}</button>`).join('');
  const draw=()=>{
    let l=list.filter(t=>{const p=dparts(t.data_partenza);return month==='tutti'||month===p.y+'-'+p.mi});
    if(only.checked)l=l.filter(t=>!avail(t).sold);
    if(q)l=l.filter(t=>(t.titolo+' '+t.destinazione).toLowerCase().includes(q.toLowerCase()));
    if(!l.length){box.innerHTML=`<div class="empty">Nessuna gita con questi filtri. <a href="${WA}" target="_blank" rel="noopener">Chiedici le prossime date</a>.</div>`;return}
    const groups=new Map();l.forEach(t=>{const p=dparts(t.data_partenza),k=p.m+' '+p.y;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t)});
    let n=0;box.innerHTML=[...groups].map(([k,g])=>`<h2 class="month-label">${esc(k)}</h2><div class="cards-grid">${g.map(t=>card(t,photoFor(PH,n++))).join('')}</div>`).join('');
  };
  fbox.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b)return;month=b.dataset.m;fbox.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()});
  only.addEventListener('change',draw);
  draw();
}

/* testo del programma: solo grassetto, titoli e paragrafi, tutto il resto è testo semplice */
function prog(txt){
  const blocks=String(txt||'').replace(/\r/g,'').split(/\n{2,}/).map(b=>b.trim()).filter(Boolean);
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
  return blocks.map(b=>/^#{1,3}\s/.test(b)?`<h3>${inline(b.replace(/^#{1,3}\s*/,''))}</h3>`:`<p>${inline(b)}</p>`).join('');
}
async function detail(){
  const host=$('#tripDetail'),id=new URLSearchParams(location.search).get('id');
  let list;try{list=await trips()}catch(e){host.innerHTML=tripsError;$('#tripTitle').textContent='Gita';return}
  const t=list.find(x=>String(x.id)===String(id));
  if(!t){$('#tripTitle').textContent='Gita non disponibile';host.innerHTML=`<div class="empty">Questa gita non è più in programma o è già partita. <a href="viaggi.html">Guarda le prossime partenze</a>.</div>`;return}
  const a=avail(t),img=poster(t),st=stopsOf(t),name=tripName(t);
  document.title=`${name} · ${dLong(t.data_partenza)} | DELGROSSO Viaggi`;
  $('#tripTitle').textContent=name;$('#tripLead').textContent=dLong(t.data_partenza).replace(/^./,c=>c.toUpperCase())+(hhmm(t.ora_partenza)&&hhmm(t.ora_partenza)!=='00:00'?' · partenza ore '+hhmm(t.ora_partenza):'');
  const msg=encodeURIComponent(`Buongiorno, vorrei informazioni sulla gita ${name} del ${dLong(t.data_partenza)}.`);
  const cta=a.sold
    ?`<a class="btn btn-wa btn-largo" href="${WA}?text=${msg}" target="_blank" rel="noopener">Al completo · chiedi se si liberano posti</a>`
    :`<a class="btn btn-oro btn-largo" href="prenota.html?viaggio=${encodeURIComponent(t.id)}">Scegli i posti e prenota</a>`;
  host.innerHTML=`<div class="trip-layout">
   <div>${img?`<img class="poster-big" src="${esc(img)}" alt="Locandina della gita ${esc(name)}">`:`<div class="poster-fallback">${esc(name)}</div>`}</div>
   <div class="stack">
    <div class="card stack">
     <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span class="sum-total">${eur(t.prezzo)} <small class="muted" style="font:500 .95rem var(--f-ui)">a persona</small></span>${statusPill(t)}</div>
     <div class="facts">
      <div class="fact"><span>Data</span><b>${esc(dLong(t.data_partenza).replace(/^./,c=>c.toUpperCase()))}</b></div>
      <div class="fact"><span>Partenza</span><b>${hhmm(t.ora_partenza)&&hhmm(t.ora_partenza)!=='00:00'?'ore '+hhmm(t.ora_partenza):'Orario da confermare'}</b></div>
     </div>
     ${st.length?`<div><h3 style="margin-bottom:8px">Fermate di partenza</h3><ul class="stops">${st.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`:''}
     ${cta}
    </div>
    ${t.descrizione&&small(t.descrizione).length>3?`<div class="card desc">${prog(t.descrizione)}</div>`:''}
    <div class="note-box">Per bloccare i posti serve un acconto entro 2 giorni dalla prenotazione: nella conferma trovi il numero da chiamare. Trascorsi 2 giorni senza acconto, i posti vengono svincolati.</div>
   </div></div>`;
  // su telefono il pulsante resta sempre visibile in basso
  const b=document.createElement('div');b.className='bar';b.innerHTML=`<div class="info"><b>${eur(t.prezzo)} a persona</b><span>${a.sold?'Al completo':a.known?a.free+(a.free===1?' posto libero':' posti liberi'):'Posti da verificare'}</span></div>${a.sold?`<a class="btn btn-wa" href="${WA}?text=${msg}" target="_blank" rel="noopener">Chiedi</a>`:`<a class="btn btn-oro" href="prenota.html?viaggio=${encodeURIComponent(t.id)}">Prenota</a>`}`;
  document.body.appendChild(b);document.body.classList.add('has-bar');
  photos().then(p=>{const u=shuffle(p.gite).slice(0,8);if(!u.length)return;const st=$('#tripPhotos');st.innerHTML=u.map((x,i)=>`<button type="button" data-g="${i}" style="border:0;padding:0;background:none;cursor:zoom-in" aria-label="Ingrandisci la foto ${i+1}"><img src="${esc(x)}" alt="" loading="lazy" decoding="async"></button>`).join('');st.onclick=e=>{const k=e.target.closest('[data-g]');if(k)lightbox(u,Number(k.dataset.g))};$('#tripPhotosWrap').hidden=false}).catch(()=>{});
}

/* ---------- flotta, limousine, party, news ---------- */
let LB=null;
function lightbox(urls,start){
  if(!LB){LB=document.createElement('div');LB.className='lightbox';LB.hidden=true;LB.setAttribute('role','dialog');LB.setAttribute('aria-label','Foto ingrandita');
    LB.innerHTML='<img alt=""><button class="x" type="button" aria-label="Chiudi">×</button><button class="prev" type="button" aria-label="Foto precedente">‹</button><button class="next" type="button" aria-label="Foto successiva">›</button>';document.body.appendChild(LB);
    LB.addEventListener('click',e=>{if(e.target===LB||e.target.classList.contains('x'))LB.hidden=true});
    document.addEventListener('keydown',e=>{if(LB.hidden)return;if(e.key==='Escape')LB.hidden=true;if(e.key==='ArrowRight')LB.querySelector('.next').click();if(e.key==='ArrowLeft')LB.querySelector('.prev').click()})}
  let i=start;const show=()=>{LB.querySelector('img').src=urls[i]};
  LB.querySelector('.prev').onclick=()=>{i=(i-1+urls.length)%urls.length;show()};LB.querySelector('.next').onclick=()=>{i=(i+1)%urls.length;show()};
  LB.querySelector('.prev').hidden=LB.querySelector('.next').hidden=urls.length<2;show();LB.hidden=false;LB.querySelector('.x').focus();
}
const galleryHtml=(urls,name)=>`<div class="gallery">${urls.map((u,i)=>`<button type="button" data-g="${i}" aria-label="Ingrandisci la foto ${i+1} di ${esc(name)}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>`;
function bindGallery(root,urls){root.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(b)lightbox(urls,Number(b.dataset.g))})}
async function fleet(){
  const box=$('#fleetList');
  try{
    const r=await rows('site_fleet','select=id,title,description,seats,cover_url,gallery_urls&published=eq.true&order=sort_order.asc,created_at.asc');
    if(!r.length){box.innerHTML='<div class="empty">Le foto dei mezzi arrivano a breve.</div>';return}
    box.innerHTML='';
    r.forEach(x=>{const u=urlsOf(x),el=document.createElement('article');el.className='card';
      el.innerHTML=`${u[0]?`<button type="button" data-g="0" style="border:0;padding:0;width:100%;border-radius:12px;overflow:hidden;cursor:zoom-in"><img src="${esc(u[0])}" alt="${esc(nice(x.title))}" style="width:100%;aspect-ratio:4/3;object-fit:cover" loading="lazy"></button>`:''}
       <h2 style="margin-top:14px;font-size:1.4rem">${esc(nice(x.title))}</h2>${x.seats?`<span class="pill info" style="margin-top:8px">${x.seats} posti</span>`:''}${x.description?`<p class="muted" style="margin-top:10px">${esc(x.description)}</p>`:''}${u.length>1?galleryHtml(u.slice(1),nice(x.title)).replace(/data-g="(\d+)"/g,(m,n)=>`data-g="${Number(n)+1}"`):''}`;
      bindGallery(el,u);box.appendChild(el)});
  }catch(e){box.innerHTML='<div class="empty">Non riesco a caricare la flotta in questo momento.</div>'}
}
async function limo(){
  const box=$('#limoGallery');
  try{const r=await rows('site_fleet','select=title,cover_url,gallery_urls&published=eq.true');const x=r.find(y=>/limo/i.test(y.title));const u=x?urlsOf(x):[];
    if(!u.length){box.outerHTML='<p class="muted">Le foto arrivano a breve.</p>';return}box.outerHTML=galleryHtml(u,'Limousine Bus').replace('class="gallery"','class="gallery" id="limoGallery"');bindGallery($('#limoGallery'),u)}catch{}
}
async function party(){
  const box=$('#partyList');
  try{const r=await rows('site_party_events','select=id,title,event_date,description,cover_url,gallery_urls&published=eq.true&order=sort_order.asc,created_at.desc');
    if(!r.length){box.innerHTML='<div class="empty">Le foto delle prossime serate arriveranno presto.</div>';return}
    box.innerHTML='';r.forEach(x=>{const u=urlsOf(x),el=document.createElement('article');el.className='card';
      el.innerHTML=`<h2 style="font-size:1.35rem">${esc(x.title)}</h2>${x.event_date?`<p class="muted small" style="margin-top:4px">${esc(dLong(x.event_date))}</p>`:''}${x.description?`<p style="margin-top:8px">${esc(x.description)}</p>`:''}${u.length?galleryHtml(u,x.title):''}`;bindGallery(el,u);box.appendChild(el)});
  }catch{box.innerHTML='<div class="empty">Non riesco a caricare gli eventi in questo momento.</div>'}
}
function newsCard(x){const d=x.published_at?dparts(x.published_at):null;return `<a class="card news-card" href="news.html?id=${encodeURIComponent(x.id)}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px">${okUrl(x.cover_url)?`<img src="${esc(x.cover_url)}" alt="" loading="lazy">`:''}<span class="small muted">${d?`${d.d} ${d.m} ${d.y}`:''}${x.category?' · '+esc(x.category):''}</span><h3>${esc(x.title)}</h3>${x.excerpt?`<p class="muted">${esc(x.excerpt)}</p>`:''}</a>`}
async function news(){
  const list=$('#newsList'),det=$('#newsDetail'),id=new URLSearchParams(location.search).get('id');
  try{const r=await rows('site_posts','select=id,title,excerpt,body,category,cover_url,published_at&published=eq.true&order=published_at.desc&limit=30');
    const x=id&&r.find(y=>String(y.id)===id);
    if(x){document.title=x.title+' | DELGROSSO Viaggi';det.innerHTML=`<article class="card prose" style="margin-bottom:26px;max-width:none">${okUrl(x.cover_url)?`<img src="${esc(x.cover_url)}" alt="" style="width:100%;max-height:460px;object-fit:cover;border-radius:12px;margin-bottom:16px">`:''}<h2 style="margin-top:0">${esc(x.title)}</h2>${x.body?prog(x.body):x.excerpt?`<p>${esc(x.excerpt)}</p>`:''}<p><a class="link-freccia" href="news.html">Tutte le news</a></p></article>`}
    const rest=r.filter(y=>!x||y.id!==x.id);list.innerHTML=rest.length?rest.map(newsCard).join(''):(x?'':'<div class="empty">Nessuna news al momento.</div>');
  }catch{list.innerHTML='<div class="empty">Non riesco a caricare le news in questo momento.</div>'}
}

/* ---------- moduli ---------- */
function contact(){
  const f=$('#contactForm');if(!f)return;
  f.addEventListener('submit',e=>{e.preventDefault();if(!f.reportValidity())return;const d=new FormData(f),x=k=>String(d.get(k)||'').trim();
    const sub='Richiesta dal sito - '+x('name');const body=['Nome: '+x('name'),'E-mail: '+x('email'),'Telefono: '+x('phone'),'Argomento: '+x('service'),'','Messaggio:',x('message')].join('\n');
    $('#contactStatus').textContent='Si apre la tua app di posta con il messaggio pronto: premi «Invia» per spedirlo.';
    location.href=`mailto:info@delgrossoviaggi.it?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`});
}
function quote(){
  const f=$('#quoteForm');if(!f)return;
  const q=new URLSearchParams(location.search).get('servizio'),sel=$('#quoteService');if(q&&[...sel.options].some(o=>o.value===q||o.text===q))sel.value=q;
  let sending=false;
  f.addEventListener('submit',async e=>{e.preventDefault();if(sending||!f.reportValidity())return;
    const d=new FormData(f),v=k=>String(d.get(k)||'').trim(),btn=$('#quoteSubmit'),st=$('#quoteStatus');
    const pay={nome:v('nome'),cognome:v('cognome'),telefono:v('telefono'),email:v('email'),servizio:v('servizio'),passeggeri:Number(v('passeggeri')),destinazione:v('destinazione'),partenza:v('partenza'),dataPartenza:v('dataPartenza'),note:v('note')};
    sending=true;btn.disabled=true;btn.textContent='Invio in corso…';st.textContent='';
    try{const r=await gestBridgePublic('quote',pay);if(r&&r.success===false)throw new Error(r.error||'');
      f.innerHTML=`<div class="ok-box"><b>Richiesta inviata.</b> Ti ricontattiamo al numero ${esc(pay.telefono)} il prima possibile. Grazie!</div>`;
    }catch(err){console.error(err);st.innerHTML=`Non siamo sicuri che la richiesta sia arrivata. Prima di riprovare <a href="${WA}" target="_blank" rel="noopener">scrivici su WhatsApp</a>, così evitiamo doppioni.`;btn.textContent='Esito da verificare'}
  });
}
async function gestBridgePublic(action,payload){
  if(typeof gestBridge==='function')return gestBridge(action,payload);
  const r=await fetch(`${SITE}/functions/v1/gestionale-bridge`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const d=await r.json().catch(()=>null);if(!r.ok||(d&&d.error))throw new Error((d&&d.error)||'Servizio non disponibile');return d;
}

({home,viaggi:catalog,viaggio:detail,flotta:fleet,limousine:limo,party,news,contatti:contact,preventivo:quote,galleria}[page]||(()=>{}))();
pageTopPhoto();
})();
