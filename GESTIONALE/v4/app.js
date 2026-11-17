import {
 API_URL,WRITES_ENABLED,esc,eur,num,dateIT,dateTimeIT,todayItaly,bookingActive,bookingName,tripName,
 seatsOf,uniquePhones,occupancy,breakdown,login,resume,logout,records,rpcRead,writeRpc,mutate,
 currentUser,clearCache,signedReceiptPath
} from './core.js';

const $=id=>document.getElementById(id);
const NAV={
 dashboard:'Dashboard',trips:'Viaggi e partenze',bookings:'Prenotazioni',
 control:'Control Room',layouts:'Piantine autobus',cash:'Contabilità e casse',
 economy:'Economia e costi',customers:'Clienti',rentals:'Noleggi bus',
 agenda:'Agenda e scadenze',fleet:'Flotta GT',documents:'Documenti',
 notifications:'Notifiche',diagnostics:'Diagnostica'
};
let operator=null, page='dashboard', ticket=0;
const state={trip:'',stop:'',search:'',bookingsState:'active',pendingAction:'',all:{}};
const money=eur;
const safeText=s=>esc(s||'—');
const short=id=>id?String(id).slice(0,8):'—';
const safeLink=(label,id,action='detail-booking')=>'<button class="inline-link" data-action="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const badge=(text)=>{
 const s=String(text||'—');
 const cls=/annull|rimbors|negat|errore/i.test(s)?'bad':/attesa|pend|parzial|ritardo/i.test(s)?'warn':/saldat|ricevuto|complet|pagat|attiv|confermat/i.test(s)?'good':'neutral';
 return '<span class="badge '+cls+'">'+esc(s)+'</span>';
};
const intro=(title,sub,extra='')=>'<div class="page-intro"><div><h2>'+esc(title)+'</h2><p>'+esc(sub)+'</p></div><div class="toolbar">'+extra+'</div></div>';
const card=(label,value,detail='')=>'<div class="stat"><div class="statlabel">'+esc(label)+'</div><div class="statval">'+esc(value)+'</div><div class="statdesc">'+esc(detail)+'</div></div>';
const panel=(title,sub,content,extra='')=>'<section class="panel"><div class="panel-head"><div><h3>'+esc(title)+'</h3>'+ (sub?'<p>'+esc(sub)+'</p>':'')+'</div>'+extra+'</div>'+content+'</section>';
const table=(headers,rows)=>'<div class="table-wrap">'+(rows.length?'<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty">Nessuna voce presente nei dati attualmente visibili.</div>')+'</div>';
const selectTrip=(trips,selected,empty='Tutti i viaggi')=>'<select id="filter-trip"><option value="">'+esc(empty)+'</option>'+trips.map(t=>'<option value="'+esc(t.id)+'" '+(selected===t.id?'selected':'')+'>'+esc(tripName(t)+' · '+dateIT(t.data_partenza)+(num(t.bis_numero)>1?' · BUS '+t.bis_numero:''))+'</option>').join('')+'</select>';
const searchField=(placeholder='Cerca cliente, viaggio, codice…')=>'<input type="search" id="filter-search" aria-label="Cerca" placeholder="'+esc(placeholder)+'" value="'+esc(state.search)+'"/>';
const writeBadge=()=>WRITES_ENABLED?'':'<span class="badge warn">Modifiche bloccate fino al backup verificato</span>';
const writeButton=(text,action,attrs='')=>'<button class="primary" data-action="'+action+'" '+attrs+(WRITES_ENABLED?'':' disabled title="Sblocco dopo backup e collaudo"')+'>'+esc(text)+'</button>';
const get=t=>state.all[t]||[];
const filterTerm = (...values) => !state.search || values.some(v=>String(v||'').toLocaleLowerCase('it').includes(state.search.toLocaleLowerCase('it')));
const activeTrip=t=>!t.archiviato_at;
const sortTrip=(a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))||String(a.ora_partenza).localeCompare(String(b.ora_partenza))||num(a.bis_numero)-num(b.bis_numero);
const tripBy=id=>get('trips').find(x=>x.id===id);
function showMessage(msg,error=false) {
 const f=$('feedback');f.hidden=false;f.className='feedback'+(error?' error':'');f.textContent=msg;
}
function errorPanel(resource,e){return '<div class="error-panel"><strong>Connessione non verificata: '+esc(resource)+'</strong><p>'+esc(e.message||e)+'</p><p>Non effettuare operazioni ripetute se il database segnala errori.</p></div>';}
function displayModal(title,body){$('modal-heading').textContent=title;$('modal-content').innerHTML=body;$('modal').hidden=false;$('modal-close').focus();}
function closeModal(){$('modal').hidden=true;$('modal-content').innerHTML='';}
async function fetchResources(names,force=false){
 const uniq=[...new Set(names)];
 const results=await Promise.allSettled(uniq.map(n=>records(n,{force,limit: n==='notifications'?250:1200,order:(n==='trips'?'data_partenza.asc':n==='notifications'?'created_at.desc':n==='agenda'?'data_scadenza.asc':undefined)})));
 const errors=[];
 results.forEach((r,i)=>{if(r.status==='fulfilled')state.all[uniq[i]]=r.value;else{state.all[uniq[i]]=[];errors.push({name:uniq[i],error:r.reason});}});
 if(errors.length)showMessage(errors.map(x=>x.name+': '+String(x.error?.message||x.error)).join(' · '),true);
 return errors;
}
async function navigate(next,force=false){
 if(!NAV[next])next='dashboard';
 page=next;const mine=++ticket;
 $('page-title').textContent=NAV[next];$('breadcrumb').textContent=NAV[next].toUpperCase();
 document.querySelectorAll('#nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===next));
 $('sidebar').classList.remove('open');$('main').innerHTML='<div class="loading-state"><span class="spinner"></span>Consultazione dati Supabase…</div>';
 const needs={
 dashboard:['trips','bookings','payments','agenda','notifications'],
 trips:['trips','bookings'],
 bookings:['trips','bookings','payments','seats'],
 control:['trips','bookings','seats','tripLayouts','stops'],
 layouts:['trips','fleet','layoutLibrary','tripLayouts','busLayouts'],
 cash:['cash','operators','payments','transfers','trips','bookings'],
 economy:['economy','profit','trips'],
 customers:['customers','bookings','payments'],
 rentals:['rentals'],
 agenda:['agenda','trips'],
 fleet:['fleet'],
 documents:['documents','trips'],
 notifications:['notifications'],
 diagnostics:['system','alerts','trips','bookings','payments','seats']
 };
 try {
  await fetchResources(needs[next],force);
  if(mine!==ticket)return;
  const views={dashboard:drawDashboard,trips:drawTrips,bookings:drawBookings,
   control:drawControl,layouts:drawLayouts,cash:drawCash,economy:drawEconomy,
   customers:drawCustomers,rentals:drawRentals,agenda:drawAgenda,
   fleet:drawFleet,documents:drawDocuments,notifications:drawNotifications,diagnostics:drawDiagnostics};
  $('main').innerHTML=views[next]();
  document.title='DELGROSSO 4.0 · '+NAV[next];
  history.replaceState(null,'','#'+encodeURIComponent(next));
 } catch(error) {
  if(mine!==ticket)return;
  $('main').innerHTML=errorPanel(NAV[next],error);
 }
}
function drawDashboard(){
 const trips=get('trips'),books=get('bookings'),pay=get('payments');
 const info=breakdown(trips,books,pay),today=todayItaly();
 const upcoming=trips.filter(t=>activeTrip(t)&&t.data_partenza>=today).sort(sortTrip).slice(0,7);
 const cards='<div class="cards">'+
 card('Viaggi programmati',String(info.upcoming),'Totale a sistema: '+trips.length)+
 card('Passeggeri registrati',String(info.passengers),info.bookings+' prenotazioni valide')+
 card('Incassi registrati',money(info.collected),'Movimenti economici storici')+
 card('Saldo ancora da incassare',money(info.outstanding),'Stima da totale/pagato delle prenotazioni')+'</div>';
 const recent=get('notifications').slice(0,6).map(n=>'<div class="notice-card"><strong>'+esc(n.titolo)+'</strong><p>'+esc(n.messaggio)+'</p><span class="small muted">'+dateTimeIT(n.created_at)+'</span></div>').join('')||'<div class="empty">Nessuna notifica.</div>';
 const journeys=upcoming.length?upcoming.map(t=>{
  const allocated=books.filter(b=>b.viaggio_id===t.id&&bookingActive(b)).reduce((n,b)=>n+num(b.posti),0);
  const cap=num(t.posti_totali);const pc=cap?Math.min(100,allocated/cap*100):0;
  return '<div class="trip-card"><div class="trip-date"><b>'+esc(String(t.data_partenza||'').slice(8,10))+'</b><small>'+esc(String(t.data_partenza||'').slice(5,7))+'</small></div><div class="trip-body"><strong>'+esc(tripName(t))+'</strong><p>'+esc(t.destinazione||'')+' · '+esc(String(t.ora_partenza||'').slice(0,5))+'</p>'+badge(t.stato)+'</div><div class="trip-end"><div class="progress-track"><div class="progress-fill" style="width:'+pc+'%"></div></div><small>'+allocated+' / '+cap+' posti</small></div></div>';
 }).join(''):'<div class="empty">Nessuna partenza futura.</div>';
 const due=get('agenda').filter(a=>a.data_scadenza>=today && a.stato!=='completata').slice(0,7);
 return intro('Buongiorno, '+(operator?.nome||operator?.username||'Operatore')+' 👋','La tua centrale operativa: dati letti dal progetto Supabase aziendale.','<button class="secondary" data-action="refresh">↻ Ricarica</button>')+
 cards+'<div class="two-col">'+
 panel('Prossime partenze','Viaggi futuri, ordinati per data','<div>'+journeys+'</div>','<button class="soft smallbtn" data-page="trips">Apri viaggi</button>')+
 panel('Centro notifiche','Ultimi eventi registrati','<div class="panel-body">'+recent+'</div>','<button class="soft smallbtn" data-page="notifications">Tutte</button>')+
 '</div>'+panel('Agenda e impegni','Scadenze ancora aperte',table(['Scadenza','Attività','Priorità'],due.map(a=>[dateIT(a.data_scadenza),esc(a.titolo),badge(a.priorita)])),'<button class="soft smallbtn" data-page="agenda">Apri agenda</button>');
}
function drawTrips(){
 const trips=get('trips').filter(t=>filterTerm(t.titolo,t.destinazione,t.id_viaggio)).sort(sortTrip);
 const books=get('bookings');
 const rows=trips.map(t=>{
  const valid=books.filter(b=>b.viaggio_id===t.id&&bookingActive(b));
  const assigned=valid.reduce((n,b)=>n+num(b.posti),0);
  const available=Math.max(0,num(t.posti_totali)-assigned);
  return [
   '<span class="table-title">'+safeLink(tripName(t),t.id,'detail-trip')+'</span><small class="row-sub">'+esc(t.destinazione)+' · '+esc(t.id_viaggio||short(t.id))+'</small>',
   dateIT(t.data_partenza)+' <span class="small muted">'+esc(String(t.ora_partenza||'').slice(0,5))+'</span>',
   esc(t.autobus||'Da assegnare')+'<small class="row-sub">'+(num(t.bis_numero)>1?'BUS BIS '+num(t.bis_numero):'BUS principale')+'</small>',
   '<b>'+assigned+' / '+num(t.posti_totali)+'</b><small class="row-sub">'+available+' disponibili da registro prenotazioni</small>',
   money(t.prezzo),
   badge(t.archiviato_at?'Archiviato':t.stato)+' '+badge(t.pubblicato==='SI'?'Online':'Non pubblicato'),
   '<div class="row-actions">'+safeLink('Dettagli',t.id,'detail-trip')+'</div>'
  ];
 });
 return intro('Viaggi e partenze','Archivio originale e programmazione della flotta.','<button class="secondary" data-action="refresh">↻ Aggiorna</button>'+writeButton('+ Nuovo viaggio','create-trip'))+
 '<div class="filters">'+searchField('Filtra viaggi, destinazioni o codici')+writeBadge()+'</div>'+
 panel('Tutti i viaggi','Non sono stati creati viaggi dimostrativi',table(['Viaggio','Data','Mezzo','Prenotati','Quota','Stato','Azioni'],rows));
}
function drawBookings(){
 const trips=get('trips').sort(sortTrip),pay=get('payments'),data=get('bookings').filter(b=>(!state.trip||b.viaggio_id===state.trip)&&filterTerm(bookingName(b),b.telefono,b.codice,b.fermata_partenza,tripName(tripBy(b.viaggio_id))) && (state.bookingsState==='all'||(state.bookingsState==='active'?bookingActive(b):!bookingActive(b))));
 const rows=data.map(b=>{
  const paid=pay.filter(p=>p.prenotazione_id===b.id && !/annull|storn/i.test(String(p.stato||''))).reduce((n,p)=>n+num(p.importo),0);
  return [
   '<strong>'+safeLink(bookingName(b),b.id)+'</strong><small class="row-sub">'+esc(b.telefono||'')+'</small>',
   '<span class="table-title">'+esc(tripName(tripBy(b.viaggio_id)))+'</span><small class="row-sub">'+esc(b.codice||short(b.id))+'</small>',
   num(b.posti)+'<small class="row-sub">'+esc(b.posti_selezionati||'Posti da verificare')+'</small>',
   esc(b.fermata_partenza||'—'),
   money(b.totale)+'<small class="row-sub">Registrati: '+money(paid)+'</small>',
   badge(b.stato),b.checkin_effettuato?badge('Presente'):badge('Da verificare'),
   safeLink('Apri',b.id)
  ];
 });
 const sum=data.filter(bookingActive).reduce((n,b)=>n+num(b.posti),0);
 return intro('Prenotazioni','Anagrafica, posti, fermate, pagamenti e check-in.','<button class="secondary" data-action="export-bookings">↓ CSV</button>'+writeButton('+ Prenotazione','create-booking'))+
 '<div class="filters">'+selectTrip(trips,state.trip)+searchField()+'<select id="filter-bookings-state"><option value="active" '+(state.bookingsState==='active'?'selected':'')+'>Attive</option><option value="all" '+(state.bookingsState==='all'?'selected':'')+'>Tutte</option><option value="cancelled" '+(state.bookingsState==='cancelled'?'selected':'')+'>Annullate</option></select></div>'+
 '<div class="cards">'+card('Prenotazioni trovate',String(data.length),'Con filtri selezionati')+card('Persone',String(sum),'Solo prenotazioni attive')+card('Pagamenti',String(pay.length),'Movimenti nel database')+card('Archivio originale',String(get('bookings').length),'Nessun dato sostitutivo')+'</div>'+
 panel('Elenco prenotazioni','Premi sul nominativo per i dettagli',table(['Cliente','Viaggio','Posti','Fermata','Importi','Stato','Check-in','Scheda'],rows));
}
function rowForSeats(rows,occu){
 return rows.map((row,i)=>{
  const cells=Array.isArray(row)?row:(row?.cells||[]);
  return '<div class="seat-grid" role="group" aria-label="Fila '+(i+1)+'">'+cells.map(c=>{
   const x=typeof c==='object'&&c!==null?c:{type:(typeof c==='number'?'seat':'aisle'),label:String(c||'')};
   if(x.type!=='seat')return '<div class="seat aisle" aria-label="Corridoio">'+(x.type==='driver'?'Autista':'')+'</div>';
   const n=String(x.label||x.id||'');
   const b=occu.map.get(n);
   return '<button class="seat '+(b?'booked':'')+'" data-action="'+(b?'detail-booking':'seat-empty')+'" data-id="'+esc(b?.id||'')+'" title="'+esc(b?bookingName(b)+' · Posto '+n:'Posto '+n+' libero')+'">'+esc(n)+'</button>';
  }).join('')+'</div>';
 }).join('');
}
function drawControl(){
 const trips=get('trips').sort(sortTrip);
 const trip=tripBy(state.trip)||trips.find(t=>!t.archiviato_at && t.data_partenza>=todayItaly())||trips[0];
 if(trip&&!state.trip)state.trip=trip.id;
 const books=get('bookings').filter(b=>b.viaggio_id===trip?.id);
 const seats=get('seats'),occu=occupancy(trip,books,seats);
 const official=get('tripLayouts').find(l=>l.viaggio_id===trip?.id);
 const config=official?.configurazione;
 const rows=Array.isArray(config?.rows)?config.rows:[];
 const active=books.filter(bookingActive),stops=[...new Set(active.map(b=>b.fermata_partenza||'Non specificata'))].sort();
 const visible=active.filter(b=>(!state.stop || (b.fermata_partenza||'Non specificata')===state.stop)&&filterTerm(bookingName(b),b.telefono,b.posti_selezionati));
 const roster=visible.map(b=>[
  safeLink(bookingName(b),b.id),num(b.posti),esc(seatsOf(b).join(', ')||'Da verificare'),esc(b.fermata_partenza||'—'),
  b.checkin_effettuato?badge('Check-in fatto'):badge('Da effettuare')
 ]);
 const seatMarkup=rows.length ? rowForSeats(rows,occu) : '<div class="alert">Questo viaggio non ha ancora una piantina ufficiale pubblicata nel database. Non viene mostrata una disposizione inventata. Puoi consultare l’elenco posti assegnati.</div>';
 return intro('Control Room','Piantina ufficiale, passeggeri, fermate e preparazione della lista autista.','<button class="secondary" data-action="print-roster">▤ Lista posti PDF</button><button class="secondary" data-action="copy-phones">Copia numeri</button>')+
 '<div class="filters">'+selectTrip(trips,state.trip,'Seleziona viaggio')+'<select id="filter-stop"><option value="">Tutte le fermate</option>'+stops.map(s=>'<option value="'+esc(s)+'" '+(s===state.stop?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select>'+searchField('Cerca nome o posto')+'</div>'+
 (trip?'<div class="cards">'+card('Viaggio',dateIT(trip.data_partenza),tripName(trip))+card('Passeggeri attivi',String(active.reduce((n,b)=>n+num(b.posti),0)),active.length+' prenotazioni')+card('Posti nel registro',String(occu.map.size),num(trip.posti_totali)+' capienza')+card('Check-in',String(active.filter(b=>b.checkin_effettuato).length),active.length+' prenotazioni')+'</div>':'')+
 (occu.warnings.length?'<div class="error-panel">'+esc(occu.warnings.join(' · '))+'</div>':'')+
 '<div class="two-col">'+panel('Piantina ufficiale',official?'Versione '+num(official.versione)+' · '+esc(config?.name||'Layout ufficiale'):'Layout non disponibile','<div class="layout-panel">'+seatMarkup+'<div class="legend"><span><i style="background:#eff7f4"></i>Libero</span><span><i style="background:#e9f1ff"></i>Occupato</span></div></div>')+
 panel('Lista passeggeri',''+visible.length+' prenotazioni per i filtri selezionati',table(['Cliente','N.','Posti','Fermata','Stato'],roster))+'</div>';
}
function drawLayouts(){
 const lib=get('layoutLibrary'),official=get('tripLayouts'),fleet=get('fleet').filter(x=>num(x.posti)>30);
 const rows=lib.map(l=>[
  '<strong>'+esc(l.nome)+'</strong>',
  num(l.configurazione?.posti_totali||0),
  Array.isArray(l.configurazione?.rows)?l.configurazione.rows.length:'—',
  badge(l.attivo?'Attiva':'Bozza'),dateTimeIT(l.updated_at),
  safeLink('Esamina',l.id,'detail-layout')
 ]);
 const pub=official.map(l=>[esc(tripName(tripBy(l.viaggio_id))),num(l.configurazione?.posti_totali||0),num(l.versione),dateTimeIT(l.pubblicata_il)]);
 return intro('Piantine autobus','Schemi importati dal database aziendale: GT 53, GT 63 e configurazioni dedicate.','<button class="secondary" data-page="control">Apri Control Room</button>'+writeButton('+ Crea piantina','create-layout'))+
 '<div class="cards">'+card('Layout in libreria',String(lib.length),'Schemi salvati')+card('Applicati ai viaggi',String(official.length),'Configurazioni pubblicate')+card('Bus GT',String(fleet.length),'Senza van aziendale')+card('Disponibilità',WRITES_ENABLED?'Operativa':'Protetta','Pubblicazione bloccata in collaudo')+'</div>'+
 panel('Libreria piantine','Nessuna modifica alla geometria salvata',table(['Nome','Sedili','File','Stato','Aggiornata','Azioni'],rows))+
 panel('Piantine già applicate','Rilevate da dg28_trip_layouts',table(['Viaggio','Posti','Versione','Pubblicata'],pub))+
 '<div class="alert">L’editor grafico e la pubblicazione richiedono verifiche transazionali. Non eseguire modifiche ai layout dei viaggi fino al ripristino verificato del backup.</div>';
}
function drawCash(){
 const cash=get('cash'),ops=get('operators'),payments=get('payments'),trans=get('transfers');
 const cards='<div class="cards">'+card('Casse operatori',String(cash.length),'Valori calcolati dalla vista ufficiale')+
 card('Pagamenti viaggio',String(payments.length),'Movimenti originali')+
 card('Trasferimenti cassa',String(trans.length),'Movimenti contabilizzati')+
 card('Contabilità',WRITES_ENABLED?'Attiva':'Protetta','Solo lettura durante il collaudo')+'</div>';
 const cardOperators=cash.map(c=>'<div class="panel"><div class="panel-head"><div><h3>Contabilità '+esc(c.nome||c.username||'Operatore')+'</h3><p>Riconciliata con la vista Supabase</p></div>'+badge('Operatore')+'</div><div class="panel-body"><div class="cards" style="grid-template-columns:1fr 1fr">'+
  card('Cassa netta',money(c.cassa_netto),'')+card('Incassi viaggi',money(c.viaggi_incassati),'')+
  card('Incassi noleggi',money(c.noleggi_incassati),'')+card('Contanti netti',money(c.contanti_netto),'')+'</div></div></div>').join('');
 const rows=payments.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,80).map(p=>[
  dateIT(p.data_pagamento)||dateTimeIT(p.created_at),esc(p.cliente||'—'),
  esc(tripName(tripBy(p.viaggio_id))),badge(p.tipo),money(p.importo),
  esc(p.incassato_da||ops.find(x=>x.user_id===p.incassato_da_user_id)?.nome||'—'),
  esc(p.receipt_number||'—')
 ]);
 return intro('Contabilità e casse','Incassi, ripartizione Nicola / Raffaele, ricevute e movimenti.','<button class="secondary" data-action="export-payments">↓ CSV pagamenti</button>'+writeButton('+ Registra incasso','new-payment'))+
 cards+'<div class="section-grid">'+cardOperators+'</div>'+
 panel('Registro incassi e ricevute','Dati originali da pagamenti · ultime 80 righe',table(['Data','Cliente','Viaggio','Tipo','Importo','Incassato da','Ricevuta'],rows))+
 panel('Trasferimenti tra operatori','Lo spostamento quote utilizza una RPC transazionale',table(['Data','Da','A','Importo','Stato'],trans.map(t=>[dateIT(t.data_trasferimento),esc(ops.find(o=>o.user_id===t.da_operatore_user_id)?.nome||'—'),esc(ops.find(o=>o.user_id===t.a_operatore_user_id)?.nome||'—'),money(t.importo),badge(t.stato)])),writeButton('+ Trasferimento','new-transfer'));
}
function drawEconomy(){
 const movements=get('economy'),profit=get('profit').sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
 const income=movements.filter(m=>/entrata|incass/i.test(m.tipo||'')).reduce((a,m)=>a+num(m.importo),0);
 const out=movements.filter(m=>/uscita|costo|spesa/i.test(m.tipo||'')).reduce((a,m)=>a+num(m.importo),0);
 const rows=profit.map(t=>[esc(t.titolo||t.destinazione),dateIT(t.data_partenza),money(t.entrate),money(t.uscite),'<b>'+money(t.margine)+'</b>']);
 return intro('Economia e costi','Marginalità dei viaggi e registro dei movimenti contabili.')+
 '<div class="cards">'+card('Movimenti economici',String(movements.length),'Da economia_movimenti')+card('Entrate da movimenti',money(income),'Secondo campo tipo')+card('Uscite da movimenti',money(out),'Secondo campo tipo')+card('Bilancio movimenti',money(income-out),'Entrate meno uscite')+'</div>'+
 panel('Redditività per viaggio','Vista ufficiale dg_viaggi_redditivita',table(['Viaggio','Partenza','Entrate','Uscite','Margine'],rows))+
 panel('Registro movimenti','Registrazioni originali, senza alterare l’origine',table(['Data','Categoria','Descrizione','Tipo','Importo','Operatore'],movements.slice().sort((a,b)=>String(b.data_movimento).localeCompare(String(a.data_movimento))).slice(0,150).map(m=>[dateIT(m.data_movimento),esc(m.categoria),esc(m.descrizione),badge(m.tipo),money(m.importo),esc(m.operatore)])));
}
function drawCustomers(){
 const customers=get('customers').filter(c=>filterTerm(c.nome,c.cognome,c.telefono,c.email,c.codice_cliente));
 const books=get('bookings'),rows=customers.map(c=>[
  '<b>'+esc([c.nome,c.cognome].filter(Boolean).join(' '))+'</b>',
  esc(c.telefono||'—'),esc(c.email||'—'),esc(c.citta||'—'),badge(c.stato_cliente),esc(c.codice_cliente||short(c.id))
 ]);
 return intro('Anagrafica clienti','Storico aziendale originale e collegamento ai pagamenti.','<button class="secondary" data-action="export-customers">↓ CSV</button>'+writeButton('+ Nuovo cliente','create-customer'))+
 '<div class="filters">'+searchField('Cerca per nome, telefono, email o codice')+'</div>'+
 '<div class="cards">'+card('Clienti a sistema',String(get('customers').length),'Anagrafiche Supabase')+card('Clienti in vista',String(customers.length),'Dopo ricerca')+card('Prenotazioni',String(books.length),'Storico collegabile')+card('Fascicoli',WRITES_ENABLED?'Attivi':'Consultabili','Fase di collaudo')+'</div>'+
 panel('Elenco clienti','Informazioni riservate agli operatori autorizzati',table(['Nominativo','Telefono','Email','Città','Stato','Codice'],rows));
}
function drawRentals(){
 const data=get('rentals').filter(x=>filterTerm(x.referente,x.azienda,x.tratta_partenza,x.tratta_destinazione)).sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
 const rows=data.map(n=>[
  '<strong>'+esc(n.azienda||n.referente||'Noleggio')+'</strong><small class="row-sub">'+esc(n.telefono||'')+'</small>',
  dateIT(n.data_partenza)+' <span class="small muted">'+esc(String(n.ora_partenza||'').slice(0,5))+'</span>',
  esc(n.tratta_partenza)+' → '+esc(n.tratta_destinazione),
  num(n.passeggeri),money(n.prezzo_concordato),money(n.acconto),badge(n.stato_noleggio),badge(n.stato_pagamento)
 ]);
 return intro('Noleggi autobus','Gestione noleggi GT, servizi privati ed eventi.','<button class="secondary" data-action="refresh">↻ Aggiorna</button>'+writeButton('+ Noleggio','create-rental'))+
 '<div class="filters">'+searchField('Cerca azienda, referente o destinazione')+'</div>'+
 panel('Servizi e contratti','Dati da noleggi_bus',table(['Cliente','Partenza','Tratta','Pax','Prezzo','Acconto','Stato','Pagamento'],rows));
}
function drawAgenda(){
 const items=get('agenda').filter(a=>filterTerm(a.titolo,a.descrizione,a.tipo)).sort((a,b)=>String(a.data_scadenza).localeCompare(String(b.data_scadenza)));
 const rows=items.map(a=>[
  '<strong>'+esc(a.titolo)+'</strong><small class="row-sub">'+esc(a.descrizione||'')+'</small>',
  dateIT(a.data_scadenza),badge(a.priorita),badge(a.stato),esc(a.tipo),
  writeButton('✓ Completa','complete-agenda','data-id="'+esc(a.id)+'"')
 ]);
 return intro('Agenda e scadenze','Ripristino della vera agenda presente su Supabase.','<button class="secondary" data-action="export-agenda">↓ Esporta</button>'+writeButton('+ Nuovo impegno','create-agenda'))+
 '<div class="filters">'+searchField('Cerca un impegno')+'</div>'+
 '<div class="cards">'+card('Scadenze archiviate',String(get('agenda').length),'Impegni reali')+card('In vista',String(items.length),'Secondo ricerca')+card('In ritardo',String(items.filter(a=>a.data_scadenza<todayItaly()&&!/complet/i.test(a.stato)).length),'Richiedono verifica')+card('Priorità alta',String(items.filter(a=>/alta|urgente/i.test(a.priorita)).length),'Da seguire')+'</div>'+
 panel('Registro agenda','Scadenze ordinate dalla più vicina',table(['Attività','Scadenza','Priorità','Stato','Tipo','Azioni'],rows));
}
function drawFleet(){
 const fleet=get('fleet').filter(f=>num(f.posti)>7);
 const rows=fleet.map(f=>[
  '<strong>'+esc(f.titolo||f.modello)+'</strong><small class="row-sub">'+esc(f.marca||'')+' '+esc(f.modello)+'</small>',
  esc(f.targa||'—'),num(f.posti),badge(f.stato),badge(f.attivo?'Attivo':'Non attivo')
 ]);
 return intro('Flotta aziendale','Tre autobus Gran Turismo e il Limousine Bus; il van non è promosso nella V4.')+
 '<div class="cards">'+card('Autobus ed eventi',String(fleet.length),'Escluso il van')+card('GT 53 posti',String(fleet.filter(x=>num(x.posti)===53).length),'Irizar Scania Century')+card('GT 63 posti',String(fleet.filter(x=>num(x.posti)===63).length),'Irizar Scania PB')+card('Limousine Bus',String(fleet.filter(x=>/limousine/i.test(x.titolo||'')).length),'Servizi party ed eventi')+'</div>'+
 panel('Mezzi', 'Le schede corrispondono a quelle presenti nel database',table(['Autobus','Targa','Posti','Condizione','Attività'],rows));
}
function drawDocuments(){
 const docs=get('documents');
 const rows=docs.slice(0,220).map(d=>[
  badge(d.tipo_documento),esc(d.numero_documento||short(d.documento_id)),
  esc(d.cliente||'—'),esc(d.viaggio||tripName(tripBy(d.viaggio_id))),
  dateIT(d.data_documento),money(d.importo),
  '<span class="muted small">'+esc(d.storage_path?'Archiviato in Storage':'Nessun file')+'</span>'
 ]);
 return intro('Documenti e ricevute','Inventario PDF e conferme dei clienti; i file privati sono protetti da Supabase Storage.')+
 '<div class="cards">'+card('Voci documentali',String(docs.length),'Vista archivio_documenti')+card('Ricevute private','237','Inventario Storage precedente')+card('Locandine','56','Inventario Storage precedente')+card('Backup','Da verificare','Non sono copie certificate')+'</div>'+
 panel('Archivio documenti','Lettura dal database; i file privati non sono resi pubblici',table(['Tipo','Numero','Cliente','Viaggio','Data','Importo','Documento'],rows));
}
function drawNotifications(){
 const notes=get('notifications');
 return intro('Notifiche','Nuove prenotazioni, attività aziendali e messaggi operativi.','<button class="secondary" data-action="refresh">↻ Aggiorna</button>')+
 panel('Notifiche registrate','Consultazione manuale per ridurre il carico dell’API','<div class="panel-body">'+(notes.map(n=>'<div class="notice-card"><strong>'+esc(n.titolo)+'</strong><p>'+esc(n.messaggio)+'</p><span class="small muted">'+dateTimeIT(n.created_at)+' · '+esc(n.tipo||'Notifica')+'</span></div>').join('')||'<div class="empty">Nessuna notifica.</div>')+'</div>');
}
function drawDiagnostics(){
 const health=get('system')[0]||{};
 const t=get('trips'),b=get('bookings'),p=get('payments'),s=get('seats');
 const errs=get('alerts');
 return intro('Diagnostica e integrità','Controlli non distruttivi, stato dati e anomalie da riconciliare.','<button class="secondary" data-action="refresh">↻ Ripeti letture</button>')+
 '<div class="cards">'+card('Viaggi',String(t.length),'Vista dal database')+card('Prenotazioni',String(b.length),'Dati originali')+card('Pagamenti',String(p.length),'Registro importi')+card('Sedili assegnati',String(s.length),'Registro posti')+'</div>'+
 panel('Stato del sistema','Ultima verifica interna in Supabase','<div class="panel-body"><div class="detail-grid">'+
 '<div><small>Controllo database</small><strong>'+dateTimeIT(health.checked_at)+'</strong></div><div><small>Operatori autorizzati</small><strong>Accesso confermato con Supabase Auth</strong></div>'+
 '<div><small>Scritture gestionale V4</small><strong>'+esc(WRITES_ENABLED?'Abilitate':'Bloccate in attesa del backup')+'</strong></div>'+
 '<div><small>Endpoint progetto</small><strong>'+esc(API_URL)+'</strong></div></div><p class="help">L’assenza di un errore API in questo momento non certifica la continuità del servizio. Non riavviare PostgREST né apportare modifiche al database senza un ripristino verificato.</p></div>')+
 panel('Anomalie segnalate dal database','Vista dg_data_quality_issues',table(['Priorità','Categoria','Anomalia','Dettaglio'],errs.map(x=>[badge(x.priorita),esc(x.categoria),esc(x.titolo),esc(x.dettaglio)])))+
 '<div class="alert">⚠️ Il backup gestito Supabase, i 493 file Storage e il ripristino isolato non sono ancora certificati. Le operazioni che modificano dati rimangono bloccate.</div>';
}
function tripDetail(id){
 const t=tripBy(id);if(!t)return showMessage('Viaggio non trovato',true);
 const bookings=get('bookings').filter(b=>b.viaggio_id===id&&bookingActive(b));
 displayModal(tripName(t),
 '<div class="detail-grid">'+
 '<div><small>Partenza</small><strong>'+dateIT(t.data_partenza)+' · '+esc(String(t.ora_partenza||'').slice(0,5))+'</strong></div>'+
 '<div><small>Destinazione</small><strong>'+esc(t.destinazione||'—')+'</strong></div>'+
 '<div><small>Autobus</small><strong>'+esc(t.autobus||'Da assegnare')+'</strong></div>'+
 '<div><small>Capienza e prenotati</small><strong>'+num(t.posti_totali)+' / '+bookings.reduce((a,b)=>a+num(b.posti),0)+'</strong></div>'+
 '<div><small>Quota</small><strong>'+money(t.prezzo)+'</strong></div>'+
 '<div><small>Visibilità</small><strong>'+esc(t.pubblicato==='SI'?'Pubblicato sul sito':'Non pubblicato')+'</strong></div>'+
 '</div><p class="help">ID viaggio: '+esc(t.id)+' · Il BUS BIS mantiene il proprio ID, i propri posti e le prenotazioni separate.</p>'+
 '<div class="action-row"><button class="secondary" data-action="open-trip-control" data-id="'+esc(id)+'">Apri Control Room</button>'+writeButton('Modifica viaggio','edit-trip','data-id="'+esc(id)+'"')+'</div>');
}
function bookingDetail(id){
 const b=get('bookings').find(x=>x.id===id);if(!b)return showMessage('Prenotazione non trovata',true);
 const t=tripBy(b.viaggio_id);
 const pays=get('payments').filter(x=>x.prenotazione_id===b.id);
 displayModal('Prenotazione · '+bookingName(b),
 '<div class="detail-grid">'+[
  ['Viaggio',tripName(t)+' · '+dateIT(t?.data_partenza)],['Codice',b.codice||short(b.id)],
  ['Telefono',b.telefono],['Fermata',b.fermata_partenza],['Numero passeggeri',num(b.posti)],
  ['Posti',b.posti_selezionati||'Da riconciliare'],['Importo',money(b.totale)],
  ['Pagato dichiarato',money(b.pagato)],['Stato',b.stato],['Check-in',b.checkin_effettuato?'Presente':'Da effettuare']
 ].map(([k,v])=>'<div><small>'+esc(k)+'</small><strong>'+esc(v||'—')+'</strong></div>').join('')+
 '</div><h3 class="section-title">Pagamenti collegati</h3>'+
 table(['Data','Tipo','Importo','N. ricevuta'],pays.map(p=>[dateIT(p.data_pagamento),badge(p.tipo),money(p.importo),esc(p.receipt_number||'—')]))+
 '<div class="action-row">'+writeButton('Registra pagamento','new-payment','data-id="'+esc(b.id)+'"')+
 writeButton('Sposta su altro viaggio','move-booking','data-id="'+esc(b.id)+'"')+
 writeButton('Aggiorna check-in','checkin-booking','data-id="'+esc(b.id)+'"')+'</div>'+
 '<p class="help">Le quote pagate non devono essere cancellate senza procedura di rimborso. Le prenotazioni esistenti non vengono modificate in questa fase.</p>');
}
function layoutDetail(id){
 const l=get('layoutLibrary').find(x=>x.id===id);
 if(!l)return;
 displayModal('Piantina · '+l.nome,
 '<div class="detail-grid"><div><small>Nome</small><strong>'+esc(l.nome)+'</strong></div>'+
 '<div><small>Posti dichiarati</small><strong>'+num(l.configurazione?.posti_totali)+'</strong></div>'+
 '<div><small>File</small><strong>'+num(l.configurazione?.rows?.length)+'</strong></div>'+
 '<div><small>Modifica</small><strong>Protetta fino al backup</strong></div></div>'+
 '<div class="layout-panel">'+(Array.isArray(l.configurazione?.rows)?rowForSeats(l.configurazione.rows,{map:new Map()}):'<div class="alert">Layout senza matrice valida.</div>')+'</div>');
}
function csvExport(headers,rows,file){
 const quote=x=>'"'+String(x??'').replaceAll('"','""').replace(/^[=+\-@]/,'\u0027$&')+'"';
 const body='\uFEFF'+[headers,...rows].map(row=>row.map(quote).join(';')).join('\r\n');
 const blob=new Blob([body],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printRoster(){
 const t=tripBy(state.trip);
 if(!t)return showMessage('Seleziona un viaggio.',true);
 const bookings=get('bookings').filter(b=>b.viaggio_id===t.id && bookingActive(b)).sort((a,b)=>num(seatsOf(a)[0])-num(seatsOf(b)[0]));
 const printRows=bookings.map(b=>'<tr><td>'+esc(bookingName(b))+'</td><td>'+num(b.posti)+'</td><td>'+esc(seatsOf(b).join(', '))+'</td><td>'+esc(b.fermata_partenza||'')+'</td><td>'+esc(b.checkin_effettuato?'✓':'')+'</td></tr>').join('');
 const win=window.open('','_blank');
 if(!win){showMessage('Il browser ha bloccato la finestra PDF. Consenti i popup per il gestionale.',true);return;}
 const css='body{font:12px Arial;margin:25px;color:#1a293d}h1{font-size:24px}h2{font-size:16px}table{border-collapse:collapse;width:100%}td,th{padding:7px;border:1px solid #bbb;text-align:left}header{border-bottom:3px solid #264b79;margin-bottom:20px}small{color:#666}@media print{@page{size:A4 portrait;margin:15mm}}';
 win.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>DELGROSSO · Lista passeggeri</title><style>'+css+'</style></head><body><header><h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>LISTA PASSEGGERI · '+esc(tripName(t))+'</h2><p>Data '+dateIT(t.data_partenza)+' · Mezzo '+esc(t.autobus||'Da assegnare')+' · Capienza '+num(t.posti_totali)+'</p></header><table><thead><tr><th>Passeggero / prenotante</th><th>Pax</th><th>Posti</th><th>Fermata</th><th>Pres.</th></tr></thead><tbody>'+printRows+'</tbody></table><p>Totale persone: '+bookings.reduce((a,b)=>a+num(b.posti),0)+' · Generato da DELGROSSO 4.0 in consultazione.</p><small>Elenco riservato all’azienda. Verificare eventuali prenotazioni non riconciliate prima della partenza.</small></body></html>');
 win.document.close();win.focus();setTimeout(()=>win.print(),350);
}
async function handleAction(action,id,button){
 if(action==='refresh'){clearCache();showMessage('Aggiornamento in corso.');await navigate(page,true);return;}
 if(action==='detail-trip'){tripDetail(id);return;}
 if(action==='detail-booking'){bookingDetail(id);return;}
 if(action==='detail-layout'){layoutDetail(id);return;}
 if(action==='seat-empty'){showMessage('Posto libero nel registro alla data dell’ultima lettura. Nessuna prenotazione creata.');return;}
 if(action==='open-trip-control'){closeModal();state.trip=id;state.stop='';state.search='';return navigate('control');}
 if(action==='print-roster'){printRoster();return;}
 if(action==='copy-phones'){
  const phones=uniquePhones(get('bookings').filter(b=>b.viaggio_id===state.trip&&bookingActive(b)&&!b.riserva_aziendale));
  if(!phones.length)return showMessage('Nessun numero da copiare.',true);
  try{await navigator.clipboard.writeText(phones.join('\n'));showMessage(phones.length+' numeri copiati, uso interno nel rispetto dei consensi WhatsApp.');}
  catch{displayModal('Numeri da copiare','<textarea readonly>'+esc(phones.join('\n'))+'</textarea>');}return;
 }
 if(action==='export-bookings'){csvExport(['Cliente','Telefono','Viaggio','Pax','Posti','Fermata','Totale','Pagato','Stato','Check-in'],get('bookings').filter(b=>(!state.trip||b.viaggio_id===state.trip) && bookingActive(b)).map(b=>[bookingName(b),b.telefono,tripName(tripBy(b.viaggio_id)),b.posti,b.posti_selezionati,b.fermata_partenza,b.totale,b.pagato,b.stato,b.checkin_effettuato?'Sì':'No']),'delgrosso-prenotazioni.csv');return;}
 if(action==='export-payments'){csvExport(['Data','Cliente','Viaggio','Tipo','Importo','Operatore','Ricevuta'],get('payments').map(p=>[p.data_pagamento,p.cliente,tripName(tripBy(p.viaggio_id)),p.tipo,p.importo,p.incassato_da,p.receipt_number]),'delgrosso-pagamenti.csv');return;}
 if(action==='export-customers'){csvExport(['Nome','Cognome','Telefono','Email','Città'],get('customers').map(c=>[c.nome,c.cognome,c.telefono,c.email,c.citta]),'delgrosso-clienti.csv');return;}
 if(action==='export-agenda'){csvExport(['Titolo','Scadenza','Priorità','Stato','Descrizione'],get('agenda').map(a=>[a.titolo,a.data_scadenza,a.priorita,a.stato,a.descrizione]),'delgrosso-agenda.csv');return;}
 if(!WRITES_ENABLED){
  return showMessage('Operazione bloccata: prima occorrono backup completo e restore di prova. Nessun dato è stato modificato.',true);
 }
 if(action==='new-payment'){
  const opts=get('bookings').filter(bookingActive).map(b=>'<option value="'+esc(b.id)+'" '+(id===b.id?'selected':'')+'>'+esc(bookingName(b)+' · '+tripName(tripBy(b.viaggio_id)))+'</option>').join('');
  return displayModal('Registra pagamento','<form data-save="payment" class="form-grid"><label class="span-2">Prenotazione<select name="booking" required>'+opts+'</select></label><label>Tipo<select name="tipo"><option>Acconto</option><option>Saldo</option></select></label><label>Importo €<input name="importo" type="number" min=".01" step=".01" required /></label><label>Metodo<select name="metodo"><option>Contanti</option><option>Bonifico</option><option>POS</option></select></label><label>Data<input name="data" type="date" value="'+todayItaly()+'" required /></label><label class="span-2">Note<textarea name="note"></textarea></label><button class="primary span-2" type="submit">Registra in Supabase</button></form>');
 }
 if(action==='create-agenda'){
  return displayModal('Nuova scadenza','<form class="form-grid" data-save="agenda"><label class="span-2">Titolo<input name="titolo" required maxlength="180"></label><label>Data<input name="data_scadenza" type="date" required></label><label>Priorità<select name="priorita"><option>normale</option><option>alta</option><option>bassa</option></select></label><label class="span-2">Descrizione<textarea name="descrizione"></textarea></label><button class="primary span-2" type="submit">Salva in agenda</button></form>');
 }
 if(action==='complete-agenda'){
  if(!confirm('Segnare questa scadenza come completata?'))return;
  await mutate('agenda','PATCH',{stato:'completata'},id);
  closeModal();return navigate('agenda',true);
 }
 if(action==='create-trip'){
  return displayModal('Nuovo viaggio','<form class="form-grid" data-save="trip"><label>Nome viaggio<input name="titolo" required></label><label>Destinazione<input name="destinazione" required></label><label>Data partenza<input name="data_partenza" type="date" required></label><label>Quota €<input name="prezzo" type="number" min="0" step=".01" required></label><label>Capienza posti<input name="posti_totali" type="number" min="1" max="100" required></label><label>Minimo partecipanti<input name="minimo_partecipanti" type="number" min="1" value="40" required></label><button class="primary span-2" type="submit">Crea viaggio NON pubblicato</button></form>');
 }
 if(action==='new-transfer'){
  const opts=get('operators').filter(o=>o.user_id!==currentUser()&&o.attivo).map(o=>'<option value="'+esc(o.user_id)+'">'+esc(o.nome||o.username)+'</option>').join('');
  return displayModal('Trasferimento casse','<form class="form-grid" data-save="transfer"><label class="span-2">Destinatario<select name="recipient" required>'+opts+'</select></label><label>Importo €<input name="importo" required type="number" min=".01" step=".01"></label><label>Note<input name="note"></label><button class="primary span-2" type="submit">Conferma trasferimento</button></form>');
 }
 if(action==='checkin-booking'){
  if(!confirm('Registrare il check-in per questa prenotazione?'))return;
  await mutate('bookings','PATCH',{checkin_effettuato:true},id);
  closeModal();return navigate('bookings',true);
 }
 if(action==='move-booking'){
  const opts=get('trips').filter(t=>t.id!==get('bookings').find(b=>b.id===id)?.viaggio_id && !t.archiviato_at).map(t=>'<option value="'+esc(t.id)+'">'+esc(tripName(t)+' · '+dateIT(t.data_partenza))+'</option>').join('');
  return displayModal('Sposta prenotazione','<form class="form-grid" data-save="move"><input type="hidden" name="bookingId" value="'+esc(id)+'"><label class="span-2">Destinazione<select name="targetTrip" required>'+opts+'</select></label><label class="span-2">Fermata di partenza (se diversa)<input name="stop"></label><button type="submit" class="primary span-2">Verifica posti e sposta</button></form>');
 }
 showMessage('Funzione in preparazione: nessun dato è stato modificato.',true);
}
async function handleSubmit(form){
 if(!WRITES_ENABLED)throw new Error('Scritture sospese fino a backup completo verificato.');
 const f=new FormData(form);const type=form.dataset.save;
 const s=n=>String(f.get(n)||'').trim();
 if(type==='payment'){
  const amount=Number(s('importo'));if(!(amount>0))throw new Error('Importo non valido.');
  if(!confirm('Confermare la registrazione di '+money(amount)+'? Non ripetere l’invio se la risposta non arriva.'))return;
  await writeRpc('dg_register_payment',{p_booking_id:s('booking'),p_tipo:s('tipo'),p_importo:amount,p_metodo:s('metodo'),p_data:s('data'),p_note:s('note')});
 } else if(type==='agenda'){
  await mutate('agenda','POST',{titolo:s('titolo'),data_scadenza:s('data_scadenza'),priorita:s('priorita'),descrizione:s('descrizione'),tipo:'attivita',stato:'aperta'});
 } else if(type==='trip'){
  await mutate('trips','POST',{titolo:s('titolo'),destinazione:s('destinazione'),data_partenza:s('data_partenza'),prezzo:Number(s('prezzo')),posti_totali:Number(s('posti_totali')),minimo_partecipanti:Number(s('minimo_partecipanti')),pubblicato:'NO',stato:'PROGRAMMATO'});
 } else if(type==='transfer'){
  if(!confirm('Trasferire '+money(Number(s('importo')))+' al destinatario selezionato?'))return;
  await writeRpc('dg_transfer_cash',{p_to_user_id:s('recipient'),p_amount:Number(s('importo')),p_note:s('note')});
 } else if(type==='move'){
  const args={p_booking_ids:[s('bookingId')],p_target_trip_id:s('targetTrip'),p_target_stop:s('stop')||null,p_preview:true};
  const preview=await writeRpc('dg_move_bookings_auto_seats_v1',args);
  if(!confirm('Anteprima spostamento:\n'+JSON.stringify(preview).slice(0,1000)+'\nConfermi lo spostamento?'))return;
  await writeRpc('dg_move_bookings_auto_seats_v1',{...args,p_preview:false});
 } else throw new Error('Modulo non ancora disponibile.');
 closeModal();showMessage('Operazione registrata e lettura aggiornata.');await navigate(page,true);
}
function startListeners(){
 $('login-form').addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=$('login-submit');btn.disabled=true;$('login-error').hidden=true;
  try{
   operator=await login($('login-user').value,$('login-password').value);
   $('login-password').value='';
   $('operator-name').textContent=operator.nome||operator.username;
   $('login').hidden=true;$('app').hidden=false;$('sidebar-state').textContent='Sessione verificata';
   await navigate('dashboard');
  }catch(err){$('login-error').textContent=String(err.message||err);$('login-error').hidden=false;}
  finally{btn.disabled=false;}
 });
 $('logout').addEventListener('click',async()=>{
  await logout();operator=null;state.all={};ticket++;$('app').hidden=true;$('login').hidden=false;
  showMessage('Sessione terminata.');history.replaceState(null,'',location.pathname);
 });
 $('refresh').addEventListener('click',()=>navigate(page,true));
 $('menu-toggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 $('modal-close').addEventListener('click',closeModal);
 $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
 document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-page]');if(nav){e.preventDefault();state.search='';state.stop='';state.trip='';navigate(nav.dataset.page);return;}
  const action=e.target.closest('[data-action]');if(!action)return;
  e.preventDefault();handleAction(action.dataset.action,action.dataset.id,action).catch(err=>showMessage(String(err.message||err),true));
 });
 $('main').addEventListener('input',e=>{
  if(e.target.id==='filter-search'){state.search=e.target.value;const focus=e.target;const start=focus.selectionStart;const end=focus.selectionEnd; // no network request for local filtering
   const renderers={trips:drawTrips,bookings:drawBookings,control:drawControl,customers:drawCustomers,rentals:drawRentals,agenda:drawAgenda};
   if(renderers[page]){$('main').innerHTML=renderers[page]();const replacement=$('filter-search');replacement?.focus();replacement?.setSelectionRange(start,end);}
  }
 });
 $('main').addEventListener('change',e=>{
  if(e.target.id==='filter-trip'){state.trip=e.target.value;state.stop='';const renderers={bookings:drawBookings,control:drawControl};if(renderers[page])$('main').innerHTML=renderers[page]();}
  if(e.target.id==='filter-stop'){state.stop=e.target.value;$('main').innerHTML=drawControl();}
  if(e.target.id==='filter-bookings-state'){state.bookingsState=e.target.value;$('main').innerHTML=drawBookings();}
 });
 $('modal-content').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target;if(!form.dataset.save)return;
  const btn=form.querySelector('button[type=submit]');if(btn)btn.disabled=true;
  try{await handleSubmit(form);}catch(err){showMessage(String(err.message||err),true);}
  finally{if(btn)btn.disabled=false;}
 });
}
async function bootstrap(){
 startListeners();
 if(!WRITES_ENABLED)$('mode-pill').textContent='SOLO LETTURA';
 const existing=await resume();
 if(existing){
  operator=existing;$('operator-name').textContent=operator.nome||operator.username;
  $('login').hidden=true;$('app').hidden=false;$('sidebar-state').textContent='Sessione verificata';
  await navigate(decodeURIComponent(location.hash.slice(1))||'dashboard');
 }
}
bootstrap().catch(err=>{const node=$('login-error');node.hidden=false;node.textContent='Inizializzazione non riuscita: '+String(err.message||err);});
