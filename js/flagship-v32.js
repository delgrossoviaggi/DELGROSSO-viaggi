/* DELGROSSO FLAGSHIP V32 — presentation & customer-assistance layer only. */
(()=>{
 const cfg=window.DG_CONFIG||{},extra=cfg.contactsExtra||{};
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const phones=extra.phones||[{name:'Raffaele',number:'320 573 0466'},{name:'Nicola',number:'366 212 7916'}];
 const social=extra.social||[];
 const clean=n=>String(n||'').replace(/\D/g,'');
 const email=cfg.contacts?.email||'info@delgrossoviaggi.it';
 function utilityBar(){
  if($('.dg-utility-bar'))return;
  const header=$('.site-header');if(!header)return;
  const bar=document.createElement('div');bar.className='dg-utility-bar';
  const phoneHtml=phones.map(p=>`<a href="tel:${clean(p.number)}" aria-label="Chiama ${p.name}">☎ <span>${p.name}</span> · ${p.number}</a>`).join('');
  const socialHtml=social.map(s=>`<a href="${s.url}" target="_blank" rel="noopener" aria-label="${s.label}"><i>${s.network==='Instagram'?'IG':'FB'}</i><span>${s.label}</span></a>`).join('');
  bar.innerHTML=`<div class="wrap dg-utility-inner"><div class="dg-utility-left">${phoneHtml}<a href="mailto:${email}">✉ ${email}</a></div><div class="dg-utility-social">${socialHtml}</div></div>`;
  header.before(bar);
 }
 function navBooking(){
  $$('.navlinks a').forEach(a=>{if((a.getAttribute('href')||'').includes('prenota.html'))a.classList.add('dg-nav-book')});
 }
 function contactHub(){
  if($('.dg-first-contact')||!['index.html','viaggi.html','viaggio.html'].includes(path))return;
  const section=document.createElement('section');section.className='dg-first-contact is-after-hero';section.setAttribute('aria-label','Contatti diretti DELGROSSO');
  const cards=phones.map(p=>`<a class="dg-contact-card" href="tel:${clean(p.number)}"><span class="dg-contact-icon">☎</span><span><small>Contatto diretto</small><b>${p.name}<br>${p.number}</b></span></a>`).join('');
  const socials=social.map(s=>`<a href="${s.url}" target="_blank" rel="noopener"><i>${s.network==='Instagram'?'IG':'FB'}</i>${s.label}</a>`).join('');
  section.innerHTML=`<div class="wrap"><div class="dg-contact-shell"><div class="dg-contact-intro"><small>Siamo qui per aiutarti</small><h2>Prima di partire, parliamone.</h2><p>Dubbi sulla partenza, sui posti o sulla prenotazione? Contattaci direttamente: ti aiutiamo a scegliere con tranquillità.</p></div><div class="dg-contact-actions">${cards}<a class="dg-contact-card" href="mailto:${email}"><span class="dg-contact-icon">✉</span><span><small>Email</small><b>${email}</b></span></a><div class="dg-contact-socials"><span>Seguici anche sui social</span>${socials}</div></div></div></div>`;
  if(path==='index.html'){$('.premium-hero')?.after(section)}
  else if(path==='viaggi.html'){$('.page-hero')?.after(section)}
  else {const main=$('#tripDetail');main?.after(section)}
 }
 function concierge(){
  if($('.dg-concierge')||['privacy.html','cookie.html','area-riservata.html'].includes(path))return;
  const c=document.createElement('div');c.className='dg-concierge';
  c.innerHTML=`<div class="dg-concierge-panel"><small>Assistenza DELGROSSO</small><h3>Ti serve una mano?</h3><p>Per partenze, posti, viaggi o servizi puoi parlare direttamente con noi.</p>${phones.map(p=>`<a href="tel:${clean(p.number)}"><span>☎ ${p.name}</span><b>${p.number}</b></a>`).join('')}<a href="mailto:${email}"><span>✉ Email</span><b>${email}</b></a></div><button class="dg-concierge-trigger" type="button" aria-expanded="false"><i></i> Hai bisogno di aiuto?</button>`;
  document.body.appendChild(c);const b=$('.dg-concierge-trigger',c);b.onclick=()=>{const open=c.classList.toggle('open');b.setAttribute('aria-expanded',String(open))};
  document.addEventListener('click',e=>{if(c.classList.contains('open')&&!c.contains(e.target)){c.classList.remove('open');b.setAttribute('aria-expanded','false')}});
 }
 function bookingComfort(){
  if(path!=='prenota.html')return;document.body.classList.add('dg-booking-page');
  const hero=$('.page-hero');if(hero&&!$('.dg-booking-trust')){const t=document.createElement('div');t.className='wrap dg-booking-trust';t.innerHTML='<div class="dg-booking-trust-inner"><div><b>✓</b> Disponibilità collegata al Gestionale</div><div><b>💺</b> Scegli il posto direttamente sulla piantina</div><div><b>☎</b> Assistenza diretta se hai bisogno</div></div>';hero.after(t)}
  const summary=$('.summary');if(summary&&!$('.dg-booking-help',summary)){const h=document.createElement('div');h.className='dg-booking-help';h.innerHTML=`<small>Hai un dubbio?</small><h3>Ti aiutiamo noi.</h3><p>Se durante la prenotazione vuoi una conferma o hai un’esigenza particolare, chiamaci direttamente.</p><div class="dg-booking-help-links">${phones.map(p=>`<a href="tel:${clean(p.number)}"><span>${p.name}</span><b>${p.number}</b></a>`).join('')}<a href="mailto:${email}"><span>Email</span><b>${email}</b></a></div>`;summary.appendChild(h)}
  const steps=$$('.booking-steps-v8 span'),trip=$('#viaggio'),selected=$('#selectedList'),nome=$('#nome'),cognome=$('#cognome'),tel=$('#telefono'),msg=$('#msg');
  const sync=()=>{if(steps.length<4)return;const hasTrip=Boolean(trip?.value),hasSeat=Boolean(selected&&selected.querySelector('.selected-seat')),hasData=Boolean(nome?.value.trim()&&cognome?.value.trim()&&tel?.value.trim()),done=Boolean(msg?.classList.contains('success'));
    const state=[hasTrip,hasSeat,hasData,done];steps.forEach((s,i)=>{s.classList.toggle('dg-done',state[i]);s.classList.toggle('active',!state[i]&&state.slice(0,i).every(Boolean))});
  };
  ['change','input'].forEach(ev=>document.addEventListener(ev,e=>{if(e.target?.closest('#booking'))sync()}));
  if(selected&&'MutationObserver'in window)new MutationObserver(sync).observe(selected,{childList:true,subtree:true});if(msg&&'MutationObserver'in window)new MutationObserver(sync).observe(msg,{attributes:true,childList:true,subtree:true});sync();
 }
 function footerRefresh(){
  const grid=$('footer .footer-grid');if(!grid)return;const cols=[...grid.children],target=cols[2];if(!target)return;
  target.innerHTML=`<div class="footer-title">Contatti</div><div class="footer-links">${phones.map(p=>`<a href="tel:${clean(p.number)}">${p.name} · ${p.number}</a>`).join('')}<a href="mailto:${email}">${email}</a><a class="reserved-link" href="area-riservata.html">Area riservata</a></div>`;
 }
 function quickbar(){
  const bar=$('.mobile-quickbar');if(!bar)return;const n=phones.find(p=>/nicola/i.test(p.name))||phones[0];
  bar.innerHTML=`<a href="viaggi.html">🚍 Partenze</a><a href="prenota.html">✦ Prenota</a><a href="tel:${clean(n?.number)}">☎ Chiama</a>`;
 }
 function reveal(){
  if(!('IntersectionObserver'in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const els=$$('.premium-heading,.trip-toolbar,.live-dashboard,.trip-card,.v31-service-card,.v31-panel,.news-row,.fleet-card,.dg-contact-shell,.booking,.summary').filter(e=>!e.classList.contains('dg-v32-reveal'));
  els.forEach(e=>e.classList.add('dg-v32-reveal'));const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('dg-v32-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -25px'});els.forEach(e=>io.observe(e));
 }
 function init(){document.body.classList.add('flagship-v32');utilityBar();navBooking();contactHub();concierge();bookingComfort();footerRefresh();quickbar();reveal();setTimeout(()=>{navBooking();reveal()},600);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
