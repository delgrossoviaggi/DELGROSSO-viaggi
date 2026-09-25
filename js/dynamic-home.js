/* Interazioni della home: usa esclusivamente le partenze e le foto pubblicate. */
(()=>{
 const $=s=>document.querySelector(s), reduced=matchMedia('(prefers-reduced-motion: reduce)'), grid=$('#tripGrid');
 let trips=[],ready=false,failed=false;
 const normalize=DGTripDiscovery.normalize;
 function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
 const available=DGTripDiscovery.available;
 function render(){
  if(!ready)return;
  const dest=normalize($('#journeyDestination').value),month=$('#journeyMonth').value,from=normalize($('#journeyFrom').value),only=$('#availableOnly').checked;
  const rows=DGTripDiscovery.filter(trips,{destination:dest,month,from,onlyAvailable:only});
  $('#journeyResults').textContent=failed?'Non riusciamo ad aggiornare le partenze.':`${rows.length} ${rows.length===1?'partenza trovata':'partenze trovate'}`;
  grid.innerHTML=rows.length?rows.map(t=>{
   let html=tripCard(t);
   // Non presentare una disponibilità sconosciuta come esaurita o confermata.
   if(!DGTripDiscovery.known(t)&&!DGTripDiscovery.sold(t)){
    const box=document.createElement('div');box.innerHTML=html;
    box.querySelectorAll('.soldout-overlay,.soldout-strip,.availability-meter,.trip-meter-label,.trip-live-pill').forEach(e=>e.remove());
    const status=box.querySelector('.trip-status');if(status){status.className='trip-status';status.textContent='Chiedi disponibilità';}
    const av=box.querySelector('.availability');if(av){av.className='availability';av.textContent='Da verificare';}
    const action=box.querySelector('.trip-book-mini');if(action){action.className='trip-book-mini';action.removeAttribute('aria-disabled');action.textContent='Informazioni';action.href='contatti.html';}
    box.querySelector('.trip-card')?.classList.remove('is-soldout');html=box.innerHTML;
   }
   const box=document.createElement('div');box.innerHTML=html;const title=box.querySelector('.trip-title');if(title){title.setAttribute('role','heading');title.setAttribute('aria-level','3');}
   const status=box.querySelector('.trip-status');if(status&&status.textContent==='CONFERMATO'&&!t.stato)status.textContent='Disponibile';
   const price=box.querySelector('.trip-price');if(price&&t.prezzo!=null&&t.prezzo!==''&&Number.isFinite(Number(t.prezzo)))price.textContent=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(t.prezzo));
   const a=document.createElement('a');a.className='trip-question';const contact=document.querySelector('a[data-setting="whatsapp"][href]')?.href||'contatti.html';a.href=window.DG_CONFIG?.contactsReady&&contact.includes('wa.me/')?contact.split('?')[0]+'?text='+encodeURIComponent(`Buongiorno, vorrei informazioni su ${tripTitle(t)} del ${fmtDate(t.data_partenza)}.`):'contatti.html';a.textContent='Hai una domanda? Vai ai contatti';box.querySelector('.trip-body')?.append(a);
   return box.innerHTML;
  }).join(''):`<div class="empty"><h3>${failed?'Le partenze torneranno disponibili a breve.':'Nessuna partenza corrisponde alla ricerca.'}</h3><p>${failed?'Puoi contattarci per conoscere date e disponibilità.':'Prova un altro mese o cancella i filtri.'}</p><a class="btn btn-blue" href="contatti.html">Parla con noi</a></div>`;
  v7EnhanceCards();
 }
 function departureStrip(){const strip=$('#nextDepartureStrip');if(!strip)return;const next=trips.filter(available).sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||'')))[0];const heading=strip.querySelector('strong'),label=strip.querySelector('.departure-mark'),action=strip.querySelector('.departure-action');if(next){strip.href='viaggio.html?id='+encodeURIComponent(next.id);label.textContent='PROSSIMA PARTENZA';heading.textContent=`${tripTitle(next)} · ${fmtDate(next.data_partenza)}`;action.textContent='Scopri il viaggio ↗';}else{strip.href='viaggi.html';label.textContent='IN CALENDARIO';heading.textContent=failed?'Chiedici le prossime partenze':'Scopri le prossime partenze';action.textContent='Vedi viaggi ↗';}}
 const update=list=>{trips=DGTripDiscovery.filter(list||[],{today:today()});window.__dgTrips=trips;ready=true;failed=false;render();departureStrip();};
 $('#journeySearch').addEventListener('submit',e=>{e.preventDefault();render();$('#partenze').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});$('#partenze').focus({preventScroll:true});});
 ['#journeyDestination','#journeyMonth','#journeyFrom','#availableOnly'].forEach(s=>$(s).addEventListener('input',render));
 $('#resetSearch').onclick=()=>{$('#journeySearch').reset();$('#availableOnly').checked=false;render();};
 // Un solo sistema di ricerca nella home.
 document.addEventListener('keydown',e=>{if((e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();e.stopImmediatePropagation();$('#journeyDestination').focus();}},true);
 function carousel(){const imgs=[...$('#heroMedia').querySelectorAll('img')];if(imgs.length<2)return;const controls=$('#heroControls');controls.hidden=false;let current=0,playing=false,timer;
  const show=n=>{current=(n+imgs.length)%imgs.length;imgs.forEach((x,i)=>x.classList.toggle('show',i===current));$('#heroCount').textContent=`${String(current+1).padStart(2,'0')} / ${String(imgs.length).padStart(2,'0')}`;};
  const sync=()=>{clearInterval(timer);$('#heroPause').textContent=playing?'Pausa':'Riproduci';$('#heroPause').setAttribute('aria-label',playing?'Metti in pausa lo scorrimento':'Avvia scorrimento automatico');if(playing&&!document.hidden)timer=setInterval(()=>show(current+1),6500);};
  controls.querySelectorAll('[data-slide]').forEach(b=>b.onclick=()=>{show(current+Number(b.dataset.slide));sync();});$('#heroPause').onclick=()=>{playing=!playing;sync();};document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;sync();}});playing=!reduced.matches;show(0);sync();
 }
 function fleet(){const rail=$('#fleetGrid');document.querySelectorAll('[data-rail]').forEach(b=>b.onclick=()=>rail.scrollBy({left:Number(b.dataset.rail)*(rail.clientWidth*.8),behavior:reduced.matches?'instant':'smooth'}));rail.querySelectorAll('a').forEach(a=>{const label=document.createElement('span');label.className='fleet-caption';label.textContent=a.querySelector('img')?.alt||'Scopri il mezzo';a.append(label);});}
 async function start(){try{if(typeof home!=='function')throw Error('Caricamento non disponibile');await home();clearInterval(window.__dgTripRefreshTimer);update(window.__dgTrips);failed=Boolean(window.__dgTripsError);if(failed){render();departureStrip();}carousel();fleet();if(!$('#nextExperience').children.length)$('#prossima-partenza').hidden=true;if(!$('#postGrid .news-card'))$('.premium-story').hidden=true;
  // Evidenzia la prima partenza realmente disponibile, altrimenti mostra l'elenco.
  const next=trips.find(available);if(next){const box=$('#nextExperience');box.innerHTML=grid.querySelector('[data-trip-id="'+CSS.escape(String(next.id))+'"]')?.outerHTML||tripCard(next);box.classList.add('featured-trip');}else $('#prossima-partenza').hidden=true;
 }catch(e){failed=true;ready=true;render();departureStrip();$('#prossima-partenza').hidden=true;$('#fleetGrid').innerHTML='<a class="empty" href="flotta.html">Scopri la nostra flotta →</a>';$('.premium-story').hidden=true;}
 }
 let refreshing=false;async function refresh(){if(document.hidden||refreshing||!ready)return;refreshing=true;try{update(await getGestionaleTrips());}catch{ $('#journeyResults').textContent='Aggiornamento non disponibile: verifica i posti prima di prenotare.';}finally{refreshing=false;}}
 // Le funzioni globali esistenti richiamano questo riferimento al ritorno sulla pagina.
 start().then(()=>{window.__dgTripRefresh=refresh;setInterval(refresh,60000);});
})();
