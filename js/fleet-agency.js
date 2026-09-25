/* Vetrina flotta: solo mezzi pubblicati e fotografie originali. */
(()=>{
 const grid=document.querySelector('#fleetFull'),count=document.querySelector('#fleetCount'),dialog=document.querySelector('#fleetGalleryDialog');
 let items=[],filter='all',gallery=[],galleryTitle='',photo=0;
 const isPrivate=x=>/limousine|party/i.test([x.title,x.category,x.tipo].filter(Boolean).join(' '));
 const photos=x=>[...new Set([x.cover_url,...media(x.gallery_urls)].filter(Boolean))];
 function showPhoto(){document.querySelector('#agencyGalleryImage').src=gallery[photo];document.querySelector('#agencyGalleryImage').alt=`${galleryTitle} — foto ${photo+1}`;document.querySelector('#agencyGalleryCaption').textContent=`${galleryTitle} · ${photo+1} / ${gallery.length}`;dialog.querySelectorAll('[data-gallery-step]').forEach(b=>b.disabled=gallery.length<2);}
 function step(n){photo=(photo+n+gallery.length)%gallery.length;showPhoto();}
 dialog.querySelector('.gallery-close').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-gallery-step]').forEach(b=>b.onclick=()=>step(Number(b.dataset.galleryStep)));
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
 dialog.addEventListener('close',()=>document.body.classList.remove('agency-gallery-open'));
 function render(){
  const id=new URLSearchParams(location.search).get('bus');
  const rows=items.filter(x=>(!id||String(x.id)===id)&&(filter==='all'||(filter==='private'?isPrivate(x):!isPrivate(x))));
  count.textContent=`${rows.length} ${rows.length===1?'mezzo':'mezzi'}`;
  grid.innerHTML=(id?'<a class="fleet-back" href="flotta.html">← Torna a tutta la flotta</a>':'')+(rows.length?rows.map((x,i)=>{
   const p=photos(x),privateBus=isPrivate(x),title=x.title||'Autobus DELGROSSO';
   return `<article class="agency-fleet-card"><div class="agency-fleet-photo">${p.length?`<button type="button" data-open-gallery="${esc(x.id)}" aria-label="Guarda le foto di ${esc(title)}"><img src="${esc(p[0])}" alt="${esc(title)}" loading="${i?'lazy':'eager'}"><span class="photo-invitation">Guarda la galleria · ${p.length} ${p.length===1?'foto':'foto'} ↗</span></button>`:'<div class="fleet-no-photo">Foto in aggiornamento</div>'}</div><div class="agency-fleet-copy"><div class="fleet-card-top"><span>${privateBus?'EVENTI PRIVATI':'GRAN TURISMO'}</span><span>${String(i+1).padStart(2,'0')}</span></div><h2>${esc(title)}</h2><div class="agency-fleet-tags">${x.seats?`<span>${esc(x.seats)} posti</span>`:''}<span>${privateBus?'Solo feste private':'Con conducente'}</span></div><p class="agency-fleet-description">${esc(x.description||(privateBus?'Una festa da vivere insieme, con un servizio dedicato al tuo evento privato.':'Per viaggi organizzati, escursioni e servizi dedicati al tuo gruppo.'))}</p>${privateBus?'<p class="fleet-service-note">Il Limousine Bus è riservato agli eventi privati e non viene impiegato nei viaggi Gran Turismo.</p>':''}<div class="agency-fleet-actions"><a class="btn btn-blue" href="preventivo.html">Richiedi preventivo →</a>${p.length?`<button type="button" data-open-gallery="${esc(x.id)}">Esplora le foto ↗</button>`:''}</div></div></article>`;
  }).join(''):'<div class="empty"><h3>Nessun mezzo disponibile in questa selezione.</h3><p>Contattaci per informazioni sui servizi della flotta.</p><a class="btn btn-blue" href="contatti.html">Contattaci</a></div>');
  grid.querySelectorAll('[data-open-gallery]').forEach(b=>b.onclick=()=>{const x=items.find(x=>String(x.id)===b.dataset.openGallery);if(!x)return;gallery=photos(x);if(!gallery.length)return;galleryTitle=x.title||'Flotta DELGROSSO';photo=0;showPhoto();dialog.showModal();document.body.classList.add('agency-gallery-open');});
 }
 document.querySelectorAll('[data-fleet-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.fleetFilter;if(location.search)history.replaceState(null,'',location.pathname);document.querySelectorAll('[data-fleet-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
 async function start(){try{const {data,error}=await sb.from('site_fleet').select('*').eq('published',true).order('sort_order').order('created_at');if(error)throw error;items=publicFleetItems(data);render();}catch(e){console.error(e);count.textContent='Foto non disponibili al momento';grid.innerHTML='<div class="empty"><h3>Non riusciamo a caricare la flotta.</h3><p>Puoi riprovare oppure contattarci per il tuo servizio.</p><button class="btn btn-blue" id="retryFleet" type="button">Riprova</button> <a class="btn" href="contatti.html">Contattaci</a></div>';document.querySelector('#retryFleet').onclick=start;}}
 start();loadSettings().then(applySettings).catch(()=>{});
})();
