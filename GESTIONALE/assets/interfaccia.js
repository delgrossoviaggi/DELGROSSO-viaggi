/* DELGROSSO 3.0 Premium: data shown as LIVE only after an authorized Supabase login.
   No service-role, no destructive calls, no credentials persisted in browser storage. */
'use strict';
const $=sel=>document.querySelector(sel);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const fmtDate=v=>!v?'—':new Date(String(v).length===10?v+'T12:00:00':v).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});
const status=v=>{let s=String(v||'—');return `<span class="chip ${/annull|error|storno/i.test(s)?'warn':/conferm|ricev|attiv|programm|paid|sold/i.test(s)?'ok':''}">${esc(s)}</span>`};
const today=()=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'short',year:'numeric'}).format(new Date());
const NAV=[
 ['CENTRO OPERATIVO', [['dashboard','▦','Dashboard'],['trips','♧','Viaggi e partenze'],['bookings','▣','Prenotazioni'],['control','◈','Control Room'],['layouts','▦','Piantine autobus']]],
 ['GESTIONE AZIENDALE', [['fleet','▰','Flotta'],['customers','♙','Clienti CRM'],['payments','▤','Pagamenti'],['cash','€','Cassa generale'],['nicola','€','Contabilità Nicola'],['raffaele','€','Contabilità Raffaele']]],
 ['SERVIZI E ARCHIVIO', [['rentals','♢','Noleggi'],['agenda','◷','Agenda'],['whatsapp','◉','WhatsApp'],['documents','▤','Documenti e PDF'],['invoices','▧','Fatturazione'],['notifications','♧','Notifiche'],['reports','▤','Report e liste']]],
];
const DTRIPS=[
 {id:'demo-napoli',titolo:'Napoli & Spaccanapoli',destinazione:'Napoli (NA)',data_partenza:'2026-12-08',ora_partenza:'05:40',prezzo:20,stato:'Programmato',posti_totali:63,posti_occupati:42,posti_liberi:21,autobus:'Irizar Scania PB',minimo_partecipanti:40},
 {id:'demo-larino',titolo:'Mercatini di Natale a Larino',destinazione:'Larino (CB)',data_partenza:'2026-12-13',ora_partenza:'06:15',prezzo:25,stato:'Programmato',posti_totali:57,posti_occupati:37,posti_liberi:20,autobus:'Irizar Scania PB',minimo_partecipanti:40},
 {id:'demo-alberobello',titolo:'Locorotondo & Alberobello',destinazione:'Alberobello (BA)',data_partenza:'2026-12-20',ora_partenza:'06:00',prezzo:28,stato:'Programmato',posti_totali:53,posti_occupati:29,posti_liberi:24,autobus:'Irizar Scania Century',minimo_partecipanti:40},
 {id:'demo-napoli20',titolo:'Napoli & Spaccanapoli',destinazione:'Napoli (NA)',data_partenza:'2026-12-20',ora_partenza:'05:40',prezzo:20,stato:'Programmato',posti_totali:53,posti_occupati:33,posti_liberi:20,autobus:'Irizar Scania Century',minimo_partecipanti:40},
];
const DBOOKINGS=[
 {id:'demo-b01',viaggio_id:'demo-napoli',cliente_nome:'Cliente demo 001',posti:2,posti_selezionati:'9,10',stato:'Acconto ricevuto',totale:40,pagato:20,fermata_partenza:'San Severo FS',checkin_effettuato:false},
 {id:'demo-b02',viaggio_id:'demo-napoli',cliente_nome:'Cliente demo 002',posti:3,posti_selezionati:'19,20,21',stato:'Confermata',totale:60,pagato:60,fermata_partenza:'Apricena',checkin_effettuato:false},
 {id:'demo-b03',viaggio_id:'demo-larino',cliente_nome:'Cliente demo 003',posti:2,posti_selezionati:'11,12',stato:'In attesa acconto',totale:50,pagato:0,fermata_partenza:'San Nicandro Garganico',checkin_effettuato:false},
];
const DFLEET=[
 {id:'f01',titolo:'GT53',marca:'Irizar Scania',modello:'Century',posti:53,categoria:'Gran Turismo',stato:'Attivo',attivo:true,foto_gallery:['https://res.cloudinary.com/dubkmnnkl/image/upload/v1778334235/zhsfptviehtyb93pixij.jpg']},
 {id:'f02',titolo:'GT63 A',marca:'Irizar Scania',modello:'PB',posti:63,categoria:'Gran Turismo',stato:'Attivo',attivo:true,foto_gallery:['https://res.cloudinary.com/dubkmnnkl/image/upload/v1777804054/pgogaclbzsoibzajwqcy.jpg']},
 {id:'f03',titolo:'GT63 B',marca:'Irizar Scania',modello:'PB',posti:63,categoria:'Gran Turismo',stato:'Attivo',attivo:true,foto_gallery:['https://res.cloudinary.com/dubkmnnkl/image/upload/v1784461734/ltaayjbb5568prqmf9kz.jpg']},
 {id:'f04',titolo:'Limousine Bus',marca:'Irizar Scania',modello:'Century',posti:30,categoria:'Limousine',stato:'Attivo',attivo:true,foto_gallery:['https://res.cloudinary.com/dubkmnnkl/image/upload/v1777717322/d9nx2wanppgwaqedikrg.jpg']}
];
const DEMO={trips:DTRIPS,bookings:DBOOKINGS,fleet:DFLEET,customers:[{id:'d1',nome:'Cliente',cognome:'Demo 001',telefono:'',email:''},{id:'d2',nome:'Cliente',cognome:'Demo 002',telefono:'',email:''}],payments:[],notifications:[]};
let authToken='',mode='',page=(window.DGPageRoutes?.current||'dashboard'),me='Operatore',cache={},renderStamp=0,selectedTrip=null;
const menuLabel=id=>NAV.flatMap(x=>x[1]).find(x=>x[0]===id)?.[2]||'Dashboard';
const isDemo=()=>mode==='demo';
const toast=s=>{const e=$('#toast');e.textContent=s;e.classList.add('visible');setTimeout(()=>e.classList.remove('visible'),4200)};
function safeImage(url){try{const u=new URL(url);return u.protocol==='https:'&&(
    u.hostname==='www.delgrossoviaggi.it'||u.hostname==='delgrossoviaggi.it'||
    u.hostname==='chkuayhbmitdmzmmvona.supabase.co'||u.hostname==='res.cloudinary.com')?u.href:''}catch{return ''}}
const fleetSrc=f=>safeImage(f.immagine)||safeImage((Array.isArray(f.foto_gallery)?f.foto_gallery:[]).find(x=>typeof x==='string'));
function mainPanel(title,body,detail=''){return `<section class="panel"><div class="panel-head"><div><h3>${esc(title)}</h3>${detail?`<p>${esc(detail)}</p>`:''}</div></div>${body}</section>`}
function kpi(ico,value,label){return `<div class="kpi"><span class="kpi-icon">${ico}</span><div><span class="big">${esc(value)}</span><small>${esc(label)}</small></div></div>`}
function sec(title,detail=''){return `<div class="section-title"><div><h2>${esc(title)}</h2><p>${esc(detail)}</p></div><span class="chip ${isDemo()?'warn':'ok'}">${isDemo()?'ANTEPRIMA / DATI FITTIZI':'SUPABASE · LIVE'}</span></div>`}
function table(rows,columns){if(!rows.length)return `<div class="empty">Nessun elemento presente in questa sezione.</div>`;
 return `<div class="table-scroll"><table><thead><tr>${columns.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function cardInfo(msg,level='info'){return `<div class="alert ${level}">${esc(msg)}</div>`}
function go(route,id,{replace=false}={}){
 if(!Object.prototype.hasOwnProperty.call(DGPageRoutes.paths,route))throw Error('Pagina non riconosciuta');
 if(id)selectedTrip=id;
 page=route;
 if(/^https?:$/.test(window.location.protocol)){
  const target=new URL(DGPageRoutes.paths[route],window.location.href);
  if(window.location.pathname!==target.pathname){
   const method=replace?'replaceState':'pushState';
   history[method]({dgRoute:route},'',target.pathname+target.search);
  }
 }
 document.body.dataset.startPage=route;
 loadPage();
 if(window.innerWidth<781)toggleMenu(false);
}
function menu(){let html='';for(const [group,items] of NAV){html+=`<div class="nav-caption">${esc(group)}</div>`;for(const [id,icon,name] of items){
  const href=DGPageRoutes.paths[id]||'index.html';
  html+=`<a class="nav-item ${id===page?'active':''}" href="${esc(href)}" data-page="${esc(id)}" ${id===page?'aria-current="page"':''}><span class="nav-icon">${icon}</span><span>${esc(name)}</span></a>`;
 }}$('#premium-nav').innerHTML=html;}
function toggleMenu(open){$('#sidebar').classList.toggle('open',open);$('#mobile-scrim').hidden=!open}
function initialView(){authToken='';if(window.DGData?.sessionActive)window.DGData.signOut();mode='';cache={};$('#app-view').hidden=true;$('#login-view').hidden=false;$('#auth-error').hidden=true}
function start(modeName,name){mode=modeName;me=name||'Operatore';cache={};$('#login-view').hidden=true;$('#app-view').hidden=false;$('#operator-name').textContent=me;
 $('#top-date').textContent=today();$('#sidebar-status').textContent=isDemo()?'ANTEPRIMA GRAFICA':'SUPABASE CONNESSO';
 $('#sidebar-caption').textContent=isDemo()?'Tutti i dati sono simulati':'Operatore autorizzato · lettura protetta';
 $('#readonly-pill').textContent=isDemo()?'◈ DATI FITTIZI':'◉ ACCESSO OPERATORE';
 $('#footer-mode').textContent=isDemo()?'ANTEPRIMA · dati non reali':'1.1 RC Premium Web · sincronizzazione Supabase';
 $('#mode-banner').hidden=!isDemo();$('#mode-banner').textContent=isDemo()?'ANTEPRIMA GRAFICA: numeri, prenotazioni e clienti qui mostrati sono fittizi; non provengono da Supabase. Accedi con le credenziali aziendali per consultare i dati reali.':'';
 page=document.body.dataset.startPage||DGPageRoutes.resolve(location.pathname);document.body.dataset.startPage=page;loadPage();}
async function request(path){
 if(isDemo())throw Error('Funzione non disponibile in anteprima');
 if(path==='dashboard'){
  const [trips,bookings,payments,fleet,customers,notifications]=await Promise.all(['trips','bookings','payments','fleet','customers','notifications'].map(data));
  return DGData.calculateDashboard(trips,bookings,payments,fleet,customers,notifications);
 }
 if(path.startsWith('seat-map/')){
  const id=decodeURIComponent(path.slice('seat-map/'.length)),trip=(await data('trips')).find(x=>x.id===id);
  if(!trip)throw Error('Viaggio non trovato');
  return DGData.getOverview(trip,data);
 }
 return DGData.rows(path);
}
async function data(key){if(isDemo())return DEMO[key];if(cache[key])return cache[key];const x=await request(key);cache[key]=x;return x}
async function dashboard(){if(isDemo()){
 const b=DEMO.bookings;
 return {source:'DEMO',trips_total:DTRIPS.length,trips_upcoming:DTRIPS.length,bookings_total:24,bookings_active:24,booked_passengers:141,reported_paid_on_active_bookings:3240,reported_remaining_on_active_bookings:1260,payments_records:16,fleet_active:4,customers_total:21,notifications_unread:3,upcoming:DTRIPS};}
 return request('dashboard');}
function seatmapDemo(trip){const cap=Number(trip.posti_totali)||53,occupied=Array.from({length:Number(trip.posti_occupati)||0},(_,i)=>i+1);
 return {trip,trip_id:trip.id,capacity:cap,occupied,occupied_count:occupied.length,free_count:cap-occupied.length,
 legacy_only:[],relational_only:[],over_capacity:[],counter_claim:occupied.length,counter_mismatch:false,bookings_count:12,checked_in_count:0};}
async function seatmap(trip){if(isDemo())return seatmapDemo(trip);return request('seat-map/'+encodeURIComponent(trip.id))}
function seatsBlock(map,preview=false){const active=new Set(map.occupied||[]),legacy=new Set(map.legacy_only||[]);
 const tiles=[];const shown=preview?Math.min(map.capacity,24):map.capacity;for(let i=1;i<=shown;i++){
  const position=(i-1)%4;
  if(position===2)tiles.push('<span class="seat aisle"></span>');
  tiles.push(`<span class="seat ${active.has(i)?'occupied':''} ${legacy.has(i)?'legacy':''}" title="Posto ${i} · ${active.has(i)?'occupato':'libero'}">${i}</span>`)}
 return `<div class="seat-grid" role="img" aria-label="Piantina di ${map.capacity} posti: ${map.occupied_count} occupati">${tiles.join('')}</div>
 <div class="legend"><span><i></i>Occupato</span><span><i class="free"></i>Libero</span>${legacy.size?'<span><i class="legacy"></i>Solo storico</span>':''}</div>`}
function getTripLabel(t){return t.titolo||t.destinazione||'Viaggio';}
function tripStatus(t){return status(t.stato||'Programmato')}
function navButton(label,route,id){return `<button class="btn-secondary" data-go="${esc(route)}" ${id?`data-trip="${esc(id)}"`:''}>${esc(label)} →</button>`}
function heroFleet(fleet){const list=fleet.filter(x=>!/mercedes|v250/i.test([x.marca,x.modello,x.titolo].join(' '))).slice(0,4);
 return `<div class="hero-fleet">${list.map(x=>`<div class="fleet-hero-card" title="${esc((x.marca||'')+' '+(x.modello||''))}"><span class="bus-glyph">🚌</span>${fleetSrc(x)?`<img src="${esc(fleetSrc(x))}" alt="Autobus della flotta">`:""}</div>`).join('')}</div>`}
async function pageDashboard(){const [s,fl]=await Promise.all([dashboard(),data('fleet')]);const trip=s.upcoming?.[0];let map=null;
 if(trip){try{map=await seatmap(trip)}catch(e){console.info('Piantina non disponibile',e.message)}}
 const tripBookings=isDemo()?24:s.bookings_active;
 const kpis=`<div class="kpi-grid">${kpi('🚌',s.trips_upcoming,'Viaggi da effettuare')}${kpi('▣',tripBookings,'Prenotazioni attive')}${kpi('♙',s.booked_passengers,'Posti prenotati')}${kpi('€',euro(s.reported_paid_on_active_bookings),'Quote pagate registrate')}${kpi('◷',euro(s.reported_remaining_on_active_bookings),'Quote ancora da riscuotere')}</div>`;
 const hero=`<section class="hero"><div class="hero-text"><span class="sup">DELGROSSO VIAGGI &amp; LIMOUSINE BUS</span><h2>Benvenuto, ${esc(me)} ✦</h2><p>Il centro operativo dei tuoi viaggi. Prenotazioni, flotta e situazione economica in un'unica Control Room professionale.</p><button class="hero-btn" data-go="control">Apri la Control Room →</button></div>${heroFleet(fl)}</section>`;
 const current=trip&&map?`<div class="control-grid">
 <div class="control-trip"><span class="trip-pill">${esc(trip.stato||'Programmato')}</span><h3>${esc(getTripLabel(trip))}</h3><p class="destination">${fmtDate(trip.data_partenza)} · ${esc(trip.ora_partenza||'Orario da verificare')}</p>
 <div class="control-meta"><div class="info-row"><span>Destinazione</span><b>${esc(trip.destinazione||'—')}</b></div><div class="info-row"><span>Bus assegnato</span><b>${esc(trip.autobus||'Da verificare')}</b></div><div class="info-row"><span>Quota per persona</span><b>${euro(trip.prezzo)}</b></div><div class="info-row"><span>Capienza registrata</span><b>${map.capacity} posti</b></div></div><div style="margin-top:15px">${navButton('Apri piantina completa','control',trip.id)}</div></div>
 <div class="control-seat"><p class="seat-title">PIANTINA · ${map.capacity} POSTI <small>(anteprima 24)</small></p>${seatsBlock(map,true)}</div>
 <div class="control-details"><div class="detail-box"><small>Stato prenotazioni</small><strong>${map.occupied_count} / ${map.capacity}</strong><div class="progress"><span style="width:${map.capacity?Math.min(100,100*map.occupied_count/map.capacity):0}%"></span></div></div><div class="detail-box"><small>Check-in prenotazioni</small><strong>${map.checked_in_count} <span style="font-size:12px;font-weight:600">effettuati</span></strong></div></div>
 </div>${map.counter_mismatch?cardInfo('Attenzione: il contatore di occupazione differisce dal calcolo dei posti storici e relazionali. Verifica prima di assegnare nuovi sedili.','warn'):''}`:
 '<div class="empty">Nessun viaggio futuro oppure lettura della piantina non disponibile.</div>';
 const quick=`<div class="quick-grid">${[['fleet','🚌','Flotta aziendale','Mezzi e capienza dei posti'],['bookings','▣','Prenotazioni','Stato e posti assegnati'],['customers','♙','Clienti e CRM','Anagrafiche e recapiti'],['reports','▤','Documenti e report','Elenco prenotati CSV']].map(([id,icon,t,sub])=>`<button class="quick-tile" data-go="${id}"><span class="quick-icon">${icon}</span><span><strong>${t}</strong><small>${sub}</small></span><span class="quick-chevron">›</span></button>`).join('')}</div>`;
 const next=table((s.upcoming||[]).slice(0,8),[['PARTENZA',x=>fmtDate(x.data_partenza)],['VIAGGIO',x=>`<strong>${esc(getTripLabel(x))}</strong>`],['BUS',x=>esc(x.autobus||'—')],['POSTI',x=>`${esc(x.posti_occupati||0)} / ${esc(x.posti_totali||0)}`],['STATO',x=>tripStatus(x)],['',x=>navButton('Apri','control',x.id)]]);
 return hero+kpis+`<div class="content-grid"><section class="panel control-card"><div class="panel-head"><div><h3>◈ &nbsp; Control Room</h3><p>Monitoraggio reale di viaggi, posti disponibili e check-in</p></div>${navButton('Dettaglio','control')}</div>${current}</section><section class="panel" style="margin:0"><div class="panel-head"><div><h3>Accessi rapidi</h3><p>Il tuo centro di comando</p></div></div>${quick}</section></div>
 <div class="content-grid bottom">${mainPanel('Prossime partenze',next,'Viaggi letti dal sistema aziendale')}
 ${mainPanel('Situazione operativa',`<div class="metric-belt"><div class="mini-metric"><strong>${s.customers_total}</strong><span>Clienti registrati</span></div><div class="mini-metric"><strong>${s.fleet_active}</strong><span>Mezzi attivi</span></div><div class="mini-metric"><strong>${s.notifications_unread}</strong><span>Notifiche non lette</span></div></div>${cardInfo('I valori economici riportano i campi delle prenotazioni: per i totali di cassa serve la riconciliazione tra movimenti e operatori.','info')}`,'Numeri e controlli aziendali')}</div>`;
}
async function pageTrips(){const trips=await data('trips');return sec('Viaggi e partenze','Elenco viaggi letto dal progetto Supabase gestionale')+
 `<div class="filters"><label class="search-box">⌕ <input id="filter-trips" placeholder="Cerca viaggio, destinazione, autobus..."></label><span class="chip">${trips.length} viaggi registrati</span></div><div id="table-trips">${renderTripTable(trips)}</div>`}
function renderTripTable(rows){return mainPanel('Programmazione dei viaggi',table(rows,[['DATA',x=>fmtDate(x.data_partenza)],['VIAGGIO',x=>`<strong>${esc(getTripLabel(x))}</strong><div class="small-note">${esc(x.destinazione||'')}</div>`],['AUTOBUS',x=>esc(x.autobus||'Da assegnare')],['CAPIENZA',x=>`${esc(x.posti_occupati||0)} / ${esc(x.posti_totali||0)}`],['PREZZO',x=>euro(x.prezzo)],['STATO',x=>tripStatus(x)],['AZIONE',x=>navButton('Control Room','control',x.id)]]))}
async function pageBookings(){const [rows,trips]=await Promise.all([data('bookings'),data('trips')]);const ids=Object.fromEntries(trips.map(x=>[x.id,getTripLabel(x)]));const active=rows.filter(x=>!/annull|cancel/i.test(x.stato||''));return sec('Prenotazioni','Riepilogo prenotati, quote, fermate e sedili registrati')+
 `<div class="metric-belt" style="margin-bottom:17px"><div class="mini-metric"><strong>${rows.length}</strong><span>Prenotazioni totali</span></div><div class="mini-metric"><strong>${active.length}</strong><span>Non annullate</span></div><div class="mini-metric"><strong>${active.reduce((n,x)=>n+Number(x.posti||0),0)}</strong><span>Posti dichiarati</span></div></div>
 <div class="filters"><label class="search-box">⌕ <input id="filter-bookings" placeholder="Cerca nominativo, viaggio, fermata..."></label><select id="bookings-trip"><option value="">Tutti i viaggi</option>${trips.map(x=>`<option value="${esc(x.id)}">${esc(getTripLabel(x))}</option>`).join('')}</select></div><div id="table-bookings">${renderBookingTable(rows,ids)}</div>${cardInfo('In alcune prenotazioni legacy i posti sono presenti soltanto nel campo storico. Il nuovo gestionale non li considera liberi automaticamente.','info')}`}
function renderBookingTable(rows,trips){return mainPanel('Prenotazioni',table(rows,[['REFERENTE',x=>`<strong>${esc(x.cliente_nome||x.cliente||'—')}</strong>`],['VIAGGIO',x=>esc(trips[x.viaggio_id]||'—')],['SEDILI',x=>esc(x.posti_selezionati||'Da verificare')],['PERSONE',x=>esc(x.posti)],['FERMATA',x=>esc(x.fermata_partenza||'—')],['QUOTA PAGATA',x=>euro(x.pagato)],['STATO',x=>status(x.stato)]]))}
async function pageControl(){const trips=await data('trips');if(!trips.length)return sec('Control Room')+cardInfo('Nessun viaggio disponibile');
 const wanted=trips.find(x=>x.id===selectedTrip)||trips.find(x=>x.data_partenza>=new Date().toISOString().slice(0,10))||trips[0];selectedTrip=wanted.id;
 return sec('Control Room','Piantine e check-in: controllo senza scrittura nel database')+
 `<div class="filters"><select id="control-select">${trips.map(x=>`<option ${x.id===selectedTrip?'selected':''} value="${esc(x.id)}">${esc(getTripLabel(x))} · ${fmtDate(x.data_partenza)}</option>`).join('')}</select><span class="chip ok">◉ Sincronizzazione su richiesta</span></div><div id="control-view">${await buildControl(wanted)}</div>`}
async function buildControl(trip){const x=await seatmap(trip);const percent=x.capacity?Math.round(100*x.occupied_count/x.capacity):0;
 const alarm=(x.counter_mismatch?cardInfo(`Contatore Supabase: ${x.counter_claim} posti; piantina calcolata: ${x.occupied_count}. Verificare la fonte dei sedili.`, 'warn'):'')+
 (x.legacy_only.length?cardInfo(`${x.legacy_only.length} posti risultano soltanto dal campo storico. Sono considerati occupati per sicurezza.`,'info'):'')+
 (trip.destinazione?.toLowerCase().includes('larino')&&trip.data_partenza==='2026-12-13'&&x.capacity!==57?cardInfo(`Larino 13/12/2026: Supabase dichiara ${x.capacity} posti, mentre la capienza operativa richiesta è 57. NON modificata: occorre riconciliare e approvare la correzione.`, 'warn'):'');
 return `<div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>${esc(getTripLabel(trip))}</h3><p>${fmtDate(trip.data_partenza)} · ${esc(trip.autobus||'Autobus non specificato')}</p></div>${status(trip.stato)}</div>
 <div class="metric-belt" style="margin-bottom:20px"><div class="mini-metric"><strong>${x.capacity}</strong><span>Capienza</span></div><div class="mini-metric"><strong>${x.occupied_count}</strong><span>Occupati</span></div><div class="mini-metric"><strong>${x.free_count}</strong><span>Disponibili</span></div><div class="mini-metric"><strong>${percent}%</strong><span>Riempimento</span></div></div><div class="control-seat" style="margin:auto;max-width:470px"><p class="seat-title">AUTOBUS · PIANTINA ${x.capacity} POSTI</p>${seatsBlock(x)}</div>${alarm}</section>
 <section class="panel"><div class="panel-head"><div><h3>Stato operativo</h3><p>Informazioni aggiornate da Supabase</p></div></div><div class="control-details" style="display:block"><div class="detail-box" style="margin-bottom:14px"><small>Posti occupati</small><strong>${x.occupied_count} / ${x.capacity}</strong><div class="progress"><span style="width:${percent}%"></span></div></div><div class="detail-box" style="margin-bottom:14px"><small>Check-in prenotazioni</small><strong>${x.checked_in_count} / ${x.bookings_count}</strong></div><div class="detail-box"><small>Posti presenti solo nello storico</small><strong>${x.legacy_only.length}</strong></div></div>${cardInfo('Le azioni operative sono disponibili agli operatori autorizzati: il server Supabase verifica permessi e conflitti.','info')}</section></div>`;}
async function pageFleet(){const rows=(await data('fleet')).sort((a,b)=>Number(b.attivo)-Number(a.attivo));
 return sec('Flotta aziendale','Le schede e le fotografie provengono dai record flotta Supabase')+
 `<div class="fleet-grid">${rows.map(x=>`<article class="panel fleet-card"><div class="fleet-photo"><span>🚌</span>${fleetSrc(x)?`<img src="${esc(fleetSrc(x))}" alt="Foto flotta ${esc(x.modello)}">`:''}</div><div class="fleet-body"><h3>${esc(x.titolo||((x.marca||'')+' '+(x.modello||'')))}</h3><p>${esc((x.marca||'')+' '+(x.modello||''))}</p><div class="fleet-details"><span>${esc(x.posti||'—')} posti</span><span>${esc(x.categoria||'Bus GT')}</span><span>${x.attivo?'Attivo':'Non attivo'}</span></div>${/mercedes|v250/i.test([x.marca,x.modello,x.titolo].join(' '))?cardInfo('Mezzo storico: non previsto nelle promozioni attuali.','info'):''}</div></article>`).join('')}</div>`}
async function pageCustomers(){const rows=await data('customers');return sec('Clienti & CRM','Anagrafica interna con accesso riservato agli operatori autorizzati')+
 `<div class="filters"><label class="search-box">⌕ <input id="filter-customers" placeholder="Cerca cliente, telefono, email..."></label><span class="chip">${rows.length} clienti</span></div><div id="customers-table">${renderCustomers(rows)}</div>`}
function renderCustomers(rows){return mainPanel('Rubrica clienti',table(rows,[['NOMINATIVO',x=>`<strong>${esc([x.nome,x.cognome].filter(Boolean).join(' ')||'—')}</strong>`],['TELEFONO',x=>esc(x.telefono||'—')],['EMAIL',x=>esc(x.email||'—')],['REGISTRATO',x=>fmtDate(x.created_at)]]))}
async function pagePayments(){const rows=await data('payments');return sec('Pagamenti registrati','Dati letti dalla tabella pagamenti Supabase, senza alterazioni')+
 `<div class="metric-belt" style="margin-bottom:17px"><div class="mini-metric"><strong>${rows.length}</strong><span>Movimenti registrati</span></div></div>
 ${cardInfo('Gli importi vanno riconciliati per tipo, stato e storni prima di essere considerati saldo di cassa definitivo.','warn')}
 ${mainPanel('Movimenti contabili',table(rows,[['REGISTRATO',x=>fmtDate(x.created_at)],['TIPO',x=>status(x.tipo)],['IMPORTO',x=>euro(x.importo)],['OPERATORE',x=>esc(x.incassato_da||'Da identificare')],['STATO',x=>status(x.stato)]]))}`}
async function pageCash(name){const rows=await data('payments');const groups={};for(const x of rows){const label=x.incassato_da||'Non indicato';
 if(name&&!label.toLocaleLowerCase('it').includes(name.toLocaleLowerCase('it')))continue;
 const k=label;groups[k]??={label,count:0,gross:0};groups[k].count++;groups[k].gross+=Number(x.importo)||0;}
 const grouped=Object.values(groups).sort((a,b)=>b.count-a.count);
 return sec(name?'Contabilità '+name:'Cassa e operatori','Movimenti storici aggregati: non è una quadratura contabile ufficiale')+
 cardInfo('Questi sono importi lordi registrati per operatore, senza certezza di rimborsi, trasferimenti o storni. Non utilizzarli come saldo contabile definitivo.','warn')+
 mainPanel('Totale lordo movimenti per operatore',table(grouped,[['OPERATORE',x=>esc(x.label)],['MOVIMENTI',x=>x.count],['SOMMA IMPORTI',x=>euro(x.gross)]]))}
async function pageNotifications(){const rows=await data('notifications');return sec('Notifiche','Registro delle notifiche presenti nel progetto Supabase')+
 mainPanel('Centro notifiche',table(rows,[['DATA',x=>fmtDate(x.created_at)],['OGGETTO',x=>`<strong>${esc(x.titolo)}</strong>`],['MESSAGGIO',x=>esc(x.messaggio||'—')],['TIPO',x=>status(x.tipo)],['LETTA',x=>x.letto?'Sì':'No']]))}
async function pageReports(){const trips=await data('trips');return sec('Report e liste','Esporta i prenotati dei viaggi, senza scrivere nel database')+
 mainPanel('Elenchi prenotati CSV compatibili con Excel',table(trips,[['VIAGGIO',x=>`<strong>${esc(getTripLabel(x))}</strong>`],['DATA',x=>fmtDate(x.data_partenza)],['CAPIENZA',x=>esc(x.posti_totali||0)],['FILE',x=>isDemo()?'<span class="chip warn">Disabilitato in anteprima</span>':`<button class="btn-secondary" data-download="${esc(x.id)}" data-kind="pdf">PDF prenotati</button> <button class="btn-secondary" data-download="${esc(x.id)}" data-kind="csv">CSV</button> <button class="btn-secondary" data-download="${esc(x.id)}" data-kind="phones">Numeri WhatsApp</button>`]]))+
 cardInfo('Le liste sono riservate all’organizzazione. Custodire i file con dati personali e condividerli solo con i soggetti autorizzati.','info')}
async function pageLayouts(){const trips=await data('trips');return sec('Piantine autobus','Visualizzazione protetta dei sedili reali')+
 cardInfo('Editor e salvataggio piantine non sono ancora collegati alla produzione. Qui puoi consultare la mappa di qualsiasi viaggio.','info')+
 mainPanel('Seleziona una piantina',table(trips,[['VIAGGIO',x=>esc(getTripLabel(x))],['MODELLO',x=>esc(x.autobus||'—')],['CAPIENZA REGISTRATA',x=>esc(x.posti_totali||0)],['PIANTINA',x=>navButton('Visualizza','control',x.id)]]))}
async function pageWhatsapp(){const customers=await data('customers');return sec('Centro WhatsApp Business','Modalità ibrida: messaggi manuali e controllo dell’operatore')+
 cardInfo('I messaggi vengono soltanto preparati: nessun invio automatico. Non aggiungere persone ai gruppi senza consenso.','info')+
 mainPanel('Rubrica di contatto',table(customers.filter(x=>x.telefono).slice(0,100),[['CLIENTE',x=>esc([x.nome,x.cognome].filter(Boolean).join(' '))],['NUMERO',x=>esc(x.telefono)],['AZIONE',x=>{const phone=String(x.telefono||'').replace(/\D/g,'');
 const normalized=phone.startsWith('39')?phone:'39'+phone;return phone.length>=9?`<a class="btn-secondary" href="https://wa.me/${normalized}" target="_blank" rel="noopener noreferrer">Apri WhatsApp ↗</a>`:'Numero non valido'}]]))}
function pagePending(id){const title=menuLabel(id);return sec(title,'Modulo previsto dal progetto DELGROSSO VIAGGI 3.0 ULTIMATE')+
 `<section class="panel" style="max-width:760px"><h3>Integrazione alla produzione da completare</h3>${cardInfo(`La sezione ${title} è disponibile nell’ambiente di sviluppo locale, ma non è ancora connessa con operazioni sicure al database aziendale. Nessun salvataggio online viene simulato.`, 'warn')}
 <p class="small-note">Per modificare i dati aziendali servono procedure transazionali autorizzate, collaudo in staging, backup verificato e controllo dei permessi per ogni azione.</p><p class="small-note">Questa operazione richiede una funzione Supabase configurata e verificata. Consulta la diagnostica prima di usarla in produzione.</p></section>`;}
const renders={dashboard:pageDashboard,trips:pageTrips,bookings:pageBookings,control:pageControl,layouts:pageLayouts,fleet:pageFleet,customers:pageCustomers,payments:pagePayments,
 cash:()=>pageCash(),nicola:()=>pageCash('Nicola'),raffaele:()=>pageCash('Raffaele'),notifications:pageNotifications,reports:pageReports,whatsapp:pageWhatsapp};
async function loadPage(){const stamp=++renderStamp;menu();$('#page-heading').innerHTML=esc(menuLabel(page))+' <span>3.0</span>';$('#breadcrumbs').textContent='DELGROSSO / '+menuLabel(page).toUpperCase();$('#page-content').innerHTML='<div class="loading">◌ Sincronizzazione dati in corso…</div>';
 try{let html=await (renders[page]||(()=>pagePending(page)))();if(stamp!==renderStamp)return;$('#page-content').innerHTML=html;
 attachPageEvents();}catch(e){if(stamp!==renderStamp)return;$('#page-content').innerHTML=sec(menuLabel(page))+cardInfo('Impossibile leggere i dati: '+e.message,'warn');}}
function attachPageEvents(){if($('#filter-trips')){$('#filter-trips').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase('it');$('#table-trips').innerHTML=renderTripTable(cache.trips.filter(x=>[x.titolo,x.destinazione,x.autobus].join(' ').toLocaleLowerCase('it').includes(q)))});if(isDemo())cache.trips=DTRIPS;}
 if($('#filter-bookings')){if(isDemo()){cache.bookings=DBOOKINGS;cache.trips=DTRIPS;}const update=()=>{const q=$('#filter-bookings').value.toLocaleLowerCase('it'),id=$('#bookings-trip').value;
 const trips=Object.fromEntries(cache.trips.map(x=>[x.id,getTripLabel(x)]));$('#table-bookings').innerHTML=renderBookingTable(cache.bookings.filter(x=>(!id||x.viaggio_id===id)&&[x.cliente_nome,x.cliente,x.fermata_partenza,trips[x.viaggio_id]].join(' ').toLocaleLowerCase('it').includes(q)),trips)};
 $('#filter-bookings').addEventListener('input',update);$('#bookings-trip').addEventListener('change',update)}
 if($('#filter-customers')){if(isDemo())cache.customers=DEMO.customers;$('#filter-customers').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase('it');$('#customers-table').innerHTML=renderCustomers(cache.customers.filter(x=>[x.nome,x.cognome,x.telefono,x.email].join(' ').toLocaleLowerCase('it').includes(q)))});}
 if($('#control-select')){$('#control-select').addEventListener('change',async e=>{selectedTrip=e.target.value;const t=(await data('trips')).find(x=>x.id===selectedTrip);$('#control-view').innerHTML='<div class="loading">Caricamento piantina…</div>';try{$('#control-view').innerHTML=await buildControl(t)}catch(err){$('#control-view').innerHTML=cardInfo(err.message,'warn')}})}
}
async function csvDownload(id,kind="csv"){
 try{
  if(isDemo())throw Error('Esportazioni disabilitate con dati fittizi');
  const [trips,bookings]=await Promise.all([data('trips'),data('bookings')]);const trip=trips.find(x=>x.id===id);
  if(!trip)throw Error('Viaggio non trovato');
  const list=bookings.filter(b=>b.viaggio_id===id&&!/annull|cancel|cancell/i.test(b.stato||''));
  const simple=String(getTripLabel(trip)).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').slice(0,42);
  if(kind==='pdf'){DGData.printBookings(trip,bookings);toast('Usa Stampa → Salva come PDF (anche su iPhone)');return}
  if(kind==='phones'){
   const seen=new Set(),rows=[['TELEFONO_WHATSAPP','CLIENTE','POSTI']];
   for(const b of list){const digits=String(b.telefono||'').replace(/\D/g,'');const phone=digits.startsWith('39')?digits:'39'+digits;
    if(digits.length>=9&&!seen.has(phone)){seen.add(phone);rows.push([phone,b.cliente_nome||b.cliente||'',b.posti||''])}}
   DGData.downloadCSV(rows,'DELGROSSO_CONTATTI_'+simple+'.csv');
  }else{
   const rows=[['CLIENTE','TELEFONO','POSTI','FERMATA','PERSONE','STATO','TOTALE','PAGATO']];
   for(const b of list)rows.push([b.cliente_nome||b.cliente,b.telefono,b.posti_selezionati,b.fermata_partenza,b.posti,b.stato,b.totale,b.pagato]);
   DGData.downloadCSV(rows,'DELGROSSO_PRENOTATI_'+simple+'.csv');
  }
  toast('Esportazione generata dal browser');
 }catch(e){toast(e.message)}
}
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement)e.target.style.display='none'},true);
document.addEventListener('click',e=>{const item=e.target.closest('[data-page]');if(item){e.preventDefault();go(item.dataset.page);return}const g=e.target.closest('[data-go]');if(g){go(g.dataset.go,g.dataset.trip);return}const d=e.target.closest('[data-download]');if(d){csvDownload(d.dataset.download,d.dataset.kind);return}});
window.addEventListener('popstate',()=>{
 const next=DGPageRoutes.resolve(location.pathname);
 page=next;
 document.body.dataset.startPage=next;
 if(mode)loadPage();
});
$('#mobile-scrim').addEventListener('click',()=>toggleMenu(false));$('#menu-toggle').addEventListener('click',()=>toggleMenu(true));
$('#logout').addEventListener('click',initialView);$('#refresh').addEventListener('click',()=>{cache={};loadPage();toast('Aggiornamento richiesto')});
$('#demo-start').addEventListener('click',()=>{authToken='';start('demo','Nicola')});
// Sincronizzazione multioperatore: i dati vengono ricaricati dopo ogni
// modifica confermata in Supabase. Nessun polling in modalità demo.
window.addEventListener('dg3:mutazione-confermata',()=>{cache={};});
let ultimoRefreshDG3=Date.now();
function sincronizzaDG3({force=false}={}){
 if(mode!=='live'||document.hidden||$('#dg-modal')?.classList.contains('show'))return;
 if(!force&&Date.now()-ultimoRefreshDG3<90000)return;
 ultimoRefreshDG3=Date.now();cache={};loadPage();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sincronizzaDG3();});
window.addEventListener('focus',()=>sincronizzaDG3());
// Polling leggero 90 s solo se la schermata è attiva e non ci sono modali.
setInterval(()=>sincronizzaDG3(),90000);

$('#live-login-form').addEventListener('submit',async e=>{e.preventDefault();$('#auth-error').hidden=true;
 const btn=$('#login-submit');btn.disabled=true;const loginForm=e.target;const form=new FormData(loginForm);
 try{const body=await DGData.signInOperator(form.get('username'),form.get('password'));authToken='session-in-memory';
  loginForm.reset();start('live',body.display_name||'Operatore');
 }catch(err){$('#auth-error').textContent=err.message;$('#auth-error').hidden=false}
 finally{btn.disabled=false}
});
(async()=>{const data=DGData.status();
 $('#connect-state').textContent=data.configured?'◌ Accesso Supabase configurato · da verificare con il login':'◌ Collegamento Supabase non configurato';
 $('#connect-state').style.borderColor=data.configured?'#436883':'#aa753e';
 if(new URL(location.href).searchParams.get('demo')==='1')start('demo','Nicola');
})();
