import {
 API_URL,WRITES_ENABLED,esc,eur,num,dateIT,dateTimeIT,todayItaly,bookingActive,bookingName,tripName,
 seatsOf,uniquePhones,occupancy,breakdown,login,resume,logout,records,rpcRead,writeRpc,mutate,
 currentUser,clearCache,signedReceiptPath,edgeAction,normalizeSignedStorageUrl,liveAccessToken
} from './core.js';
import * as Pdf from './pdf-reports.js';
import {createLiveSync} from './live-sync.js';
import {eligibleBusTargets,eligibleDateTargets,seatNumbers,seatInventory,reviewBusTransfer} from './booking-operations.js';
import {usableTemplates,inspectLayout,normalizeManualSeats,prepareBisSeatOpening,previewManualLayout} from './bis-manual.js';
import {bookingCreditBalance,destinationsForCredit,reviewCreditTransfer,centesimi} from './credit-transfers.js';

const $=id=>document.getElementById(id);
const NAV={
 dashboard:'Dashboard',trips:'Viaggi e partenze',bookings:'Prenotazioni',movements:'Spostamenti posti / BUS BIS / date',credits:'Giroconto quote fra viaggi',
 control:'Control Room',layouts:'Piantine autobus',cash:'Contabilità e casse',
 economy:'Economia e costi',customers:'Clienti',rentals:'Noleggi bus',quotes:'Preventivi',invoices:'Fatturazione / bozze',waitlist:'Lista d’attesa',whatsapp:'WhatsApp Business',reports:'Centro PDF e report',
 agenda:'Agenda e scadenze',fleet:'Flotta GT',documents:'Documenti',
 notifications:'Notifiche',diagnostics:'Diagnostica'
};
let operator=null, page='dashboard', ticket=0, localEditor=null, transferWizard=null, pendingTransfer=null, transferBusy=false, bisWizard=null, pendingBis=null, bisBusy=false, creditWizard=null, pendingCredit=null, creditBusy=false, creditLedgerState='not-checked';
const state={trip:'',stop:'',search:'',bookingsState:'active',pendingAction:'',all:{},lastSyncAt:0,lastSyncError:null};
let liveSync=null,backgroundInterval=null,backgroundDebounce=null,backgroundBusy=false,backgroundPending=false,syncMode='offline';
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

/** The new giroconto ledger is an optional STAGING schema until backup/restore.
 * Never represent a failed/unavailable ledger as zero transfers. */
async function refreshCreditState(){
 try{
  const [transfers,balances]=await Promise.all([
   records('creditTransfers',{force:true,limit:10000}),
   records('creditBalances',{force:true,limit:10000})
  ]);
  state.all.creditTransfers=transfers;state.all.creditBalances=balances;
  creditLedgerState='ready';
 }catch(error){
  state.all.creditTransfers=null;state.all.creditBalances=null;
  creditLedgerState='schema-unavailable';
 }
}
const creditAvailable=()=>creditLedgerState==='ready';
function creditBalance(b){
 if(!b)return null;
 if(creditAvailable()){
  const row=get('creditBalances').find(x=>x.prenotazione_id===b.id);
  if(!row)throw new Error('Prenotazione assente dal registro crediti Supabase.');
  return {
   effective:centesimi(row.pagato_effettivo||0),
   incoming:centesimi(row.quote_ricevute||0),
   outgoing:centesimi(row.quote_trasferite||0),
   remaining:centesimi(row.saldo_effettivo||0),
   mismatch:row.incassi_da_riconciliare===true,
   availableCredit:Math.max(0,centesimi(row.pagato_effettivo||0))
  };
 }
 return bookingCreditBalance(b,get('payments'),[]);
}

const filterTerm = (...values) => !state.search || values.some(v=>String(v||'').toLocaleLowerCase('it').includes(state.search.toLocaleLowerCase('it')));
const activeTrip=t=>!t.archiviato_at;
const sortTrip=(a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))||String(a.ora_partenza).localeCompare(String(b.ora_partenza))||num(a.bis_numero)-num(b.bis_numero);
const tripBy=id=>get('trips').find(x=>x.id===id);
function showMessage(msg,error=false) {
 const f=$('feedback');f.hidden=false;f.className='feedback'+(error?' error':'');f.textContent=msg;
}
function errorPanel(resource,e){return '<div class="error-panel"><strong>Connessione non verificata: '+esc(resource)+'</strong><p>'+esc(e.message||e)+'</p><p>Non effettuare operazioni ripetute se il database segnala errori.</p></div>';}
function displayModal(title,body){$('modal-heading').textContent=title;$('modal-content').innerHTML=body;$('modal').hidden=false;$('modal-close').focus();}
function closeModal(){$('modal').hidden=true;$('modal-content').innerHTML='';if(backgroundPending)queueRefresh(200);}
/** Fail closed: an unreachable Supabase endpoint must NEVER appear as an empty cash/booking ledger. */
async function fetchResources(names,force=false){
 const uniq=[...new Set(names)];
 const results=await Promise.allSettled(uniq.map(n=>records(n,{
  force,limit:n==='notifications'?3000:12000,
  order:n==='trips'?'data_partenza.asc':n==='notifications'?'created_at.desc':n==='agenda'?'data_scadenza.asc':undefined
 })));
 const errors=[];
 results.forEach((r,i)=>{if(r.status!=='fulfilled')errors.push({name:uniq[i],error:r.reason})});
 if(errors.length){
  const message=errors.map(x=>x.name+': '+String(x.error?.message||x.error)).join(' · ').slice(0,700);
  state.lastSyncError=message;
  showMessage('Lettura Supabase non completata — '+message,true);
  throw new Error('Dati non aggiornati. '+message);
 }
 // Commit all successful responses atomically, not one at a time.
 results.forEach((r,i)=>{state.all[uniq[i]]=r.value});
 state.lastSyncAt=Date.now();state.lastSyncError=null;
 if(operator)$('sidebar-state').textContent=(syncMode==='realtime'?'Realtime · ':'Sincronizzato · ')+
   new Date(state.lastSyncAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
 return [];
}
function stopBackgroundSync(){
 liveSync?.stop();liveSync=null;
 if(backgroundInterval!==null){clearInterval(backgroundInterval);backgroundInterval=null}
 if(backgroundDebounce!==null){clearTimeout(backgroundDebounce);backgroundDebounce=null}
 backgroundBusy=false;backgroundPending=false;syncMode='offline';
}
function queueRefresh(delay=400){
 if(!operator)return;
 backgroundPending=true;
 if(backgroundDebounce!==null)return;
 backgroundDebounce=setTimeout(()=>{
  backgroundDebounce=null;
  void refreshBackground();
 },delay);
}
async function refreshBackground(){
 if(!operator||backgroundBusy||!backgroundPending)return;
 // Do not overwrite forms/seat choices while an operator is editing.
 if(document.visibilityState==='hidden'||navigator.onLine===false||
    !$('modal').hidden||document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
 backgroundPending=false;backgroundBusy=true;
 try{
  clearCache();
  await navigate(page,true,{silent:true});
 }finally{
  backgroundBusy=false;
  if(backgroundPending)queueRefresh(1250);
 }
}
function startBackgroundSync(){
 stopBackgroundSync();
 if(!operator)return;
 liveSync=createLiveSync({
  apiUrl:API_URL,key:'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je',
  getToken:liveAccessToken,
  onChange:()=>{clearCache();queueRefresh(400)},
  onStatus:value=>{
   syncMode=value;
   if(!operator)return;
   const phrase=value==='realtime'?'Supabase Realtime collegato':
    value==='connecting'?'Collegamento Realtime in corso':
    value==='polling'?'Sincronizzazione periodica attiva':'Supabase non collegato';
   $('sidebar-state').textContent=phrase;
  }
 });
 liveSync.start();
 backgroundInterval=setInterval(()=>{if(operator){queueRefresh(0)}},60000);
}
async function navigate(next,force=false,{silent=false}={}){
 if(!NAV[next])next='dashboard';
 page=next;const mine=++ticket;
 $('page-title').textContent=NAV[next];$('breadcrumb').textContent=NAV[next].toUpperCase();
 document.querySelectorAll('#nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===next));
 $('sidebar').classList.remove('open');if(!silent)$('main').innerHTML='<div class="loading-state"><span class="spinner"></span>Consultazione dati Supabase…</div>';
 const needs={
 dashboard:['trips','bookings','payments','agenda','notifications'],
 trips:['trips','bookings','seats','tripLayouts','fleet','layoutLibrary'],
 bookings:['trips','bookings','payments','seats','tripLayouts'],
  movements:['trips','bookings','payments','seats','tripLayouts'],
  credits:['trips','bookings','payments','operators'],
 control:['trips','bookings','seats','tripLayouts','stops'],
 layouts:['trips','fleet','layoutLibrary','tripLayouts','busLayouts'],
 cash:['cash','operators','payments','rentalPayments','rentals','transfers','trips','bookings'],
 economy:['economy','profit','trips'],
 customers:['customers','bookings','payments','trips'],
 rentals:['rentals','rentalPayments'],
 quotes:['quotes'],invoices:['invoices'],waitlist:['waitlist','trips'],
 whatsapp:['whatsAppInbox','whatsAppOutbound','whatsAppOptins'],
 reports:['trips','bookings','seats','tripLayouts','payments','cash','agenda','economy','profit','fleet','rentals','customers','documents','quotes','invoices'],
 agenda:['agenda','trips'],
 fleet:['fleet'],
 documents:['documents','trips','receipts','docsMetadata'],
 notifications:['notifications'],
 diagnostics:['system','alerts','trips','bookings','payments','seats']
 };
 try {
  await fetchResources(needs[next],force);
  if(['credits','cash','bookings'].includes(next))await refreshCreditState();
  if(mine!==ticket)return;
  const views={dashboard:drawDashboard,trips:drawTrips,bookings:drawBookings,movements:drawMovements,
   control:drawControl,layouts:drawLayouts,cash:drawCash,credits:drawCredits,economy:drawEconomy,
   customers:drawCustomers,rentals:drawRentals,quotes:drawQuotes,invoices:drawInvoices,waitlist:drawWaitlist,whatsapp:drawWhatsApp,reports:drawReports,agenda:drawAgenda,
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

/* BUS BIS manual seat wizard: requires a real, already saved full bus layout. */
function openBisWizard(id){
 const source=tripBy(id);
 if(!source||source.bis_parent_id)throw new Error('Seleziona il viaggio principale per aprire un BUS BIS.');
 if(source.archiviato_at||source.data_partenza<todayItaly())throw new Error('Un viaggio concluso non può aprire BUS BIS.');
 bisWizard={sourceId:id,busId:'',layoutId:'',selected:[],publish:false};
 pendingBis=null;renderBisWizard();
}
function bisChoices(){
 const source=tripBy(bisWizard?.sourceId);
 return get('fleet').filter(b=>b.attivo!==false&&/GT/i.test(String(b.categoria||''))&&Number(b.posti)>0).map(bus=>({
  bus,templates:usableTemplates(get('layoutLibrary'),bus),
  busy:get('trips').some(t=>t.id!==source?.id&&t.autobus_id===bus.id&&
   t.data_partenza===source?.data_partenza&&!t.archiviato_at&&!/annull|cancel/i.test(String(t.stato||'')))
 }));
}
function renderBisWizard(){
 if(!bisWizard)return;
 const source=tripBy(bisWizard.sourceId),choices=bisChoices();
 if(!source)return;
 const entry=choices.find(x=>x.bus.id===bisWizard.busId);
 const layout=entry?.templates.find(l=>l.id===bisWizard.layoutId);
 const report=layout?inspectLayout(layout.configurazione,Number(entry.bus.posti)):null;
 const allowed=report?.valid?report.seats.filter(x=>!report.unusable.has(x)):[];
 bisWizard.selected=(bisWizard.selected||[]).filter(x=>allowed.includes(x));
 const selected=bisWizard.selected,capacity=Number(entry?.bus.posti||0);
 const buses='<option value="">Seleziona autobus GT…</option>'+choices.map(x=>
  '<option value="'+esc(x.bus.id)+'" '+(x.bus.id===bisWizard.busId?'selected':'')+
  (x.busy||!x.templates.length?' disabled':'')+'>'+
  esc((x.bus.titolo||x.bus.modello||'GT')+' · '+x.bus.posti+' posti')+
  (x.busy?' · IMPEGNATO':'')+(!x.templates.length?' · manca piantina':'')+'</option>').join('');
 const templates='<option value="">Seleziona piantina ufficiale…</option>'+(entry?.templates||[]).map(t=>
  '<option value="'+esc(t.id)+'" '+(t.id===bisWizard.layoutId?'selected':'')+'>'+esc(t.nome||t.configurazione?.name)+'</option>').join('');
 const map=report?.valid?report.seats.map(n=>{
  const disabled=report.unusable.has(n),active=selected.includes(n);
  return '<button type="button" data-bis-seat="'+esc(n)+'" class="seat '+(disabled?'booked':active?'selected':'')+
   '" aria-pressed="'+active+'" '+(disabled?'disabled':'')+' title="'+esc(disabled?'Posto non disponibile':'Posto '+n)+'">'+esc(n)+'</button>';
 }).join(''):'';
 const summary=layout?'<div class="cards">'+card('Posti fisici',String(capacity),'Capienza reale bus')+
  card('Da aprire',String(selected.length),'Scelti manualmente')+
  card('Chiusi',String(capacity-selected.length),'Non prenotabili')+'</div>':'';
 const picker=layout?summary+
  '<div class="action-row"><button type="button" class="secondary" data-action="bis-select-all">Seleziona tutti</button>'+
  '<button type="button" class="secondary" data-action="bis-select-none">Azzera</button></div>'+
  '<div class="seat-pick-grid" aria-label="Posti selezionabili BUS BIS">'+map+'</div>'+
  '<label>Apri i primi N posti disponibili<input type="number" id="bis-first-count" min="1" max="'+allowed.length+
  '" value="'+(selected.length||Math.min(20,allowed.length))+'"></label>'+
  '<button type="button" class="secondary" data-action="bis-select-first">Seleziona N</button>'+
  '<label class="span-2">Oppure digita i numeri separati da virgola<input id="bis-seat-input" value="'+esc(selected.join(', '))+'" placeholder="1, 2, 7, 8"></label>'+
  '<p class="help span-2">I sedili non scelti saranno bloccati. Nessun posto fuori servizio può essere aperto.</p>':
  '<div class="alert span-2">Seleziona un autobus con piantina ufficiale di '+(capacity||'53 / 63')+' posti. Prima di creare un BIS serve una piantina reale nella libreria.</div>';
 displayModal('Apri BUS BIS · scegli manualmente i posti',
  '<p class="help"><strong>'+esc(tripName(source))+'</strong> · '+dateIT(source.data_partenza)+
  '. Il BIS conserva la capienza fisica del mezzo; scegli quali sedili vendere.</p>'+
  '<form data-save="bis-preview" class="form-grid"><input name="sourceTripId" type="hidden" value="'+esc(source.id)+'">'+
  '<label class="span-2">Autobus<select id="bis-bus" required>'+buses+'</select></label>'+
  '<label class="span-2">Piantina ufficiale<select id="bis-layout" '+(!entry?'disabled':'')+' required>'+templates+'</select></label>'+
  picker+
  '<label class="span-2"><input id="bis-publish" type="checkbox" '+(bisWizard.publish?'checked':'')+
  '> Pubblica sul sito dopo l’apertura definitiva</label>'+
  '<button class="primary span-2" type="submit" '+(!layout||!selected.length?'disabled':'')+'>Anteprima BUS BIS e posti selezionati</button></form>');
}
function reviewBisWizard(){
 if(!bisWizard)throw new Error('Selezione BUS BIS non disponibile.');
 const source=tripBy(bisWizard.sourceId);
 const bus=get('fleet').find(x=>x.id===bisWizard.busId);
 const template=get('layoutLibrary').find(x=>x.id===bisWizard.layoutId);
 const p=prepareBisSeatOpening({source,bus,template,selected:bisWizard.selected,
  alreadyBooked:[],today:todayItaly(),allTrips:get('trips')});
 previewManualLayout(template.configurazione,p.physicalSeats,p.bookableSeats);
 p.publish=!!bisWizard.publish;pendingBis=p;
 const html='<div class="cards">'+card('Capienza GT',String(p.physicalSeats),'Posti fisici')+
  card('Posti aperti',String(p.bookableCount),'Scelti da te')+
  card('Posti chiusi',String(p.closedSeats.length),'Bloccati alla vendita')+'</div>'+
  '<p><strong>Partenza:</strong> '+esc(tripName(source))+' · '+dateIT(source.data_partenza)+'</p>'+
  '<p><strong>Bus:</strong> '+esc(bus.titolo||bus.modello||'GT')+'</p>'+
  '<p><strong>Posti prenotabili:</strong> '+esc(p.bookableSeats.join(', '))+'</p>'+
  '<p><strong>Visibilità:</strong> '+(p.publish?'Da pubblicare sul sito':'Solo gestionale')+'</p>'+
  '<div class="alert">La selezione sarà salvata con i posti non scelti bloccati. Una verifica sul server impedirà prenotazioni dirette di sedili chiusi.</div>'+
  '<div class="action-row"><button class="secondary" data-action="back-bis">← Modifica selezione</button>'+
  writeButton('Conferma apertura BUS BIS','commit-bis-manual')+'</div>'+
  (!WRITES_ENABLED?'<p class="help">Conferma disattivata fino a backup/restore e collaudo dell’RPC protetta.</p>':'');
 displayModal('Anteprima BUS BIS · '+p.bookableCount+' sedili aperti',html);
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
   badge(t.archiviato_at?'Archiviato':t.data_partenza<todayItaly()?'Viaggio concluso':t.stato)+' '+badge(t.data_partenza<todayItaly()?'Storico — non sul sito':(t.pubblicato==='SI'&&!t.archiviato_at)?'Online':'Non pubblicato'),
   '<div class="row-actions">'+safeLink('Dettagli',t.id,'detail-trip')+(t.data_partenza>=todayItaly()&&!t.archiviato_at&&!t.bis_parent_id?'<button class="secondary" data-action="open-bis" data-id="'+esc(t.id)+'">+ Apri BUS BIS</button>':'')+'</div>'
  ];
 });
 return intro('Viaggi e partenze','Archivio originale e programmazione della flotta.','<button class="secondary" data-action="pdf-all-roster">↓ PDF prenotati</button><button class="secondary" data-action="refresh">↻ Aggiorna</button>'+writeButton('+ Nuovo viaggio','create-trip'))+
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
   safeLink('Apri',b.id)+' '+writeButton('Modifica dati','edit-booking-info','data-id="'+esc(b.id)+'"')+' <button class="inline-link" data-action="transfer-booking" data-id="'+esc(b.id)+'">⇄ Posti / BUS / data</button>'
  ];
 });
 const sum=data.filter(bookingActive).reduce((n,b)=>n+num(b.posti),0);
 return intro('Prenotazioni','Anagrafica, posti, fermate, pagamenti e check-in.','<button class="secondary" data-action="pdf-all-roster">↓ PDF tutti i viaggi</button><button class="secondary" data-action="export-bookings">↓ CSV</button><button class="secondary" data-page="movements">⇄ Spostamenti</button>'+writeButton('+ Prenotazione','create-booking'))+
 '<div class="filters">'+selectTrip(trips,state.trip)+searchField()+'<select id="filter-bookings-state"><option value="active" '+(state.bookingsState==='active'?'selected':'')+'>Attive</option><option value="all" '+(state.bookingsState==='all'?'selected':'')+'>Tutte</option><option value="cancelled" '+(state.bookingsState==='cancelled'?'selected':'')+'>Annullate</option></select></div>'+
 '<div class="cards">'+card('Prenotazioni trovate',String(data.length),'Con filtri selezionati')+card('Persone',String(sum),'Solo prenotazioni attive')+card('Pagamenti',String(pay.length),'Movimenti nel database')+card('Archivio originale',String(get('bookings').length),'Nessun dato sostitutivo')+'</div>'+
 panel('Elenco prenotazioni','Premi sul nominativo per i dettagli',table(['Cliente','Viaggio','Posti','Fermata','Importi','Stato','Check-in','Scheda'],rows));
}

function drawMovements(){
 const trips=get('trips'),b=get('bookings').filter(bookingActive).filter(x=>
   filterTerm(bookingName(x),x.telefono,x.codice,tripName(tripBy(x.viaggio_id))));
 const rows=b.slice().sort((a,b)=>String(tripBy(a.viaggio_id)?.data_partenza||'').localeCompare(String(tripBy(b.viaggio_id)?.data_partenza||''))).map(x=>{
  const t=tripBy(x.viaggio_id),related=eligibleBusTargets(t,trips),dates=eligibleDateTargets(t,trips,todayItaly());
  return [
   '<strong>'+safeLink(bookingName(x),x.id)+'</strong><small class="row-sub">'+esc(x.codice||short(x.id))+'</small>',
   '<span>'+esc(tripName(t))+'</span><small class="row-sub">'+dateIT(t?.data_partenza)+(Number(t?.bis_numero||1)>1?' · BUS BIS '+Number(t.bis_numero):' · BUS principale')+'</small>',
   '<strong>'+num(x.posti)+' persone</strong><small class="row-sub">'+esc(x.posti_selezionati||'Non riconciliati')+'</small>',
   money(x.pagato)+' / '+money(x.totale),
   '<span>'+Math.max(0,related.length-1)+' autobus alternativi · '+dates.length+' partenze future</span>',
   '<div class="row-actions">'+writeButton('Modifica dati','edit-booking-info','data-id="'+esc(x.id)+'"')+'<button class="secondary" data-action="transfer-booking" data-id="'+esc(x.id)+'">⇄ Posti / BUS / data</button></div>'
  ];
 });
 return intro('Spostamenti posti e partecipanti','Cambio sedili sullo stesso bus, trasferimento BUS/BIS o nuova data con anteprima e conservazione dei pagamenti.',
  '<button class="secondary" data-page="bookings">Apri prenotazioni</button>')+
 '<div class="filters">'+searchField('Cerca un partecipante, telefono, codice o viaggio')+'</div>'+
 '<div class="cards">'+card('Prenotazioni attive',String(b.length),'Nessuna prenotazione viene duplicata')+
 card('Tipi di spostamento','3','Stesso bus · BUS BIS · Nuova data')+
 card('Pagamenti','Conservati','Quote già versate non azzerate')+
 card('Modalità',WRITES_ENABLED?'Attiva':'Anteprima','Conferma protetta fino al collaudo')+'</div>'+
 panel('Prenotazioni e spostamenti','Clicca Gestisci per selezionare il bus e verificare i posti liberi',
 table(['Partecipante / codice','Partenza e autobus','Posti','Versato / totale','Alternative','Gestione'],rows));
}
function busTargetLabel(t){
 return tripName(t)+' · '+dateIT(t?.data_partenza)+' · '+(Number(t?.bis_numero||1)>1?'BUS BIS '+t.bis_numero:'BUS principale')+' · '+Number(t?.posti_totali||0)+' posti';
}
function transferSeatChoices(target,inventory,selected){
 const official=get('tripLayouts').find(x=>x.viaggio_id===target.id);
 const rows=Array.isArray(official?.configurazione?.rows)?official.configurazione.rows:[];
 const blocked=new Set(),mapped=[];
 if(rows.length){
  for(const r of rows)for(const c of (Array.isArray(r)?r:r.cells||[])){
   if(c?.type!=='seat')continue;
   const n=String(Number(c.id||c.label));
   if(/^[1-9]\d{0,2}$/.test(n)){
    mapped.push(n);
    if(['blocked','out_of_service'].includes(c.status))blocked.add(n);
   }
  }
 }
 const seats=rows.length?[...new Set(mapped)].sort((a,b)=>Number(a)-Number(b)):Array.from({length:Number(target.posti_totali||0)},(_,i)=>String(i+1));
 const html=seats.map(n=>{
  const occupied=inventory.taken.has(n),notAvailable=blocked.has(n),checked=selected.includes(n);
  const cls=occupied?'booked':checked?'selected':notAvailable?'booked':'';
  return '<button type="button" class="seat '+cls+'" data-move-seat="'+esc(n)+'" '+(occupied||notAvailable?'disabled aria-disabled="true"':'')+
   ' aria-pressed="'+(checked?'true':'false')+'" title="'+esc(occupied?'Posto già occupato':notAvailable?'Posto fuori servizio':'Posto '+n)+'">'+esc(n)+'</button>';
 }).join('');
 const explanation=rows.length?
  'Posti numerati ricavati dalla piantina ufficiale pubblicata per il BUS scelto.':
  'Elenco numerico dei sedili dal database: la geometria fisica del bus non è pubblicata, quindi non viene inventata.';
 return '<div class="help">'+esc(explanation)+'</div><div class="seat-pick-grid" aria-label="Selezione sedili disponibili">'+html+'</div>';
}
function openTransferWizard(id){
 const b=get('bookings').find(x=>x.id===id);
 if(!b||!bookingActive(b))throw new Error('Prenotazione assente oppure annullata.');
 if(b.checkin_effettuato)throw new Error('Il check-in risulta già effettuato: modificare le presenze prima del trasferimento.');
 const src=tripBy(b.viaggio_id);if(!src)throw new Error('Viaggio origine non disponibile.');
 transferWizard={id,mode:'bus',targetId:src.id,chosen:seatsOf(b)};
 pendingTransfer=null;
 renderTransferWizard();
}
function renderTransferWizard(){
 if(!transferWizard)return;
 const b=get('bookings').find(x=>x.id===transferWizard.id);
 const src=tripBy(b?.viaggio_id);if(!b||!src)return;
 const busOptions=eligibleBusTargets(src,get('trips'));
 const dateOptions=eligibleDateTargets(src,get('trips'),todayItaly());
 const mode=transferWizard.mode==='date'?'date':'bus';
 const choices=mode==='date'?dateOptions:busOptions;
 let target=choices.find(x=>x.id===transferWizard.targetId);
 if(!target){target=choices[0];transferWizard.targetId=target?.id||'';transferWizard.chosen=target?.id===src.id?seatsOf(b):[];}
 const inv=target&&mode==='bus'?seatInventory(target,get('bookings'),get('seats'),{ignoreBookingId:target.id===src.id?b.id:null}):null;
 const selected=(transferWizard.chosen||[]).filter(n=>inv?.free.includes(n));
 transferWizard.chosen=selected;
 const options=choices.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===target?.id?'selected':'')+'>'+esc(busTargetLabel(t))+'</option>').join('');
 const payment=get('payments').filter(p=>p.prenotazione_id===b.id).reduce((sum,p)=>sum+num(p.importo),0);
 const available=mode==='bus'&&target?
  '<div class="cards">'+card('Posti numerati liberi',String(inv.free.length),target.id===src.id?'Comprende i posti della prenotazione selezionata':'Disponibilità sul bus scelto')+
  card('Persone da spostare',String(b.posti),'L’intero gruppo della prenotazione')+'</div>'+
  (inv.problems.length?'<div class="error-panel"><strong>Riconciliazione necessaria</strong><p>'+esc(inv.problems.join('; '))+'</p></div>':'')+
  transferSeatChoices(target,inv,selected)+
  '<label class="span-2">Posti richiesti, separati da virgola<input name="targetSeats" id="move-seat-input" value="'+esc(selected.join(', '))+'" placeholder="Es. 5, 6" required></label>'+
  '<p class="help span-2">Clicca i numeri liberi per selezionarli. Se altri operatori occupano quei posti, la conferma sul server deve essere rifiutata.</p>':
  '<p class="help span-2">Nella nuova data il server propone sedili alternativi, cercando prima di mantenere i numeri originali. L’anteprima precisa compare prima della conferma. Potrai poi modificarli dalla nuova piantina.</p>';
 const html='<p class="help">Cliente: <strong>'+esc(bookingName(b))+'</strong> · '+num(b.posti)+' persone · '+esc(tripName(src))+' del '+dateIT(src.data_partenza)+
  ' · '+(Number(src.bis_numero||1)>1?'BUS BIS '+src.bis_numero:'BUS principale')+'</p>'+
  '<div class="cards">'+card('Totale prenotazione',money(b.totale),'Il prezzo non viene modificato automaticamente')+
  card('Versato a database',money(b.pagato),payment===num(b.pagato)?'Movimenti riconciliati':'Verificare: movimenti '+money(payment))+'</div>'+
  '<form data-save="transfer-preview" class="form-grid"><input name="bookingId" type="hidden" value="'+esc(b.id)+'">'+
  '<label class="span-2">Tipo di spostamento<select name="transferMode" id="move-mode">'+
  '<option value="bus" '+(mode==='bus'?'selected':'')+'>Cambio posto / BUS principale / BUS BIS, stessa data</option>'+
  '<option value="date" '+(mode==='date'?'selected':'')+'>Cambio data, stessa destinazione</option></select></label>'+
  '<label class="span-2">Destinazione<select name="targetTrip" id="move-target" '+(target?'required':'disabled')+'>'+options+'</select></label>'+
  (!choices.length?'<div class="alert span-2">Nessuna destinazione compatibile disponibile per questa modalità.</div>':'')+
  available+
  '<button type="submit" class="primary span-2" '+(!target||!!inv?.problems.length?'disabled':'')+'>Verifica e visualizza anteprima</button></form>'+
  '<p class="help">La conferma finale richiede controllo della capienza e approvazione esplicita. Le ricevute dei pagamenti pregressi restano nell’archivio.</p>';
 displayModal('Gestione partecipanti e posti · '+bookingName(b),html);
}
function reviewTransferForSubmission(form){
 if(!transferWizard)throw new Error('Procedura di spostamento non aperta.');
 const data=new FormData(form);
 const b=get('bookings').find(x=>x.id===String(data.get('bookingId')));
 const source=tripBy(b?.viaggio_id);
 const target=tripBy(String(data.get('targetTrip')||''));
 const mode=String(data.get('transferMode')||'');
 if(!b||!source||!target)throw new Error('Verificare prenotazione e autobus di destinazione.');
 if(b.checkin_effettuato)throw new Error('Check-in già registrato; non si può spostare la prenotazione.');
 if(mode==='bus'){
  const result=reviewBusTransfer({booking:b,origin:source,target,bookings:get('bookings'),seatRows:get('seats'),chosen:String(data.get('targetSeats')||''),
   layout:get('tripLayouts').find(l=>l.viaggio_id===target.id)?.configurazione||null});
  if(result.sourceTripId===result.targetTripId&&result.oldSeats.join(',')===result.seats.join(','))throw new Error('I posti selezionati coincidono con quelli già assegnati.');
  return {kind:'bus',id:b.id,sourceTripId:source.id,targetTripId:target.id,seats:result.seats,
   oldSeats:result.oldSeats,paid:result.paid,total:result.total,bookingUpdatedAt:b.updated_at,persons:Number(b.posti)};
 }
 if(mode==='date'){
  const candidates=eligibleDateTargets(source,get('trips'),todayItaly());
  if(!candidates.find(t=>t.id===target.id))throw new Error('La data selezionata non è idonea: serve la stessa destinazione in una data futura.');
  return {kind:'date',id:b.id,sourceTripId:source.id,targetTripId:target.id,
   oldSeats:seatsOf(b),paid:Number(b.pagato),total:Number(b.totale),bookingUpdatedAt:b.updated_at,persons:Number(b.posti)};
 }
 throw new Error('Modalità di trasferimento non riconosciuta.');
}
function showTransferPreview(plan,serverPreview=null){
 const source=tripBy(plan.sourceTripId),target=tripBy(plan.targetTripId);
 const b=get('bookings').find(x=>x.id===plan.id);
 const chosen=serverPreview?.new_seats||plan.seats||[];
 if(!Array.isArray(chosen)||chosen.length!==plan.persons)throw new Error('L’anteprima del numero di sedili non è coerente.');
 pendingTransfer={...plan,seats:chosen,sourceAmount:plan.paid};
 const priceWarn=serverPreview?.price_review_required?
  '<div class="alert">La quota della nuova partenza differisce dal totale prenotato: verificare eventuale differenza prima di riscuotere un saldo. Nessun addebito viene creato automaticamente.</div>':'';
 const html='<div class="detail-grid">'+
  [['Cliente',bookingName(b)],['Da',busTargetLabel(source)],['A',busTargetLabel(target)],
   ['Passeggeri',plan.persons],['Posti prima',(plan.oldSeats||[]).join(', ')||'—'],
   ['Posti dopo',chosen.join(', ')],['Pagato conservato',money(plan.paid)],
   ['Totale conservato',money(plan.total)]
  ].map(([key,val])=>'<div><small>'+esc(key)+'</small><strong>'+esc(val)+'</strong></div>').join('')+'</div>'+
  priceWarn+
  '<div class="alert">Il cambio aggiorna i posti e il collegamento del viaggio; non crea un secondo pagamento. La conferma PDF aggiornata dovrà sostituire quella precedente per la nuova disposizione.</div>'+
  '<div class="action-row"><button class="secondary" data-action="transfer-booking" data-id="'+esc(plan.id)+'">← Modifica scelta</button>'+
  writeButton('Conferma spostamento definitivo','commit-transfer')+'</div>'+
  (!WRITES_ENABLED?'<p class="help">Anteprima verificabile. La conferma definitiva è attualmente disabilitata perché il backup/restore aziendale non è stato certificato.</p>':'');
 displayModal('Anteprima spostamento · '+bookingName(b),html);
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
 return intro('Control Room','Piantina ufficiale, passeggeri, fermate e preparazione della lista autista.','<button class="secondary" data-action="pdf-operational">↓ PDF Control Room</button><button class="secondary" data-action="pdf-roster">↓ Elenco prenotati PDF</button><button class="secondary" data-action="pdf-layout">↓ Piantina PDF</button><button class="secondary" data-action="copy-phones">Copia numeri</button>')+
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
  safeLink('Esamina',l.id,'detail-layout')+' '+writeButton('Applica a viaggio','publish-trip-layout','data-id="'+esc(l.id)+'"')
 ]);
 const pub=official.map(l=>[esc(tripName(tripBy(l.viaggio_id))),num(l.configurazione?.posti_totali||0),num(l.versione),dateTimeIT(l.pubblicata_il)]);
 return intro('Piantine autobus','Schemi importati dal database aziendale: GT 53, GT 63 e configurazioni dedicate.','<button class="secondary" data-action="pdf-selected-layout" title="Scarica la piantina selezionata in PDF">↓ PDF piantina</button><button class="secondary" data-page="control">Apri Control Room</button>'+'<button class="primary" data-action="create-layout">+ Crea bozza locale</button>')+
 '<div class="cards">'+card('Layout in libreria',String(lib.length),'Schemi salvati')+card('Applicati ai viaggi',String(official.length),'Configurazioni pubblicate')+card('Bus GT',String(fleet.length),'Senza van aziendale')+card('Disponibilità',WRITES_ENABLED?'Operativa':'Protetta','Pubblicazione bloccata in collaudo')+'</div>'+
 panel('Libreria piantine','Nessuna modifica alla geometria salvata',table(['Nome','Sedili','File','Stato','Aggiornata','Azioni'],rows))+
 panel('Piantine già applicate','Rilevate da dg28_trip_layouts',table(['Viaggio','Posti','Versione','Pubblicata'],pub))+
 '<div class="alert">L’editor grafico e la pubblicazione richiedono verifiche transazionali. Non eseguire modifiche ai layout dei viaggi fino al ripristino verificato del backup.</div>';
}
function drawCash(){
 const cash=get('cash'),ops=get('operators'),payments=get('payments'),rentals=get('rentalPayments'),trans=get('transfers');
 const cards='<div class="cards">'+card('Casse operatori',String(cash.length),'Valori calcolati dalla vista ufficiale')+
 card('Pagamenti viaggi e noleggi',String(payments.length+rentals.length),'Movimenti originali')+
 card('Giroconti tra casse',String(trans.length),'Nicola ↔ Raffaele · movimenti contabilizzati')+
 card('Contabilità',WRITES_ENABLED?'Attiva':'Protetta','Solo lettura durante il collaudo')+'</div>';
 const cardOperators=cash.map(c=>'<div class="panel"><div class="panel-head"><div><h3>Contabilità '+esc(c.nome||c.username||'Operatore')+'</h3><p>Riconciliata con la vista Supabase</p></div>'+badge('Operatore')+'</div><div class="panel-body"><div class="cards" style="grid-template-columns:1fr 1fr">'+
  card('Cassa netta',money(c.cassa_netto),'')+card('Incassi viaggi',money(c.viaggi_incassati),'')+
  card('Incassi noleggi',money(c.noleggi_incassati),'')+card('Contanti netti',money(c.contanti_netto),'')+'</div></div></div>').join('');
 const rows=payments.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,80).map(p=>[
  dateIT(p.data_pagamento)||dateTimeIT(p.created_at),esc(p.cliente||'—'),
  esc(tripName(tripBy(p.viaggio_id))),badge(p.tipo),money(p.importo),
  esc(p.incassato_da||ops.find(x=>x.user_id===p.incassato_da_user_id)?.nome||'—'),
  '<span>'+esc(p.receipt_number||'—')+'</span><small class="row-sub">'+(p.receipt_professional_path||p.receipt_storage_path?safeLink('Apri originale',p.id,'open-payment-receipt'):'')+' · '+safeLink('Riepilogo PDF',p.id,'pdf-payment')+'</small>'
 ]);
 return intro('Contabilità e casse','Incassi, ripartizione Nicola / Raffaele, ricevute e movimenti.','<button class="secondary" data-action="pdf-cash">↓ PDF contabilità</button><button class="secondary" data-action="export-payments">↓ CSV pagamenti</button>'+writeButton('+ Incasso viaggio','new-payment')+writeButton('+ Incasso noleggio','new-rental-payment'))+
 cards+'<div class="section-grid">'+cardOperators+'</div>'+
 panel('Registro incassi viaggi','Dati originali da pagamenti · ultime 80 righe',table(['Data','Cliente','Viaggio','Tipo','Importo','Incassato da','Ricevuta'],rows))+
 panel('Pagamenti noleggi','Dati originali da noleggi_bus_pagamenti · non inclusi nel registro delle gite',table(['Data','Servizio','Tipo','Importo','Metodo','Ricevuta'],rentals.slice().sort((a,b)=>String(b.data_pagamento).localeCompare(String(a.data_pagamento))).slice(0,100).map(p=>[dateIT(p.data_pagamento),esc(get('rentals').find(n=>n.id===p.noleggio_id)?.referente||short(p.noleggio_id)),badge(p.tipo),money(p.importo),esc(p.metodo||'—'),'<span>'+esc(p.receipt_number||'—')+'</span><small class="row-sub">'+(p.receipt_professional_path||p.receipt_path?safeLink('Apri originale',p.id,'open-rental-receipt'):'')+'</small>'])))+
 panel('Giroconti tra casse · Nicola ↔ Raffaele','Movimenti di denaro tra operatori · gestione contabile tracciata',table(['Data','Da','A','Importo','Stato'],trans.map(t=>[dateIT(t.data_trasferimento),esc(ops.find(o=>o.user_id===t.da_operatore_user_id)?.nome||'—'),esc(ops.find(o=>o.user_id===t.a_operatore_user_id)?.nome||'—'),money(t.importo),badge(t.stato)])),writeButton('+ Giroconto','new-transfer'));
}

function drawCredits(){
 const available=creditAvailable();
 const transfers=available?get('creditTransfers'):[];
 const books=get('bookings'),trips=get('trips');
 const rows=transfers.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(t=>{
  const a=books.find(b=>b.id===t.source_booking_id),b=books.find(b=>b.id===t.target_booking_id);
  const x=trips.find(v=>v.id===t.source_trip_id),y=trips.find(v=>v.id===t.target_trip_id);
  return [dateTimeIT(t.created_at),esc(a?.cliente||'—'),
   esc(tripName(x)),esc(tripName(y)),money(t.importo),badge(t.stato),esc(t.motivo||'')];
 });
 return intro('Giroconto quote tra viaggi','Riassegnazione di acconti già incassati quando un viaggio non si forma. È distinto dal Giroconto tra casse Nicola ↔ Raffaele.',
  '<button class="secondary" data-page="cash">Contabilità e casse</button>')+
  '<div class="cards">'+card('Giroconti registrati',available?String(transfers.length):'—',
    available?'Movimenti del registro Supabase':'Registro in corso di predisposizione')+
  card('Incassi aggiuntivi','0','Un giroconto non è un nuovo pagamento')+
  card('Archivio ricevute','Invariato','Le ricevute originali restano nel viaggio di origine')+'</div>'+
  (!available?'<div class="alert">Il registro Supabase per i giroconti tra viaggi non è ancora installato. Le operazioni rimangono protette: nessun credito verrà trasferito finché la procedura non sarà collaudata.</div>':'')+
  panel('Storico giroconti tra viaggi','Per ogni movimento rimangono identificati la prenotazione e il viaggio di origine e destinazione',
   table(['Data','Cliente','Da viaggio','A viaggio','Importo','Stato','Motivo'],rows));
}

function drawEconomy(){
 const movements=get('economy'),profit=get('profit').sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
 const income=movements.filter(m=>/entrata|incass/i.test(m.tipo||'')).reduce((a,m)=>a+num(m.importo),0);
 const out=movements.filter(m=>/uscita|costo|spesa/i.test(m.tipo||'')).reduce((a,m)=>a+num(m.importo),0);
 const rows=profit.map(t=>[esc(t.titolo||t.destinazione),dateIT(t.data_partenza),money(t.entrate),money(t.uscite),'<b>'+money(t.margine)+'</b>']);
 return intro('Economia e costi','Marginalità dei viaggi e registro dei movimenti contabili.','<button class="secondary" data-action="pdf-economy">↓ PDF economia</button>')+
 '<div class="cards">'+card('Movimenti economici',String(movements.length),'Da economia_movimenti')+card('Entrate da movimenti',money(income),'Secondo campo tipo')+card('Uscite da movimenti',money(out),'Secondo campo tipo')+card('Bilancio movimenti',money(income-out),'Entrate meno uscite')+'</div>'+
 panel('Redditività per viaggio','Vista ufficiale dg_viaggi_redditivita',table(['Viaggio','Partenza','Entrate','Uscite','Margine'],rows))+
 panel('Registro movimenti','Registrazioni originali, senza alterare l’origine',table(['Data','Categoria','Descrizione','Tipo','Importo','Operatore'],movements.slice().sort((a,b)=>String(b.data_movimento).localeCompare(String(a.data_movimento))).slice(0,150).map(m=>[dateIT(m.data_movimento),esc(m.categoria),esc(m.descrizione),badge(m.tipo),money(m.importo),esc(m.operatore)])));
}
function drawCustomers(){
 const customers=get('customers').filter(c=>filterTerm(c.nome,c.cognome,c.telefono,c.email,c.codice_cliente));
 const books=get('bookings'),rows=customers.map(c=>[
  '<b>'+esc([c.nome,c.cognome].filter(Boolean).join(' '))+'</b>',
  esc(c.telefono||'—'),esc(c.email||'—'),esc(c.citta||'—'),badge(c.stato_cliente),'<span>'+esc(c.codice_cliente||short(c.id))+'</span><small class="row-sub">'+safeLink('Fascicolo PDF',c.id,'pdf-customer')+'</small>'
 ]);
 return intro('Anagrafica clienti','Storico aziendale originale e collegamento ai pagamenti.','<button class="secondary" data-action="pdf-customers">↓ PDF elenco clienti</button><button class="secondary" data-action="export-customers">↓ CSV</button>'+writeButton('+ Nuovo cliente','create-customer'))+
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
  num(n.passeggeri),money(n.prezzo_concordato),money(n.acconto),badge(n.stato_noleggio),badge(n.stato_pagamento),safeLink('PDF',n.id,'pdf-rental')+' '+writeButton('Incasso','new-rental-payment','data-id="'+esc(n.id)+'"')
 ]);
 return intro('Noleggi autobus','Gestione noleggi GT, servizi privati ed eventi.','<button class="secondary" data-action="pdf-rentals">↓ PDF noleggi</button><button class="secondary" data-action="refresh">↻ Aggiorna</button>'+writeButton('+ Noleggio','create-rental'))+
 '<div class="filters">'+searchField('Cerca azienda, referente o destinazione')+'</div>'+
 panel('Servizi e contratti','Dati da noleggi_bus',table(['Cliente','Partenza','Tratta','Pax','Prezzo','Acconto','Stato','Pagamento','Scheda'],rows));
}
function drawAgenda(){
 const items=get('agenda').filter(a=>filterTerm(a.titolo,a.descrizione,a.tipo)).sort((a,b)=>String(a.data_scadenza).localeCompare(String(b.data_scadenza)));
 const rows=items.map(a=>[
  '<strong>'+esc(a.titolo)+'</strong><small class="row-sub">'+esc(a.descrizione||'')+'</small>',
  dateIT(a.data_scadenza),badge(a.priorita),badge(a.stato),esc(a.tipo),
  writeButton('✓ Completa','complete-agenda','data-id="'+esc(a.id)+'"')
 ]);
 return intro('Agenda e scadenze','Ripristino della vera agenda presente su Supabase.','<button class="secondary" data-action="pdf-agenda">↓ PDF agenda</button><button class="secondary" data-action="export-agenda">↓ CSV</button>'+writeButton('+ Nuovo impegno','create-agenda'))+
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
 return intro('Flotta aziendale','Tre autobus Gran Turismo e il Limousine Bus; il van non è promosso nella V4.','<button class="secondary" data-action="pdf-fleet">↓ PDF flotta</button>')+
 '<div class="cards">'+card('Autobus ed eventi',String(fleet.length),'Escluso il van')+card('GT 53 posti',String(fleet.filter(x=>num(x.posti)===53).length),'Irizar Scania Century')+card('GT 63 posti',String(fleet.filter(x=>num(x.posti)===63).length),'Irizar Scania PB')+card('Limousine Bus',String(fleet.filter(x=>/limousine/i.test(x.titolo||'')).length),'Servizi party ed eventi')+'</div>'+
 panel('Mezzi', 'Le schede corrispondono a quelle presenti nel database',table(['Autobus','Targa','Posti','Condizione','Attività'],rows));
}
function drawDocuments(){
 const docs=get('documents');
 const rows=docs.slice(0,220).map(d=>[
  badge(d.tipo_documento),esc(d.numero_documento||short(d.documento_id)),
  esc(d.cliente||'—'),esc(d.viaggio||tripName(tripBy(d.viaggio_id))),
  dateIT(d.data_documento),money(d.importo),
  (d.storage_path?safeLink('Apri PDF',d.storage_path,'open-stored-document'):'<span class="muted small">Non archiviato</span>')
 ]);
 return intro('Documenti e ricevute','Inventario PDF e conferme dei clienti; i file privati sono protetti da Supabase Storage.','<button class="secondary" data-action="pdf-document-inventory">↓ PDF archivio</button>')+
 '<div class="cards">'+card('Voci documentali',String(docs.length),'Vista archivio_documenti')+card('Ricevute private','237','Inventario Storage precedente')+card('Locandine','56','Inventario Storage precedente')+card('Backup','Da verificare','Non sono copie certificate')+'</div>'+
 panel('Archivio documenti','Lettura dal database; i file privati non sono resi pubblici',table(['Tipo','Numero','Cliente','Viaggio','Data','Importo','Documento'],rows));
}
function drawNotifications(){
 const notes=get('notifications');
 return intro('Notifiche','Nuove prenotazioni, attività aziendali e messaggi operativi.','<button class="secondary" data-action="refresh">↻ Aggiorna</button>')+
 panel('Notifiche registrate','Consultazione manuale per ridurre il carico dell’API','<div class="panel-body">'+(notes.map(n=>'<div class="notice-card"><strong>'+esc(n.titolo)+'</strong><p>'+esc(n.messaggio)+'</p><span class="small muted">'+dateTimeIT(n.created_at)+' · '+esc(n.tipo||'Notifica')+'</span></div>').join('')||'<div class="empty">Nessuna notifica.</div>')+'</div>');
}

function drawQuotes(){
 const items=get('quotes').filter(q=>filterTerm(q.numero_preventivo,q.nome,q.cognome,q.destinazione,q.azienda));
 const rows=items.map(q=>[
  '<strong>'+esc(q.numero_preventivo||short(q.id))+'</strong>',
  esc([q.nome,q.cognome].filter(Boolean).join(' ')||q.azienda||'-'),
  dateIT(q.data_partenza||q.data_viaggio),
  esc(q.destinazione||'—'),
  num(q.numero_passeggeri),money(q.importo_preventivo??q.importo),
  badge(q.stato),safeLink('PDF',q.id,'pdf-quote')
 ]);
 return intro('Preventivi','Richieste e offerte già registrate in Supabase.','<button class="secondary" data-action="export-quotes">↓ CSV preventivi</button>'+writeButton('+ Nuovo preventivo','create-quote'))+
 '<div class="filters">'+searchField('Numero, cliente o destinazione')+'</div>'+
 panel('Registro preventivi','Nessun preventivo viene automaticamente accettato o emesso',table(['Numero','Richiedente','Data','Destinazione','Pax','Importo','Stato','Report'],rows));
}
function drawInvoices(){
 const items=get('invoices'),rows=items.map(i=>[
  '<strong>'+short(i.id)+'</strong>',dateIT(i.data_bozza),badge(i.tipo_documento),
  money(num(i.imponibile_centesimi)/100),money(num(i.iva_centesimi)/100),
  money(num(i.totale_centesimi)/100),badge(i.stato),
  safeLink('Bozza PDF',i.id,'pdf-invoice')
 ]);
 return intro('Fatturazione e bozze','Documenti preparatori collegati al sistema aziendale; nessuna fattura elettronica è emessa da questa schermata.')+
 '<div class="cards">'+card('Bozze presenti',String(items.length),'Rilevate da dg3_fatture_bozze')+
 card('Valore bozze',money(items.reduce((n,x)=>n+num(x.totale_centesimi)/100,0)),'Non equivalente a fatturato emesso')+
 card('Emissioni', 'Da integrare','Serve processo SDI certificato')+
 card('Stato',WRITES_ENABLED?'Verifica in corso':'Consultazione','Modifiche sospese')+'</div>'+
 panel('Elenco bozze fattura','Non utilizzare il PDF bozza come fattura fiscale',table(['ID bozza','Data','Tipo','Imponibile','IVA','Totale','Stato','PDF'],rows));
}
function drawWaitlist(){
 const trips=get('trips');
 const items=get('waitlist').filter(w=>filterTerm(w.nome,w.cognome,w.telefono,tripName(tripBy(w.viaggio_id))));
 const rows=items.map(w=>[
  '<strong>'+esc([w.nome,w.cognome].filter(Boolean).join(' '))+'</strong>',
  esc(w.telefono||'—'),
  esc(tripName(tripBy(w.viaggio_id))),num(w.posti),
  badge(w.stato),badge(w.priorita),dateTimeIT(w.created_at)
 ]);
 return intro('Lista d’attesa','Richieste in attesa di posti e opzioni BUS BIS, senza prenotazioni fittizie.',writeButton('+ Aggiungi richiesta','create-waitlist'))+
 '<div class="filters">'+searchField('Cerca cliente o viaggio')+'</div>'+
 '<div class="cards">'+card('Contatti in lista',String(get('waitlist').length),'Tabella lista_attesa')+
 card('Richieste in vista',String(items.length),'Filtri attivi')+
 card('Passeggeri richiesti',String(items.reduce((n,x)=>n+num(x.posti),0)),'Da confermare')+
 card('Conferme automatiche','Disattivate','Mai assegnare posti senza controllo')+'</div>'+
 panel('Richieste in attesa','Non vengono scalati posti dai viaggi',table(['Cliente','Telefono','Viaggio','Pax','Stato','Priorità','Inserimento'],rows));
}
function drawWhatsApp(){
 const inbox=get('whatsAppInbox'),outbound=get('whatsAppOutbound'),optins=get('whatsAppOptins');
 const valid=optins.filter(x=>x.consent_at&&!x.revoked_at),pending=outbound.filter(x=>!/inviat|deliver|success/i.test(x.status||''));
 const list=inbox.slice().sort((a,b)=>String(b.received_at).localeCompare(String(a.received_at))).slice(0,100);
 return intro('WhatsApp Business','Archivio integrazione ibrida: consenso, richieste e messaggi in uscita. Nessun invio automatico dalla V4 di collaudo.')+
 '<div class="cards">'+card('Messaggi ricevuti',String(inbox.length),'Integrazione presente in DB')+
 card('Consensi attivi',String(valid.length),'Contatti autorizzati')+
 card('Messaggi in uscita',String(outbound.length),'Registro di invio')+
 card('Da verificare',String(pending.length),'Non presumere che siano stati recapitati')+'</div>'+
 panel('Richieste WhatsApp','Dati riservati del canale business',table(['Data','Contatto','Richiesta','Stato'],list.map(x=>[
 dateTimeIT(x.received_at),esc(x.sender_name||x.sender_phone),esc(x.message_text||'').slice(0,220),badge(x.status)])))+
 '<div class="alert">Gli inviti a gruppi WhatsApp richiedono consenso effettivo. Non aggiungere automaticamente i clienti e non inviare comunicazioni non autorizzate.</div>';
}
function drawReports(){
 const buttons=[
 ['Elenco prenotati tutti i viaggi','pdf-all-roster'],
 ['Liste + piantine Control Room','pdf-all-operational'],
 ['Contabilità Nicola / Raffaele','pdf-cash'],
 ['Economia e marginalità','pdf-economy'],
 ['Agenda e scadenze','pdf-agenda'],
 ['Anagrafica clienti','pdf-customers'],
 ['Noleggi autobus','pdf-rentals'],
 ['Flotta GT / Limousine','pdf-fleet'],
 ['Indice documenti e ricevute','pdf-document-inventory']
 ];
 return intro('Centro documentale e PDF','Generazione diretta di PDF A4 con logo aziendale, scaricabili anche da iPhone.')+
 '<div class="cards">'+card('Tipologie PDF',String(buttons.length),'Senza generatori esterni')+
 card('Sistema','Locale','PDF costruiti nel browser')+
 card('Formato','A4','Paginazione automatica')+
 card('Storage','Non modificato','Download privato sul dispositivo')+'</div>'+
 panel('Genera un documento','I dati sono letti dalle sezioni e non sono salvati sul server',
 '<div class="panel-body"><div class="section-grid">'+buttons.map(([text,action])=>
 '<button class="secondary" data-action="'+action+'" style="justify-content:space-between;white-space:normal;min-height:56px;text-align:left">'+esc(text)+' <span aria-hidden="true">↓ PDF</span></button>').join('')+'</div></div>')+
 '<div class="alert">Per i singoli viaggi, le prenotazioni e le singole ricevute usa anche i pulsanti PDF nelle rispettive pagine. Una copia locale non aggiorna automaticamente il registro dei documenti ufficiali.</div>';
}

function drawDiagnostics(){
 const health=get('system')[0]||{};
 const t=get('trips'),b=get('bookings'),p=get('payments'),s=get('seats');
 const errs=get('alerts');
 const allAssignments=new Map();
 for(const item of s){
  const set=allAssignments.get(item.prenotazione_id)||new Set();
  if(item.posto!=null)set.add(String(item.posto).trim());
  allAssignments.set(item.prenotazione_id,set);
 }
 const seatAlerts=b.filter(x=>bookingActive(x)&&!x.riserva_aziendale).map(x=>({
  booking:x,registro:allAssignments.get(x.id)?.size||0,
  dichiarati:num(x.posti),testuali:[...new Set(seatsOf(x))].length
 })).filter(x=>x.registro!==x.dichiarati);
 return intro('Diagnostica e integrità','Controlli non distruttivi, stato dati e anomalie da riconciliare.','<button class="secondary" data-action="refresh">↻ Ripeti letture</button>')+
 '<div class="cards">'+card('Viaggi',String(t.length),'Vista dal database')+card('Prenotazioni',String(b.length),'Dati originali')+card('Pagamenti',String(p.length),'Registro importi')+card('Sedili assegnati',String(s.length),'Registro posti')+'</div>'+
 panel('Stato del sistema','Ultima verifica interna in Supabase','<div class="panel-body"><div class="detail-grid">'+
 '<div><small>Controllo database</small><strong>'+dateTimeIT(health.checked_at)+'</strong></div><div><small>Operatori autorizzati</small><strong>Accesso confermato con Supabase Auth</strong></div>'+
 '<div><small>Scritture gestionale V4</small><strong>'+esc(WRITES_ENABLED?'Abilitate':'Bloccate in attesa del backup')+'</strong></div>'+
 '<div><small>Endpoint progetto</small><strong>'+esc(API_URL)+'</strong></div></div><p class="help">L’assenza di un errore API in questo momento non certifica la continuità del servizio. Non riavviare PostgREST né apportare modifiche al database senza un ripristino verificato.</p></div>')+
 panel('Prenotazioni con sedili da riconciliare',seatAlerts.length+' difformità tra righe prenotazione_posti e numero persone registrate',
 table(['Viaggio','Prenotazione','Pax','Righe posti','Numeri nel testo','Scheda'],seatAlerts.map(x=>[
 esc(tripName(tripBy(x.booking.viaggio_id))),esc(bookingName(x.booking)),
 String(x.dichiarati),String(x.registro),String(x.testuali),safeLink('Apri',x.booking.id)
 ])))+
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
 '<div><small>Visibilità</small><strong>'+esc(t.data_partenza<todayItaly()?'Viaggio concluso: resta nel gestionale, non appare sul sito':(t.pubblicato==='SI'&&!t.archiviato_at)?'Pubblicato sul sito':'Non pubblicato')+'</strong></div>'+
 '</div><p class="help">ID viaggio: '+esc(t.id)+' · Il BUS BIS mantiene il proprio ID, i propri posti e le prenotazioni separate.</p>'+
 '<div class="action-row"><button class="secondary" data-action="pdf-roster" data-id="'+esc(id)+'">↓ Elenco PDF</button><button class="secondary" data-action="open-trip-control" data-id="'+esc(id)+'">Apri Control Room</button>'+writeButton('Archivia viaggio','archive-trip','data-id="'+esc(id)+'"')+writeButton('Modifica viaggio','edit-trip','data-id="'+esc(id)+'"')+(t.data_partenza>=todayItaly()&&!t.archiviato_at&&!t.bis_parent_id?'<button class="primary" data-action="open-bis" data-id="'+esc(id)+'">+ Apri BUS BIS · scegli posti manualmente</button>':'')+'</div>');
}
function bookingDetail(id){
 const b=get('bookings').find(x=>x.id===id);if(!b)return showMessage('Prenotazione non trovata',true);
 const t=tripBy(b.viaggio_id);
 const pays=get('payments').filter(x=>x.prenotazione_id===b.id);
 const consolidated=bookingActive(b)&&!b.riserva_aziendale?Pdf.combinedBookingSummary(b.id,get('trips'),get('bookings'),get('payments')):null;
 displayModal('Prenotazione · '+bookingName(b),
 '<div class="detail-grid">'+[
  ['Viaggio',tripName(t)+' · '+dateIT(t?.data_partenza)],['Codice',b.codice||short(b.id)],
  ['Telefono',b.telefono],['Fermata',b.fermata_partenza],['Numero passeggeri',num(b.posti)],
  ['Posti',b.posti_selezionati||'Da riconciliare'],['Importo',money(b.totale)],
  ['Pagato dichiarato',money(b.pagato)],['Stato',b.stato],['Check-in',b.checkin_effettuato?'Presente':'Da effettuare']
 ].map(([k,v])=>'<div><small>'+esc(k)+'</small><strong>'+esc(v||'—')+'</strong></div>').join('')+
 '</div><h3 class="section-title">Pagamenti collegati</h3>'+
 table(['Data','Tipo','Importo','N. ricevuta'],pays.map(p=>[dateIT(p.data_pagamento),badge(p.tipo),money(p.importo),esc(p.receipt_number||'—')]))+
 '<div class="action-row"><button class="secondary" data-action="pdf-booking" data-id="'+esc(b.id)+'">↓ Conferma singola PDF</button>'+(consolidated?.bookingCount>1?'<button class="primary" data-action="pdf-combined-booking" data-id="'+esc(b.id)+'">↓ Conferma unica ('+consolidated.bookingCount+' prenotazioni)</button>':'')+(b.confirmation_storage_path?'<button class="secondary" data-action="open-booking-confirmation" data-id="'+esc(b.id)+'">Apri conferma originale</button>':'')+writeButton('Modifica nominativo e fermata','edit-booking-info','data-id="'+esc(b.id)+'"')+writeButton('Modifica posti e quota','edit-booking','data-id="'+esc(b.id)+'"')+writeButton('Annulla','cancel-booking','data-id="'+esc(b.id)+'"')+writeButton('Registra pagamento','new-payment','data-id="'+esc(b.id)+'"')+
 '<button class="secondary" data-action="transfer-booking" data-id="'+esc(b.id)+'">⇄ Cambia posto / BUS / data</button>'+
 writeButton('Aggiorna check-in','checkin-booking','data-id="'+esc(b.id)+'"')+'</div>'+
 (consolidated?.bookingCount>1?'<p class="help">Le '+consolidated.bookingCount+' prenotazioni collegate sono suddivise per fermata nel PDF cumulativo. Nessuna ricevuta originale viene sostituita.</p>':'')+
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
 '<div class="layout-panel">'+(Array.isArray(l.configurazione?.rows)?rowForSeats(l.configurazione.rows,{map:new Map()}):'<div class="alert">Layout senza matrice valida.</div>')+'</div>'+
 '<div class="action-row"><button class="secondary" data-action="pdf-library-layout" data-id="'+esc(l.id)+'">↓ PDF piantina</button><button class="secondary" data-action="draft-layout" data-id="'+esc(l.id)+'">✎ Modifica una copia locale</button></div>');
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

 if(action==='open-bis'){openBisWizard(id);return;}
 if(action==='back-bis'){pendingBis=null;renderBisWizard();return;}
 if(action==='bis-select-all'||action==='bis-select-none'||action==='bis-select-first'){
  if(!bisWizard)throw new Error('Seleziona prima un viaggio.');
  const bus=get('fleet').find(x=>x.id===bisWizard.busId);
  const lib=get('layoutLibrary').find(x=>x.id===bisWizard.layoutId);
  const info=inspectLayout(lib?.configurazione,Number(bus?.posti||0));
  if(!info.valid)throw new Error('Piantina non compatibile.');
  const usable=info.seats.filter(x=>!info.unusable.has(x));
  let select=action==='bis-select-none'?[]:usable;
  if(action==='bis-select-first'){
   const n=Number($('bis-first-count')?.value||0);
   if(!Number.isInteger(n)||n<1||n>usable.length)throw new Error('Numero posti da aprire non valido.');
   select=usable.slice(0,n);
  }
  bisWizard.selected=select;renderBisWizard();return;
 }
 if(action==='commit-bis-manual'){
  if(!WRITES_ENABLED)throw new Error('Il BUS BIS non può ancora essere creato: backup/ripristino e blocco server dei posti chiusi devono essere collaudati.');
  if(bisBusy)throw new Error('Operazione già in corso. Controlla i viaggi prima di riprovare.');
  const plan=pendingBis;
  if(!plan?.sourceTripId||!plan.bookableSeats?.length)throw new Error('Anteprima BUS BIS scaduta.');
  if(!confirm('Aprire il BUS BIS con '+plan.bookableCount+' posti selezionati su '+plan.physicalSeats+
   ' fisici, '+(plan.publish?'pubblicato':'NON pubblicato')+' sul sito?'))return;
  bisBusy=true;
  try{
   const [trips,fleet,library]=await Promise.all([
    records('trips',{force:true,limit:2500}),
    records('fleet',{force:true,limit:150}),
    records('layoutLibrary',{force:true,limit:500})
   ]);
   const verified=prepareBisSeatOpening({
    source:trips.find(x=>x.id===plan.sourceTripId),
    bus:fleet.find(x=>x.id===plan.busId),
    template:library.find(x=>x.id===plan.layoutId),
    selected:plan.bookableSeats,allTrips:trips,today:todayItaly()
   });
   if(verified.bookableSeats.join(',')!==plan.bookableSeats.join(','))
    throw new Error('Le opzioni di apertura sono cambiate.');
   const result=await writeRpc('dg4_open_trip_bis_manual_v1',{
    p_source_trip_id:plan.sourceTripId,
    p_bus_id:plan.busId,
    p_layout_id:plan.layoutId,
    p_bookable_seats:plan.bookableSeats.map(Number),
    p_publish:plan.publish
   });
   if(result?.success!==true || !result?.trip_id ||
      Number(result.bookable_seats)!==plan.bookableCount)
    throw new Error('La risposta del server non è confermata. Verifica l’elenco viaggi senza ripetere il comando.');
   const newTrips=await records('trips',{force:true,limit:2500});
   const created=newTrips.find(x=>x.id===result.trip_id);
   if(!created||String(created.bis_parent_id)!==String(result.root_trip_id))
    throw new Error('Il server ha risposto ma il nuovo BIS non è ancora riconciliato; controlla prima di riprovare.');
   pendingBis=null;bisWizard=null;closeModal();
   await navigate('trips',true);
   showMessage('BUS BIS aperto: '+plan.bookableCount+' posti manualmente disponibili. Posti non selezionati chiusi nel layout ufficiale.');
  }catch(e){
   pendingBis=null;
   throw new Error(String(e.message||e)+' — NON ripetere l’apertura senza verificare prima se il BUS BIS è stato creato.');
  }finally{bisBusy=false}
  return;
 }


 if(action==='transfer-booking'||action==='move-booking'){
  openTransferWizard(id);return;
 }
 if(action==='commit-transfer'){
  if(!WRITES_ENABLED)throw new Error('Lo spostamento definitivo è sospeso: prima certificare il backup e il ripristino dello staging.');
  if(transferBusy)throw new Error('Spostamento già in elaborazione: controllare il registro prima di riprovare.');
  const plan=pendingTransfer;
  if(!plan?.id || !plan.targetTripId || !plan.seats)throw new Error('L’anteprima è scaduta: ricontrollare i posti.');
  const dest=tripBy(plan.targetTripId);
  if(!dest)throw new Error('Viaggio di destinazione non disponibile.');
  if(!confirm('Confermare lo spostamento di '+plan.persons+' persone verso '+busTargetLabel(dest)+' sui posti '+plan.seats.join(', ')+
     '? I pagamenti saranno conservati. Questa operazione non registra nuovi incassi.'))return;
  transferBusy=true;
  try{
   // Prima di qualsiasi modifica, rileggere il server senza cache per intercettare
   // prenotazioni o sedili aggiornati contemporaneamente da altri operatori.
   const [freshBookings,freshSeats]=await Promise.all([
    records('bookings',{force:true,limit:2500}),records('seats',{force:true,limit:4000})
   ]);
   const booking=freshBookings.find(x=>x.id===plan.id);
   if(!booking || booking.viaggio_id!==plan.sourceTripId ||
      Number(booking.posti)!==plan.persons || booking.checkin_effettuato ||
      Number(booking.pagato)!==plan.paid || Number(booking.totale)!==plan.total ||
      booking.updated_at!==plan.bookingUpdatedAt)
    throw new Error('I dati della prenotazione sono cambiati durante l’anteprima: nessuno spostamento eseguito. Ricarica prima di procedere.');
   let result;
   if(plan.kind==='bus'){
    const review=reviewBusTransfer({
     booking,origin:tripBy(plan.sourceTripId),target:dest,
     bookings:freshBookings,seatRows:freshSeats,chosen:plan.seats,
     layout:get('tripLayouts').find(l=>l.viaggio_id===dest.id)?.configurazione||null
    });
    if(review.seats.join(',')!==plan.seats.join(','))
     throw new Error('La selezione dei posti è cambiata: aggiorna l’anteprima.');
    result=await writeRpc('dg_manage_booking_seats_v1',{
     p_booking_id:plan.id,p_target_trip_id:plan.targetTripId,p_target_seats:plan.seats
    });
   }else if(plan.kind==='date'){
    const latest=await rpcRead('dg3_preview_spostamento_data_v1',{
     p_booking_id:plan.id,p_target_trip_id:plan.targetTripId
    });
    if(!latest?.success || latest.source_trip_id!==plan.sourceTripId ||
       latest.target_trip_id!==plan.targetTripId ||
       (latest.new_seats||[]).join(',')!==plan.seats.join(','))
     throw new Error('La disponibilità sulla nuova data è cambiata: nessuno spostamento eseguito, ricalcola l’anteprima.');
    result=await writeRpc('dg3_sposta_prenotazione_data_v1',{
     p_booking_id:plan.id,p_target_trip_id:plan.targetTripId,
     p_expected_source_trip_id:plan.sourceTripId,p_expected_seats:plan.seats,p_target_stop:null
    });
   }else throw new Error('Modalità spostamento non supportata.');
   if(result?.success!==true)throw new Error('Risposta del server non confermata. Verificare i viaggi prima di ripetere il comando.');
   // Leggere il risultato del server PRIMA di generare la nuova conferma;
   // un eventuale guasto PDF non deve ripetere la movimentazione dei posti.
   let message='Spostamento confermato dal server. Pagamenti originari conservati. ';
   try{
    const newBookings=await records('bookings',{force:true,limit:2500});
    const updated=newBookings.find(x=>x.id===plan.id);
    if(!updated||updated.viaggio_id!==plan.targetTripId)throw new Error('Rilettura prenotazione non conclusa.');
    if(Math.abs(Number(updated.pagato)-plan.paid)>0.005 ||
       Math.abs(Number(updated.totale)-plan.total)>0.005)
     throw new Error('Importi non riconciliati: verificare il registro pagamenti.');
    try{
     const bytes=Pdf.pdfEngine().makeBookingPdf(updated,dest,[]);
     await edgeAction('dg2-booking-pdf',{
      bookingId:updated.id,action:'generate',pdfBase64:pdfBytesAsBase64(bytes)
     });
     message+='Nuova conferma PDF archiviata.';
    }catch(pdfError){
     message+='ATTENZIONE: la nuova conferma PDF NON è stata archiviata ('+String(pdfError.message||pdfError)+'). Non ripetere lo spostamento: genera soltanto la conferma dalla prenotazione aggiornata.';
    }
   }catch(checkError){
    message+='ATTENZIONE: rilettura di controllo non completata ('+String(checkError.message||checkError)+'). Verifica i dati senza ripetere lo spostamento.';
   }
   pendingTransfer=null;transferWizard=null;
   closeModal();state.trip=plan.targetTripId;state.search='';
   await navigate(page==='movements'?'movements':'bookings',true);
   showMessage(message);
  }catch(error){
   // Anche dopo un timeout non sappiamo se il server abbia già applicato lo spostamento.
   // Eliminare il piano per obbligare una nuova lettura e impedire retry automatici.
   pendingTransfer=null;
   throw new Error(String(error.message||error)+' — NON ripetere il comando senza aver verificato i posti sul server.');
  }finally{transferBusy=false;}
  return;
 }


 // Tutte le operazioni PDF sono READ ONLY: i dati usati sono già stati letti con JWT e RLS.
 const tripID=id||state.trip||'';
 const done=report=>showMessage('PDF creato: '+report.filename+' ('+Math.round(report.bytes/1024)+' KB). Puoi salvarlo in File anche da iPhone.');
 if(action==='pdf-roster')return done(Pdf.pdfRoster(get('trips'),get('bookings'),get('seats'),get('tripLayouts'),tripID));
 if(action==='pdf-all-roster')return done(Pdf.pdfRoster(get('trips'),get('bookings'),get('seats'),get('tripLayouts')));
 if(action==='pdf-operational')return done(Pdf.pdfOperational(get('trips'),get('bookings'),get('seats'),get('tripLayouts'),tripID));
 if(action==='pdf-layout'){
   const l=get('tripLayouts').find(x=>x.viaggio_id===tripID);
   if(!l?.configurazione)throw new Error('Piantina ufficiale non presente: nessun PDF inventato.');
   return done(Pdf.pdfSeatMap(l.configurazione,tripName(tripBy(tripID))));
 }
 if(action==='pdf-library-layout'||action==='pdf-selected-layout'){
   const item=get('layoutLibrary').find(x=>x.id===(id||get('layoutLibrary')[0]?.id));
   if(!item)throw new Error('Nessuna piantina nella libreria.');
   return done(Pdf.pdfSeatMap(item.configurazione,item.nome));
 }

 if(action==='pdf-combined-booking'){
   const sum=Pdf.combinedBookingSummary(id,get('trips'),get('bookings'),get('payments'));
   if(sum.bookingCount<2)throw new Error('Non sono state trovate altre prenotazioni dello stesso referente per questo viaggio.');
   const saved=Pdf.pdfCombinedBooking(id,get('trips'),get('bookings'),get('payments'));
   showMessage('Conferma cumulativa creata per '+sum.bookingCount+' prenotazioni, '+sum.sections.length+' fermate e '+sum.passengers+' partecipanti. Totale '+money(sum.totalCents/100)+', pagato netto '+money(sum.paidCents/100)+'.'+(sum.warnings.length?' ATTENZIONE: '+sum.warnings.join(' · '):''));
   return saved;
 }
 if(action==='pdf-booking'){
   const b=get('bookings').find(x=>x.id===id);
   if(!b)throw new Error('Prenotazione non trovata.');
   return done(Pdf.pdfBooking(b,tripBy(b.viaggio_id),get('payments').filter(p=>p.prenotazione_id===id)));
 }
 if(action==='pdf-cash')return done(Pdf.pdfCash(get('cash'),get('payments')));
 if(action==='pdf-agenda')return done(Pdf.pdfAgenda(get('agenda')));
 if(action==='pdf-customer'){
   const c=get('customers').find(x=>x.id===id);
   if(!c)throw new Error('Cliente non trovato.');
   return done(Pdf.pdfCustomer(c,get('bookings'),get('payments'),get('trips')));
 }
 if(action==='pdf-rental'){
   const n=get('rentals').find(x=>x.id===id);if(!n)throw new Error('Noleggio non trovato.');
   return done(Pdf.pdfRental(n,get('rentalPayments')));
 }

 if(action==='pdf-economy')return done(Pdf.pdfEconomy(get('economy'),get('profit')));

 if(action==='pdf-all-operational')return done(Pdf.pdfOperational(get('trips'),get('bookings'),get('seats'),get('tripLayouts')));
 if(action==='pdf-quote'){
  const q=get('quotes').find(x=>x.id===id);
  if(!q)throw new Error('Preventivo non trovato.');
  return done(Pdf.pdfQuote(q));
 }
 if(action==='pdf-invoice'){
  const i=get('invoices').find(x=>x.id===id);
  if(!i)throw new Error('Bozza non trovata.');
  return done(Pdf.pdfInvoiceDraft(i));
 }
 if(action==='export-quotes'){
  const q=get('quotes');
  return csvExport(['Numero','Nome','Cognome','Destinazione','Data','Importo','Stato'],
   q.map(x=>[x.numero_preventivo,x.nome,x.cognome,x.destinazione,x.data_partenza,x.importo_preventivo,x.stato]),
   'delgrosso-preventivi.csv');
 }

 if(action==='pdf-fleet')return done(Pdf.pdfFleet(get('fleet').filter(x=>num(x.posti)>7)));
 if(action==='pdf-customers')return done(Pdf.pdfCustomers(get('customers')));
 if(action==='pdf-rentals')return done(Pdf.pdfRentals(get('rentals')));
 if(action==='pdf-document-inventory')return done(Pdf.pdfDocuments(get('documents')));
 if(action==='pdf-payment'){
   const p=get('payments').find(x=>x.id===id);
   if(!p)throw new Error('Movimento di pagamento non trovato.');
   const b=get('bookings').find(b=>b.id===p.prenotazione_id);
   if(!b)throw new Error('Questo movimento non è collegato a una prenotazione viaggio; usa la scheda noleggio.');
   return done(Pdf.pdfReceipt(p,b,tripBy(p.viaggio_id||b.viaggio_id)));
 }

 if(action==='open-booking-confirmation'){
   const b=get('bookings').find(x=>x.id===id);
   if(!b?.confirmation_storage_path)throw new Error('Nessuna conferma ufficiale archiviata.');
   const result=await edgeAction('dg2-booking-pdf',{action:'signed_url',bookingId:id});
   const signed=normalizeSignedStorageUrl(result.signedUrl);
   displayModal('Conferma originale','<p class="help">File già archiviato in Supabase: non viene rigenerato.</p><div class="action-row"><a href="'+esc(signed)+'" target="_blank" rel="noopener noreferrer" class="primary">Apri PDF originale ↗</a></div>');
   return;
 }

 if(action==='open-rental-receipt'){
  const p=get('rentalPayments').find(x=>x.id===id);
  if(!p?.receipt_professional_path && !p?.receipt_path)throw new Error('Ricevuta noleggio non archiviata.');
  const signed=await signedReceiptPath('ricevute-prenotazioni',p.receipt_professional_path||p.receipt_path);
  displayModal('Ricevuta originale noleggio','<p class="help">Documento storico dell’archivio aziendale.</p><div class="action-row"><a href="'+esc(signed)+'" target="_blank" rel="noopener noreferrer" class="primary">Apri PDF originale ↗</a></div>');
  return;
 }
 if(action==='open-payment-receipt'||action==='open-stored-document'){
   const p=action==='open-payment-receipt'?get('payments').find(x=>x.id===id):null;
   const storagePath=p?(p.receipt_professional_path||p.receipt_storage_path):id;
   if(!storagePath)throw new Error('Nessun documento originale è archiviato per questa voce.');
   const signed=await signedReceiptPath('ricevute-prenotazioni',storagePath);
   // Richiede un secondo click in iOS: aprire un popup dopo una richiesta asincrona è bloccato.
   displayModal('Documento originale Supabase','<p class="help">Il collegamento sicuro è valido per 60 secondi e utilizza i permessi dell’operatore. Il file non viene reso pubblico.</p><div class="action-row"><a href="'+esc(signed)+'" target="_blank" rel="noopener noreferrer" class="primary">Apri documento originale ↗</a></div>');
   return;
 }


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
 if(action==='create-layout' || action==='draft-layout'){
  const saved=action==='draft-layout'?get('layoutLibrary').find(l=>l.id===id):null;
  if(!window.DG4LayoutEditor)return showMessage('Editor piantine non caricato.',true);
  displayModal(saved?'Bozza da '+saved.nome:'Editor piantina GT — bozza locale',
    '<label>Nome piantina<input id="dg4-draft-name" maxlength="100" value="'+esc(saved?.nome||'Piantina personalizzata DELGROSSO')+'"></label><div id="dg4-layout-editor"></div><div class="action-row">'+writeButton('Salva bozza Supabase','save-layout-draft')+'</div>');
  localEditor=window.DG4LayoutEditor.mount(document.getElementById('dg4-layout-editor'), saved?.configurazione||null);
  return;
 }
 if(!WRITES_ENABLED){
  return showMessage('Operazione bloccata: prima occorrono backup completo e restore di prova. Nessun dato è stato modificato.',true);
 }


 if(action==='edit-booking-info'){
  const b=get('bookings').find(x=>x.id===id);
  if(!b)throw new Error('Prenotazione non trovata.');
  if(!bookingActive(b))throw new Error('Non si possono modificare le prenotazioni annullate.');
  return displayModal('Modifica dati partecipanti · '+bookingName(b),
   '<p class="help">Questa modifica aggiorna i dati della prenotazione senza cambiare i sedili, la data, la quota o i pagamenti.</p>'+
   '<form data-save="booking-info" class="form-grid"><input name="bookingId" type="hidden" value="'+esc(b.id)+'">'+
   '<input name="expectedUpdatedAt" type="hidden" value="'+esc(b.updated_at||'')+'">'+
   '<label class="span-2">Referente / nominativo<input name="cliente" maxlength="180" required value="'+esc(b.cliente||b.cliente_nome||'')+'"></label>'+
   '<label>Telefono<input name="telefono" type="tel" maxlength="60" value="'+esc(b.telefono||'')+'"></label>'+
   '<label>Email<input name="email" type="email" maxlength="180" value="'+esc(b.email||'')+'"></label>'+
   '<label class="span-2">Fermata di salita<input name="fermata" maxlength="140" required value="'+esc(b.fermata_partenza||'')+'"></label>'+
   '<label class="span-2">Note<textarea name="note" maxlength="2000">'+esc(b.note||'')+'</textarea></label>'+
   '<button type="submit" class="primary span-2">Salva dati partecipanti</button></form>');
 }

 if(action==='create-booking'||action==='edit-booking'){
  const prior=action==='edit-booking'?get('bookings').find(b=>b.id===id):null;
  const trips=get('trips').filter(t=>!t.archiviato_at);
  const selected=prior?.viaggio_id||state.trip||trips[0]?.id||'';
  const options=trips.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(tripName(t)+' · '+dateIT(t.data_partenza)+' · '+num(t.posti_totali)+' posti')+'</option>').join('');
  const occupied=trips.map(t=>{
    const reserved=occupancy(t,get('bookings'),get('seats'));
    return t.id===selected?reserved.map.size:0;
  });
  return displayModal(prior?'Modifica prenotazione':'Nuova prenotazione con posti',
   '<form data-save="booking" class="form-grid"><input type="hidden" name="bookingId" value="'+esc(prior?.id||'')+'">'+
   '<label class="span-2">Viaggio<select name="viaggio" required>'+options+'</select></label>'+
   '<p class="help span-2">Le selezioni sono validate dal server e rispettano i posti già occupati. Indicare la stessa quantità di numeri e passeggeri.</p>'+
   '<label class="span-2">Cliente / referente<input name="cliente" maxlength="180" required value="'+esc(prior?.cliente_nome||prior?.cliente||'')+'"></label>'+
   '<label>Telefono<input name="telefono" type="tel" maxlength="60" value="'+esc(prior?.telefono||'')+'"></label>'+
   '<label>Email<input name="email" type="email" maxlength="180" value="'+esc(prior?.email||'')+'"></label>'+
   '<label>Fermata di partenza<input name="fermata" maxlength="140" required value="'+esc(prior?.fermata_partenza||'')+'"></label>'+
   '<label>Numero passeggeri<input name="posti" type="number" min="1" max="99" required value="'+num(prior?.posti||1)+'"></label>'+
   '<label>Numeri sedili (es. 1, 2)<input name="sedili" required maxlength="350" value="'+esc(prior?.posti_selezionati||'')+'"></label>'+
   '<label>Importo totale €<input name="totale" type="number" min="0" step=".01" required value="'+num(prior?.totale||0)+'"></label>'+
   '<p class="help span-2">Stato: '+esc(prior?.stato||'In attesa acconto')+'. I pagamenti e lo stato economico vengono aggiornati dal registro incassi, non modificando manualmente la prenotazione.</p>'+
   '<label class="span-2">Note<textarea name="note">'+esc(prior?.note||'')+'</textarea></label>'+
   '<button type="submit" class="primary span-2">Verifica disponibilità e salva in Supabase</button></form>');
 }
 if(action==='create-customer'){
  return displayModal('Nuova scheda cliente','<form data-save="customer" class="form-grid">'+
   '<label>Nome<input name="nome" required maxlength="100"></label>'+
   '<label>Cognome<input name="cognome" required maxlength="100"></label>'+
   '<label>Telefono<input name="telefono" type="tel" maxlength="60"></label>'+
   '<label>Email<input name="email" type="email" maxlength="180"></label>'+
   '<label>Città<input name="citta" maxlength="90"></label>'+
   '<button type="submit" class="primary span-2">Crea anagrafica Supabase</button></form>');
 }
 if(action==='create-rental'){
  return displayModal('Nuovo noleggio autobus','<form data-save="rental" class="form-grid">'+
   '<label>Referente<input name="referente" required maxlength="120"></label>'+
   '<label>Azienda<input name="azienda" maxlength="150"></label>'+
   '<label>Telefono<input name="telefono" type="tel" maxlength="60"></label>'+
   '<label>Email<input name="email" type="email" maxlength="150"></label>'+
   '<label>Partenza da<input name="partenza" required maxlength="150"></label>'+
   '<label>Destinazione<input name="destinazione" required maxlength="150"></label>'+
   '<label>Data partenza<input name="data" type="date" required></label>'+
   '<label>Ora partenza<input name="ora" type="time"></label>'+
   '<label>Passeggeri<input name="pax" min="1" max="100" type="number" required></label>'+
   '<label>Prezzo concordato €<input name="prezzo" type="number" min="0" step=".01" required></label>'+
   '<button type="submit" class="primary span-2">Registra noleggio</button></form>');
 }
 if(action==='create-quote'){
  return displayModal('Nuovo preventivo','<form data-save="quote" class="form-grid">'+
   '<label>Nome richiedente<input name="nome" required maxlength="100"></label>'+
   '<label>Cognome<input name="cognome" maxlength="100"></label>'+
   '<label>Telefono<input name="telefono" required type="tel" maxlength="60"></label>'+
   '<label>Email<input name="email" type="email" maxlength="180"></label>'+
   '<label>Partenza da<input name="partenza" required maxlength="150"></label>'+
   '<label>Destinazione<input name="destinazione" required maxlength="150"></label>'+
   '<label>Data viaggio<input name="data" type="date" required></label>'+
   '<label>Passeggeri<input name="pax" type="number" min="1" max="100" value="40" required></label>'+
   '<label>Quota preventivata €<input name="importo" type="number" min="0" step=".01"></label>'+
   '<label>Tipo servizio<select name="servizio"><option>Noleggio GT</option><option>Viaggio organizzato</option><option>Limousine Bus</option></select></label>'+
   '<button type="submit" class="primary span-2">Registra preventivo</button></form>');
 }
 if(action==='create-waitlist'){
  const options=get('trips').filter(t=>!t.archiviato_at).map(t=>'<option value="'+esc(t.id)+'">'+esc(tripName(t)+' · '+dateIT(t.data_partenza))+'</option>').join('');
  return displayModal('Nuova richiesta in lista d’attesa','<form data-save="waitlist" class="form-grid">'+
   '<label class="span-2">Viaggio<select name="viaggio" required>'+options+'</select></label>'+
   '<label>Nome<input name="nome" required maxlength="100"></label>'+
   '<label>Cognome<input name="cognome" maxlength="100"></label>'+
   '<label>Telefono<input name="telefono" required type="tel" maxlength="60"></label>'+
   '<label>Email<input name="email" type="email"></label>'+
   '<label>Passeggeri<input name="posti" type="number" min="1" max="99" required value="1"></label>'+
   '<label>Fermata<input name="fermata" maxlength="120"></label>'+
   '<label class="span-2">Note<textarea name="note"></textarea></label>'+
   '<button type="submit" class="primary span-2">Salva richiesta senza assegnare posti</button></form>');
 }
 if(action==='save-layout-draft'){
  if(!localEditor?.snapshot)throw new Error('Bozza piantina non disponibile.');
  const cfg=localEditor.snapshot();
  const input=document.getElementById('dg4-draft-name');
  const name=String(input?.value||cfg.name||'').trim();
  if(!name||name.length>100)throw new Error('Nome piantina obbligatorio.');
  cfg.name=name;
  const validated=await rpcRead('dg28_validate_layout_v1',{p_config:cfg,p_capacity:num(cfg.posti_totali)});
  if(!validated?.valid)throw new Error('Numerazione sedili non valida.');
  const created=await mutate('layoutLibrary','POST',{nome:name,configurazione:cfg,attivo:true,created_by:currentUser()});
  if(!Array.isArray(created)||!created[0]?.id)throw new Error('Salvataggio non confermato, verificare la libreria prima di riprovare.');
  closeModal();showMessage('Bozza piantina salvata: '+name+'. Per applicarla al viaggio usare la funzione dedicata.');
  return navigate('layouts',true);
 }
 if(action==='publish-trip-layout'){
  const layout=get('layoutLibrary').find(l=>l.id===id);
  if(!layout)throw new Error('Piantina non trovata.');
  const options=get('trips').filter(t=>!t.archiviato_at&&t.autobus_id).map(t=>'<option value="'+esc(t.id)+'">'+esc(tripName(t)+' · '+dateIT(t.data_partenza)+' · '+num(t.posti_totali)+' posti')+'</option>').join('');
  return displayModal('Pubblica piantina ufficiale: '+layout.nome,
   '<div class="alert">Attenzione: la pubblicazione aggiornerà la piantina usata anche dal sito delle prenotazioni. Verificare posti già prenotati e capienza prima di confermare.</div>'+
   '<form data-save="publish-layout" class="form-grid"><input type="hidden" name="layout" value="'+esc(id)+'">'+
   '<label class="span-2">Viaggio da aggiornare<select name="viaggio" required>'+options+'</select></label>'+
   '<button type="submit" class="primary span-2">Verifica e pubblica in Supabase</button></form>');
 }
 if(action==='cancel-booking'){
  const b=get('bookings').find(x=>x.id===id);
  if(!b)throw new Error('Prenotazione non disponibile.');
  const paid=get('payments').filter(p=>p.prenotazione_id===id).reduce((n,p)=>n+num(p.importo),0);
  if(paid>0 || num(b.pagato)>0){
   const amount=Math.max(paid,num(b.pagato));
   if(!confirm('ATTENZIONE: prenotazione con pagamenti di '+money(amount)+'. La procedura libera i sedili ma conserva storico e ricevute. È necessario gestire il rimborso separatamente. Proseguire?'))return;
  } else if(!confirm('La prenotazione non risulta pagata. Eliminare la prenotazione e liberare i posti?'))return;
  await writeRpc('dg_delete_booking',{p_booking_id:id});
  closeModal();showMessage('Prenotazione annullata/eliminata dal server. In caso di pagamenti, verificare l’importo da rimborsare.');
  return navigate('bookings',true);
 }
 if(action==='archive-trip'){
  const t=tripBy(id);
  if(!t)throw new Error('Viaggio non trovato.');
  const reserved=get('bookings').filter(b=>b.viaggio_id===id && bookingActive(b));
  if(reserved.length)throw new Error('Viaggio con prenotazioni attive: gestire prima i clienti, gli incassi e gli eventuali rimborsi.');
  if(!confirm('Archiviare questo viaggio e toglierlo dalla vendita sul sito? Lo storico rimarrà disponibile.'))return;
  await mutate('trips','PATCH',{archiviato_at:new Date().toISOString(),pubblicato:'NO'},id);
  closeModal();return navigate('trips',true);
 }
 if(action==='edit-trip'){
  const t=tripBy(id);if(!t)throw new Error('Viaggio non trovato.');
  return displayModal('Modifica viaggio '+tripName(t),'<form data-save="trip-edit" class="form-grid">'+
   '<input type="hidden" name="tripId" value="'+esc(t.id)+'">'+
   '<label>Nome viaggio<input name="titolo" required value="'+esc(t.titolo)+'"></label>'+
   '<label>Destinazione<input name="destinazione" required value="'+esc(t.destinazione)+'"></label>'+
   '<label>Data partenza<input name="data_partenza" type="date" required value="'+esc(t.data_partenza)+'"></label>'+
   '<label>Quota €<input name="prezzo" type="number" min="0" step=".01" required value="'+num(t.prezzo)+'"></label>'+
   '<label>Capienza posti<input name="posti_totali" type="number" min="1" max="100" required value="'+num(t.posti_totali)+'"></label>'+
   '<label>Minimo partecipanti<input name="minimo_partecipanti" type="number" min="1" max="100" required value="'+num(t.minimo_partecipanti||40)+'"></label>'+
   '<label>Pubblicazione<select name="pubblicato"><option value="NO" '+(t.pubblicato!=='SI'?'selected':'')+'>Non pubblicato</option><option value="SI" '+(t.pubblicato==='SI'?'selected':'')+'>Pubblicato</option></select></label>'+
   '<button type="submit" class="primary span-2">Salva modifiche</button></form>');
 }


 if(action==='new-rental-payment'){
  const options=get('rentals').filter(n=>!n.archiviato_at).map(n=>'<option value="'+esc(n.id)+'" '+(id===n.id?'selected':'')+'>'+esc((n.azienda||n.referente||'Noleggio')+' · '+dateIT(n.data_partenza)+' · saldo '+money(n.saldo))+'</option>').join('');
  if(!options)throw new Error('Nessun noleggio attivo disponibile per il pagamento.');
  return displayModal('Registra incasso noleggio','<form data-save="rental-payment" class="form-grid">'+
   '<label class="span-2">Noleggio<select name="noleggio" required>'+options+'</select></label>'+
   '<label>Tipo<select name="tipo"><option>Acconto</option><option>Saldo</option></select></label>'+
   '<label>Importo €<input name="importo" type="number" required min=".01" step=".01"></label>'+
   '<label>Metodo<select name="metodo"><option>Contanti</option><option>Bonifico</option><option>POS</option></select></label>'+
   '<label>Data<input name="data" type="date" value="'+todayItaly()+'" required></label>'+
   '<label class="span-2">Note<textarea name="note"></textarea></label>'+
   '<button type="submit" class="primary span-2">Registra su Supabase e genera ricevuta</button></form>');
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
  return displayModal('Giroconto tra casse · Nicola ↔ Raffaele','<form class="form-grid" data-save="transfer"><label class="span-2">Destinatario<select name="recipient" required>'+opts+'</select></label><label>Importo €<input name="importo" required type="number" min=".01" step=".01"></label><label>Note<input name="note"></label><button class="primary span-2" type="submit">Conferma giroconto</button></form>');
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
function pdfBytesAsBase64(bytes){
 if(!(bytes instanceof Uint8Array))throw new Error('PDF non disponibile.');
 const sections=[];
 for(let i=0;i<bytes.length;i+=8000)sections.push(String.fromCharCode(...bytes.subarray(i,i+8000)));
 return btoa(sections.join(''));
}
async function handleSubmit(form){
 const type=form.dataset.save;
 // Il sopralluogo ai posti e l'anteprima del cambio data sono letture; restano disponibili
 // anche quando il gestionale è bloccato per le scritture.

 if(type==='bis-preview'){
  if(!bisWizard)throw new Error('Selezione BUS BIS non disponibile.');
  if(String(new FormData(form).get('sourceTripId'))!==bisWizard.sourceId)
   throw new Error('Viaggio non coerente con il modulo.');
  reviewBisWizard();return;
 }
 if(type==='transfer-preview'){
  const plan=reviewTransferForSubmission(form);
  if(plan.kind==='date'){
   const preview=await rpcRead('dg3_preview_spostamento_data_v1',{
    p_booking_id:plan.id,p_target_trip_id:plan.targetTripId
   });
   if(!preview?.success || preview.source_trip_id!==plan.sourceTripId ||
     preview.target_trip_id!==plan.targetTripId || Number(preview.passengers)!==plan.persons)
    throw new Error('L’anteprima del server non coincide con il viaggio scelto.');
   if(Number(preview.amount_paid)!==plan.paid || Number(preview.amount_total)!==plan.total)
    throw new Error('Gli importi sono stati aggiornati: ricontrollare la prenotazione.');
   showTransferPreview(plan,preview);
   return;
  }
  showTransferPreview(plan);
  return;
 }
 if(!WRITES_ENABLED)throw new Error('Scritture sospese fino a backup completo verificato.');
 const f=new FormData(form);
 const s=n=>String(f.get(n)||'').trim();
 const numeric=(key,{min=0,max=1000000}={})=>{
  const x=Number(s(key));
  if(!Number.isFinite(x)||x<min||x>max)throw new Error('Valore non valido: '+key);
  return Math.round(x*100)/100;
 };
 let success='Operazione registrata e lettura aggiornata.';
 if(type==='payment'){
  const amount=numeric('importo',{min:.01});
  if(!confirm('Confermare l incasso di '+money(amount)+'? Non ripetere l invio se la risposta non arriva.'))return;
  const saved=await writeRpc('dg_register_payment',{
   p_booking_id:s('booking'),p_tipo:s('tipo'),p_importo:amount,
   p_metodo:s('metodo'),p_data:s('data'),p_note:s('note')
  });
  if(!saved?.payment_id)throw new Error('Incasso non confermato. Verificare il registro prima di riprovare.');
  success='Incasso '+money(amount)+' registrato su Supabase · N. '+String(saved.receipt_number||saved.payment_id).slice(0,100)+'.';
  try{
   const receipt=await edgeAction('professional-receipts',{action:'generate',kind:'trip',id:saved.payment_id,reissue:false});
   success+=' Ricevuta professionale archiviata'+(receipt.receiptNumber?' · '+receipt.receiptNumber:'')+'.';
  }catch(e){success+=' ATTENZIONE: incasso registrato ma PDF non confermato ('+String(e.message||e)+'). NON registrare di nuovo il pagamento.';}

 } else if(type==='rental-payment'){
  const amount=numeric('importo',{min:.01});
  if(!confirm('Confermare il pagamento noleggio di '+money(amount)+'? Non ripetere l invio in caso di timeout.'))return;
  const saved=await writeRpc('dg_register_rental_payment',{
   p_noleggio_id:s('noleggio'),p_tipo:s('tipo'),p_importo:amount,
   p_metodo:s('metodo'),p_data:s('data'),p_note:s('note')
  });
  if(!saved?.payment_id)throw new Error('Pagamento noleggio non confermato: verificare il registro prima di ritentare.');
  success='Incasso noleggio '+money(amount)+' registrato · N. '+String(saved.receipt_number||saved.payment_id)+'.';
  try{
   const receipt=await edgeAction('professional-receipts',{action:'generate',kind:'rental',id:saved.payment_id,reissue:false});
   success+=' Ricevuta professionale archiviata'+(receipt.receiptNumber?' · '+receipt.receiptNumber:'')+'.';
  }catch(e){success+=' ATTENZIONE: pagamento registrato ma ricevuta non archiviata ('+String(e.message||e)+'). NON ripetere l incasso.';}

 } else if(type==='booking-info'){
  const bookingId=s('bookingId'),before=get('bookings').find(b=>b.id===bookingId);
  if(!before||!bookingActive(before))throw new Error('Prenotazione non valida.');
  if(!s('cliente')||!s('fermata'))throw new Error('Nominativo e fermata obbligatori.');
  if(!s('expectedUpdatedAt'))throw new Error('Versione prenotazione non disponibile: aggiorna la pagina.');
  const updated=await mutate('bookings','PATCH',{
   cliente:s('cliente'),telefono:s('telefono'),email:s('email'),fermata_partenza:s('fermata'),note:s('note')
  },bookingId,{expectedUpdatedAt:s('expectedUpdatedAt')});
  if(!Array.isArray(updated)||updated.length!==1||updated[0].id!==bookingId)
   throw new Error('Un altro operatore ha aggiornato la prenotazione: nessun dato sovrascritto. Riapri la scheda aggiornata.');
  success='Dati partecipanti aggiornati. Posti, incassi e date invariati.';
 } else if(type==='booking'){
  const prior=s('bookingId')?get('bookings').find(x=>x.id===s('bookingId')):null;
  const t=tripBy(s('viaggio'));
  if(!t || t.archiviato_at)throw new Error('Viaggio non disponibile.');
  if(prior&&prior.viaggio_id!==t.id)throw new Error('Lo spostamento tra date usa la funzione dedicata.');
  const passengers=numeric('posti',{min:1,max:99});
  if(!Number.isInteger(passengers))throw new Error('Numero passeggeri intero obbligatorio.');
  const seats=[...new Set(s('sedili').split(/[,;\s]+/).filter(Boolean))];
  if(seats.length!==passengers || seats.some(x=>!/^[1-9][0-9]{0,3}$/.test(x)||Number(x)>num(t.posti_totali)))
   throw new Error('Seleziona esattamente '+passengers+' posti validi per il viaggio.');
  if(!s('cliente')||!s('fermata'))throw new Error('Cliente e fermata obbligatori.');
  const total=numeric('totale',{min:0,max:100000});
  if(prior && total<num(prior.pagato))throw new Error('Non ridurre il totale sotto la quota già pagata.');
  const bookingId=prior?.id||crypto.randomUUID();
  const data={
   viaggio_id:t.id,cliente:s('cliente'),telefono:s('telefono'),email:s('email'),
   posti:passengers,totale:total,fermata_partenza:s('fermata'),note:s('note'),
   stato:prior?.stato||'In attesa acconto',giorni_acconto:2
  };
  if(!confirm('Salvare su Supabase '+passengers+' passeggeri, posti '+seats.join(', ')+' · '+tripName(t)+'?'))return;
  const saved=await writeRpc('dg2_save_booking_guarded_v1',{p_id:bookingId,p_data:data,p_seats:seats});
  if(saved?.id!==bookingId)throw new Error('Esito prenotazione non verificato: controllare il viaggio prima di ripetere.');
  success='Prenotazione salvata con posti '+seats.join(', ')+'.';
  try{
   const bytes=Pdf.pdfEngine().makeBookingPdf(saved,t,[]);
   const doc=await edgeAction('dg2-booking-pdf',{action:'generate',bookingId:bookingId,pdfBase64:pdfBytesAsBase64(bytes)});
   if(doc?.success)success+=' Conferma PDF archiviata in Supabase.';
  }catch(e){success+=' ATTENZIONE: prenotazione registrata ma conferma PDF non archiviata ('+String(e.message||e)+'). NON duplicare la prenotazione.';}
 } else if(type==='agenda'){
  const result=await mutate('agenda','POST',{titolo:s('titolo'),data_scadenza:s('data_scadenza'),
   priorita:s('priorita'),descrizione:s('descrizione'),tipo:'operativa',stato:'aperta'});
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Salvataggio scadenza non confermato.');
 } else if(type==='trip'){
  const result=await mutate('trips','POST',{titolo:s('titolo'),destinazione:s('destinazione'),
   data_partenza:s('data_partenza'),prezzo:numeric('prezzo'),posti_totali:numeric('posti_totali',{min:1,max:100}),
   minimo_partecipanti:numeric('minimo_partecipanti',{min:1,max:100}),pubblicato:'NO',stato:'PROGRAMMATO'});
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Creazione viaggio non confermata.');
  success='Viaggio creato come NON PUBBLICATO. Controllare piantina e fermate prima della vendita.';
 } else if(type==='trip-edit'){
  const tripId=s('tripId'),old=tripBy(tripId);
  if(!old)throw new Error('Viaggio non trovato.');
  const cap=numeric('posti_totali',{min:1,max:100});
  const occupied=get('bookings').filter(b=>b.viaggio_id===tripId&&bookingActive(b)).reduce((n,b)=>n+num(b.posti),0);
  if(cap<occupied)throw new Error('Non è possibile ridurre la capienza sotto '+occupied+' passeggeri già prenotati.');
  if(!confirm('Modificare il viaggio? Se pubblicato, i dati saranno aggiornati anche sul sito.'))return;
  const result=await mutate('trips','PATCH',{
   titolo:s('titolo'),destinazione:s('destinazione'),data_partenza:s('data_partenza'),
   prezzo:numeric('prezzo'),posti_totali:cap,
   minimo_partecipanti:numeric('minimo_partecipanti',{min:1,max:100}),pubblicato:s('pubblicato')
  },tripId);
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Modifica viaggio non verificata.');
 } else if(type==='customer'){
  const result=await mutate('customers','POST',{
   nome:s('nome'),cognome:s('cognome'),telefono:s('telefono'),email:s('email'),citta:s('citta')
  });
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Nuovo cliente non confermato.');
 } else if(type==='rental'){
  const price=numeric('prezzo',{min:0,max:100000});
  const result=await mutate('rentals','POST',{
   referente:s('referente'),azienda:s('azienda'),telefono:s('telefono'),email:s('email'),
   tratta_partenza:s('partenza'),tratta_destinazione:s('destinazione'),data_partenza:s('data'),
   ora_partenza:s('ora')||null,passeggeri:numeric('pax',{min:1,max:100}),
   prezzo_concordato:price,acconto:0,saldo:price
  });
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Noleggio non confermato.');
 } else if(type==='quote'){
  const pax=numeric('pax',{min:1,max:100}),price=numeric('importo',{min:0,max:100000});
  const result=await mutate('quotes','POST',{
   nome:s('nome'),cognome:s('cognome'),telefono:s('telefono'),email:s('email'),
   origine:'gestionale_v4',stato:'Nuovo',destinazione:s('destinazione'),
   data_partenza:s('data'),luogo_partenza:s('partenza'),
   numero_passeggeri:pax,passeggeri:pax,importo:price,importo_preventivo:price,servizio:s('servizio')
  });
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Preventivo non registrato, verificare prima di ritentare.');
  success='Preventivo registrato su Supabase.';
  try{await edgeAction('professional-quotes',{action:'generate',id:result[0].id});success+=' PDF professionale archiviato.';}
  catch(e){success+=' ATTENZIONE: PDF professionale non creato ('+String(e.message||e)+'), il preventivo resta registrato.';}
 } else if(type==='waitlist'){
  const result=await mutate('waitlist','POST',{
   viaggio_id:s('viaggio'),nome:s('nome'),cognome:s('cognome'),
   telefono:s('telefono'),email:s('email'),posti:numeric('posti',{min:1,max:99}),
   stato:'In attesa',fermata_partenza:s('fermata'),note:s('note'),priorita:0
  });
  if(!Array.isArray(result)||!result[0]?.id)throw new Error('Richiesta in lista d attesa non confermata.');
  success='Richiesta salvata in lista d attesa, senza assegnare sedili.';
 } else if(type==='publish-layout'){
  const l=get('layoutLibrary').find(x=>x.id===s('layout')),t=tripBy(s('viaggio'));
  if(!l||!t)throw new Error('Viaggio o piantina non trovati.');
  if(num(l.configurazione?.posti_totali)!==num(t.posti_totali))throw new Error('Capienza piantina diversa dai '+t.posti_totali+' posti del viaggio.');
  const checked=await rpcRead('dg28_validate_layout_v1',{p_config:l.configurazione,p_capacity:num(t.posti_totali)});
  if(!checked?.valid)throw new Error('Pianta non valida sul server.');
  if(!confirm('PUBBLICARE piantina su '+tripName(t)+'? Sarà usata anche per le prenotazioni del sito, dopo la verifica dei posti già assegnati.'))return;
  const result=await writeRpc('dg28_publish_trip_layout_v1',{p_viaggio_id:t.id,p_layout_id:l.id});
  if(!result?.success)throw new Error('Pubblicazione piantina non confermata.');
  success='Piantina ufficiale pubblicata nel database per '+tripName(t)+'.';
 } else if(type==='transfer'){
  const amount=numeric('importo',{min:.01,max:100000});
  if(!confirm('Confermare il giroconto di '+money(amount)+' al destinatario selezionato?'))return;
  const saved=await writeRpc('dg_transfer_cash',{p_to_user_id:s('recipient'),p_amount:amount,p_note:s('note')});
  if(!saved?.success)throw new Error('Giroconto non confermato; controllare il registro prima di riprovare.');
 } else if(type==='move'){
  const args={p_booking_ids:[s('bookingId')],p_target_trip_id:s('targetTrip'),p_target_stop:s('stop')||null,p_preview:true};
  const preview=await writeRpc('dg_move_bookings_auto_seats_v1',args);
  if(!confirm('Anteprima spostamento:\n'+JSON.stringify(preview).slice(0,1000)+'\nConfermi lo spostamento?'))return;
  const moved=await writeRpc('dg_move_bookings_auto_seats_v1',{...args,p_preview:false});
  if(!moved?.success)throw new Error('Spostamento non confermato, verificare le prenotazioni.');
  success='Prenotazione spostata con assegnazione controllata dei posti. Rigenerare la conferma per la nuova data.';
 } else throw new Error('Modulo non ancora disponibile.');
 closeModal();
 showMessage(success);
 await navigate(page,true);
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
    startBackgroundSync();
  }catch(err){$('login-error').textContent=String(err.message||err);$('login-error').hidden=false;}
  finally{btn.disabled=false;}
 });
 $('logout').addEventListener('click',async()=>{
  stopBackgroundSync();await logout();operator=null;state.all={};ticket++;$('app').hidden=true;$('login').hidden=false;
  showMessage('Sessione terminata.');history.replaceState(null,'',location.pathname);
 });
 $('refresh').addEventListener('click',()=>navigate(page,true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&operator){liveSync?.reconnect();queueRefresh(0)}});
  window.addEventListener('online',()=>{if(operator){liveSync?.reconnect();queueRefresh(0)}});
  window.addEventListener('focus',()=>{if(operator&&backgroundPending)queueRefresh(0)});

 $('menu-toggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 $('modal-close').addEventListener('click',closeModal);
 $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
 document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-page]');if(nav){e.preventDefault();state.search='';state.stop='';state.trip='';navigate(nav.dataset.page);return;}


  const seat=e.target.closest('[data-bis-seat]');
  if(seat){
   e.preventDefault();if(seat.disabled||!bisWizard)return;
   const n=String(seat.dataset.bisSeat);
   bisWizard.selected=bisWizard.selected.includes(n)?bisWizard.selected.filter(x=>x!==n):[...bisWizard.selected,n];
   bisWizard.selected.sort((a,b)=>Number(a)-Number(b));
   renderBisWizard();return;
  }
  const choice=e.target.closest('[data-move-seat]');
  if(choice){
   e.preventDefault();
   if(choice.disabled||!transferWizard||transferWizard.mode!=='bus')return;
   const input=$('move-seat-input');if(!input)return;
   const b=get('bookings').find(x=>x.id===transferWizard.id);
   const max=Number(b?.posti||0),seat=String(choice.dataset.moveSeat);
   let selected;
   try{selected=input.value.trim()?seatNumbers(input.value):[];}
   catch{showMessage('Controlla i numeri scritti nel campo dei sedili.',true);return;}
   if(selected.includes(seat))selected=selected.filter(x=>x!==seat);
   else {
    if(selected.length>=max){showMessage('La prenotazione richiede '+max+' posti: deselezionane prima uno.',true);return;}
    selected.push(seat);
   }
   selected.sort((a,b)=>Number(a)-Number(b));
   transferWizard.chosen=selected;
   input.value=selected.join(', ');
   $('modal-content').querySelectorAll('[data-move-seat]').forEach(btn=>{
    const picked=selected.includes(btn.dataset.moveSeat);
    btn.classList.toggle('selected',picked);btn.setAttribute('aria-pressed',String(picked));
   });
   return;
  }
  const action=e.target.closest('[data-action]');if(!action)return;
  e.preventDefault();handleAction(action.dataset.action,action.dataset.id,action).catch(err=>showMessage(String(err.message||err),true));
 });
 $('main').addEventListener('input',e=>{
  if(e.target.id==='filter-search'){state.search=e.target.value;const focus=e.target;const start=focus.selectionStart;const end=focus.selectionEnd; // no network request for local filtering
   const renderers={trips:drawTrips,bookings:drawBookings,movements:drawMovements,control:drawControl,customers:drawCustomers,rentals:drawRentals,agenda:drawAgenda};
   if(renderers[page]){$('main').innerHTML=renderers[page]();const replacement=$('filter-search');replacement?.focus();replacement?.setSelectionRange(start,end);}
  }
 });
 $('main').addEventListener('change',e=>{
  if(e.target.id==='filter-trip'){state.trip=e.target.value;state.stop='';const renderers={bookings:drawBookings,control:drawControl};if(renderers[page])$('main').innerHTML=renderers[page]();}
  if(e.target.id==='filter-stop'){state.stop=e.target.value;$('main').innerHTML=drawControl();}
  if(e.target.id==='filter-bookings-state'){state.bookingsState=e.target.value;$('main').innerHTML=drawBookings();}
 });
 $('modal-content').addEventListener('change',e=>{
  if(bisWizard){
   if(e.target.id==='bis-bus'){
    bisWizard.busId=e.target.value;bisWizard.layoutId='';bisWizard.selected=[];
    renderBisWizard();return;
   }
   if(e.target.id==='bis-layout'){
    bisWizard.layoutId=e.target.value;bisWizard.selected=[];
    renderBisWizard();return;
   }
   if(e.target.id==='bis-publish'){
    bisWizard.publish=e.target.checked;return;
   }
   if(e.target.id==='bis-seat-input'){
    const bus=get('fleet').find(x=>x.id===bisWizard.busId);
    const layout=get('layoutLibrary').find(x=>x.id===bisWizard.layoutId);
    try{
     const selected=normalizeManualSeats(e.target.value,bus?.posti);
     const report=inspectLayout(layout?.configurazione,bus?.posti);
     if(!report.valid||selected.some(n=>report.unusable.has(n)))
      throw new Error('Numero posto bloccato o piantina incompatibile.');
     bisWizard.selected=selected;renderBisWizard();
    }catch(err){showMessage(String(err.message||err),true);}
    return;
   }
  }
  if(!transferWizard)return;
  if(e.target.id==='move-mode'){
   transferWizard.mode=e.target.value==='date'?'date':'bus';
   transferWizard.targetId='';transferWizard.chosen=[];
   renderTransferWizard();return;
  }
  if(e.target.id==='move-target'){
   transferWizard.targetId=e.target.value;
   const current=get('bookings').find(x=>x.id===transferWizard.id);
   transferWizard.chosen=e.target.value===current?.viaggio_id?seatsOf(current):[];
   renderTransferWizard();return;
  }
  if(e.target.id==='move-seat-input'){
   try{transferWizard.chosen=e.target.value.trim()?seatNumbers(e.target.value):[];}catch{}
  }
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
   startBackgroundSync();
 }
}
bootstrap().catch(err=>{const node=$('login-error');node.hidden=false;node.textContent='Inizializzazione non riuscita: '+String(err.message||err);});
