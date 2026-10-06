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

/* DELGROSSO FLAGSHIP V33 — conversion and referral layer. Core booking/data code remains untouched. */
(()=>{
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 const tripUrl=id=>new URL(`viaggio.html?id=${encodeURIComponent(id)}`,location.href).href;
 const bookingUrl=id=>new URL(`prenota.html${id?`?viaggio=${encodeURIComponent(id)}`:''}`,location.href).href;
 const cleanText=s=>String(s||'').replace(/\s+/g,' ').trim();
 const toast=(message)=>{
   let t=$('.dg-v33-toast');if(!t){t=document.createElement('div');t.className='dg-v33-toast';t.setAttribute('role','status');document.body.appendChild(t)}
   t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1900);
 };
 async function share({title='DELGROSSO Viaggi',text='Guarda questa partenza con DELGROSSO Viaggi.',url=location.href,whatsapp=false,source=null}={}){
   const payload=`${cleanText(text)}\n${url}`;
   if(whatsapp){window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`,'_blank','noopener');return true}
   try{
     if(navigator.share){await navigator.share({title,text:cleanText(text),url});return true}
     if(navigator.clipboard){await navigator.clipboard.writeText(url);toast('Link copiato: invialo a chi vuoi con te ✓');if(source){source.dataset.oldText=source.textContent;source.textContent='✓ Link copiato';setTimeout(()=>{if(source?.isConnected)source.textContent=source.dataset.oldText||'Condividi'},1700)}return true}
   }catch(e){if(e?.name==='AbortError')return false}
   window.prompt('Copia questo link e invialo a chi vuoi con te:',url);return true;
 }
 function momentum(){
   if(!['index.html','viaggi.html','viaggio.html'].includes(path)||$('.dg-momentum'))return;
   const host=$('.dg-first-contact');if(!host)return;
   const s=document.createElement('section');s.className='dg-momentum';s.setAttribute('aria-label','Condividi il prossimo viaggio');
   s.innerHTML=`<div class="wrap"><div class="dg-momentum-shell"><div class="dg-momentum-copy"><span class="dg-momentum-kicker">IL VIAGGIO È PIÙ BELLO QUANDO LO CONDIVIDI</span><h2>Trova la partenza.<br><em>Mandala al gruppo.</em></h2><p>Quando trovi una meta che ti piace, non lasciarla lì: condividila con amici, famiglia o con chi vuoi avere accanto. Poi scegliete i posti e partite insieme.</p><div class="dg-momentum-actions"><a class="dg-share-secondary" href="viaggi.html">Scopri le partenze →</a><button class="dg-share-primary" type="button" data-dg-general-share>💬 Invita qualcuno a partire</button></div></div><div class="dg-momentum-side"><div class="dg-momentum-step"><span>01</span><div><b>Scegli la meta</b><small>Date, prezzi e disponibilità sono subito visibili.</small></div></div><div class="dg-momentum-step"><span>02</span><div><b>Condividila</b><small>Mandala al gruppo con un tocco.</small></div></div><div class="dg-momentum-step"><span>03</span><div><b>Prenotate</b><small>Scegliete direttamente i vostri posti sulla piantina.</small></div></div></div></div></div>`;
   host.after(s);
   $('[data-dg-general-share]',s)?.addEventListener('click',e=>share({title:'DELGROSSO Viaggi',text:'Guarda le prossime partenze DELGROSSO: quale scegliamo?',url:new URL('viaggi.html',location.href).href,source:e.currentTarget}));
 }
 function choiceSection(){
   if(path!=='index.html'||$('.dg-choice'))return;const anchor=$('.premium-trust');if(!anchor)return;
   const s=document.createElement('section');s.className='dg-choice';s.innerHTML=`<div class="wrap"><div class="dg-choice-head"><div><small>PERCHÉ PRENOTARE CON DELGROSSO</small><h2>Più semplice scegliere.<br><em>Più bello partire.</em></h2></div><p>Il sito deve lasciarti una cosa sola da decidere: quale viaggio vuoi vivere. Per il resto trovi disponibilità, posto e contatti diretti in un unico percorso.</p></div><div class="dg-choice-grid"><article class="dg-choice-card"><span>●</span><h3>Disponibilità live</h3><p>Le partenze pubblicate dialogano con il calendario operativo del Gestionale.</p></article><article class="dg-choice-card"><span>💺</span><h3>Il posto lo scegli tu</h3><p>Nella prenotazione puoi selezionare direttamente il sedile disponibile sulla piantina.</p></article><article class="dg-choice-card"><span>☎</span><h3>Parli direttamente con noi</h3><p>Raffaele e Nicola sono raggiungibili dai contatti presenti nel sito.</p></article><article class="dg-choice-card"><span>↗</span><h3>Invita chi vuoi</h3><p>Ogni partenza può essere condivisa facilmente con amici, famiglia e gruppi.</p></article></div></div>`;anchor.before(s);
 }
 function referralForCard(card){
   if(!card||card.dataset.dgReferral==='1'||card.classList.contains('is-soldout'))return;const id=card.dataset.tripId;if(!id)return;const body=$('.trip-body',card);if(!body)return;
   card.dataset.dgReferral='1';const title=cleanText($('.trip-title',card)?.textContent)||'Questa partenza';const date=cleanText($('.trip-card-kicker',card)?.textContent);
   const row=document.createElement('div');row.className='dg-card-referral';row.innerHTML=`<span>Ti piace? Mandala a chi vuoi portare con te.</span><button type="button">Condividi ↗</button>`;
   body.appendChild(row);const b=$('button',row);b.addEventListener('click',()=>share({title:`${title} | DELGROSSO Viaggi`,text:`${title}${date?' · '+date:''}. La facciamo insieme?`,url:tripUrl(id),source:b}));
 }
 function enhanceCards(root=document){$$('.trip-card',root).forEach(referralForCard)}
 function watchCards(){
   enhanceCards();['#tripGrid','#tripFull','#relatedTrips'].forEach(sel=>{const g=$(sel);if(g&&'MutationObserver'in window)new MutationObserver(()=>enhanceCards(g)).observe(g,{childList:true,subtree:true})});
 }
 function detailTogether(){
   if(path!=='viaggio.html')return;const root=$('#tripDetail');if(!root)return;
   const add=()=>{if($('.dg-trip-together')||!$('.trip-detail-shell',root))return;const id=new URLSearchParams(location.search).get('id');const trip=window.__dgCurrentTrip||{};const title=trip.titolo||trip.destinazione||cleanText($('.trip-detail-hero h1',root)?.textContent)||'Questa partenza';const date=cleanText($('.trip-detail-eyebrow',root)?.textContent);
     const stats=$('.trip-detail-stats',root);if(!stats)return;const s=document.createElement('section');s.className='dg-trip-together';s.innerHTML=`<div class="wrap"><div class="dg-trip-together-shell"><div><small>PASSAPAROLA DELGROSSO</small><h2>Questo viaggio ti piace? Non tenerlo per te.</h2><p>Mandalo adesso a chi vuoi avere accanto. Potete controllare la stessa partenza e scegliere i posti direttamente online.</p></div><div class="dg-trip-together-actions"><button class="dg-share-primary" type="button" data-wa>💬 Mandalo su WhatsApp</button><button class="dg-share-secondary" type="button" data-share>↗ Condividi</button><a class="dg-share-secondary" href="${bookingUrl(id)}">Prenota →</a></div></div></div>`;stats.after(s);
     $('[data-wa]',s)?.addEventListener('click',()=>share({title,text:`${title}${date?' · '+date:''}. Ti va di partire insieme con DELGROSSO?`,url:tripUrl(id),whatsapp:true}));
     $('[data-share]',s)?.addEventListener('click',e=>share({title,text:`${title}. Ti va di partire insieme con DELGROSSO?`,url:tripUrl(id),source:e.currentTarget}));
     const quick=$('.mobile-quickbar');const book=quick?.querySelector('a[href*="prenota"]');if(book&&id)book.href=`prenota.html?viaggio=${encodeURIComponent(id)}`;
   };
   add();if('MutationObserver'in window)new MutationObserver(add).observe(root,{childList:true,subtree:true});setTimeout(add,900);
 }
 function bookingInvite(){
   if(path!=='prenota.html')return;const form=$('#booking'),select=$('#viaggio'),submit=$('#submit'),msg=$('#msg');if(!form||!submit)return;
   if(!$('.dg-booking-invite',form)){
     const b=document.createElement('div');b.className='dg-booking-invite';b.innerHTML=`<small>VIAGGI IN COMPAGNIA?</small><b>Prima di confermare, manda la partenza al tuo gruppo.</b><p>Così potete scegliere la stessa data e organizzarvi sui posti.</p><div class="dg-booking-invite-actions"><button type="button" class="dg-share-primary" data-book-wa>💬 WhatsApp</button><button type="button" class="dg-share-secondary" data-book-share>↗ Condividi</button></div>`;submit.before(b);
     const shareSelected=(whatsapp=false,source=null)=>{const id=select?.value;if(!id){toast('Seleziona prima una partenza.');select?.focus();return}const option=select.options[select.selectedIndex];const title=cleanText(option?.textContent)||'Questa partenza';share({title,text:`Ho trovato questa partenza DELGROSSO: ${title}. La facciamo insieme?`,url:tripUrl(id),whatsapp,source})};
     $('[data-book-wa]',b)?.addEventListener('click',()=>shareSelected(true));$('[data-book-share]',b)?.addEventListener('click',e=>shareSelected(false,e.currentTarget));
   }
   const success=()=>{if(!msg?.classList.contains('success')||$('.dg-booking-success-share'))return;const id=select?.value;if(!id)return;const title=cleanText(select.options[select.selectedIndex]?.textContent)||'il viaggio';const card=document.createElement('div');card.className='dg-booking-success-share';card.innerHTML=`<strong>Ora fai partire il passaparola ✨</strong><p>Invita chi vuoi con te su ${title}. Condividi la stessa partenza in un attimo.</p><button type="button" class="dg-share-primary">💬 Invita su WhatsApp</button>`;msg.appendChild(card);$('button',card)?.addEventListener('click',()=>share({text:`Io ho scelto questa partenza DELGROSSO: ${title}. Vieni anche tu?`,url:tripUrl(id),whatsapp:true}));};
   success();if(msg&&'MutationObserver'in window)new MutationObserver(success).observe(msg,{attributes:true,childList:true,subtree:true});
 }
 function conversionCopy(){
   if(path==='index.html'){const final=$('.premium-final-cta');final?.classList.add('dg-v33-final')}
   if(path==='viaggi.html'){const count=$('#tripCount');if(count)count.title='Disponibilità sincronizzata dal calendario operativo'}
 }
 function init(){document.body.classList.add('flagship-v33');momentum();choiceSection();watchCards();detailTogether();bookingInvite();conversionCopy();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
