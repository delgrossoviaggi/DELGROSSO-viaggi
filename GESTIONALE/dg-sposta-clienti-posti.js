/* DELGROSSO VIAGGI · V5
 * Spostamento prenotazione su altra data con scelta di sedili ufficiali liberi.
 * Nessun write diretto client: salvataggio atomico via RPC Supabase v2.
 */
(function(){
'use strict';
const route='sposta-clienti', $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0);
const fmt=d=>String(d||'').replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,a,b,c)=>c+'/'+b+'/'+a);
const localDate=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'});
const idTrip=v=>v?.id||'';
const dest=v=>String(v?.destinazione||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const noCancel=x=>!/annull|cancel|cancell|rimbors/i.test(String(x?.stato||''));
const validTrip=v=>v && !v.archiviato_at && v.data_partenza>=localDate()&&!/annull|cancel|chius|sold\s*out/i.test(String(v.stato||''));
const seatList=x=>String(x||'').split(',').map(s=>s.trim()).filter(Boolean);
const op=(table,fields,extra={})=>new URLSearchParams({select:fields,...extra}).toString();
let data=null,sourceId='',bookingId='',targetId='',selected=new Set(),preview=null,requestId=0,busy=false,notification='';
async function read(table,fields){
 const out=[],size=400;for(let off=0;off<8000;off+=size){
  const r=await window.api(table,op(table,fields,{limit:String(size),offset:String(off)}),{noCache:true,timeout:18000});
  if(!Array.isArray(r))throw Error('Dati non disponibili: '+table);
  out.push(...r);if(r.length<size)return out;
 }throw Error('Numero dati troppo elevato: '+table);
}
const getTrip=id=>data?.trips?.find(v=>v.id===id),getBooking=id=>data?.bookings?.find(v=>v.id===id);
const tripLabel=t=>t?fmt(t.data_partenza)+' · '+(t.titolo||t.destinazione)+(Number(t.bis_numero||1)>1?' · BUS '+t.bis_numero:''):'';
function err(text){const h=$('dgm-error');if(h)h.textContent=String(text||'');}
function notice(text){const h=$('dgm-notice');if(h){h.textContent=String(text||'');h.hidden=!text}}
async function getData(force){
 if(data&&!force)return data;
 const sess=await window.dgSuiteGetSession();if(!sess?.user?.id)throw Error('Devi essere autenticato.');
 const [trips,bookings,occupied,tripLayouts,busLayouts]=await Promise.all([
  read('viaggi','id,titolo,destinazione,data_partenza,stato,archiviato_at,posti_totali,posti_occupati,prezzo,autobus_id,bis_numero,id_viaggio'),
  read('prenotazioni','id,viaggio_id,cliente,cliente_nome,telefono,posti,posti_selezionati,stato,pagato,acconto,saldo,totale,fermata_partenza,checkin_effettuato,riserva_aziendale'),
  read('prenotazione_posti','id,prenotazione_id,viaggio_id,posto'),
  read('dg28_trip_layouts','viaggio_id,autobus_id,configurazione,versione'),
  read('dg28_bus_layouts','autobus_id,configurazione,versione')
 ]);
 data={trips,bookings,occupied,tripLayouts,busLayouts};
 return data;
}
function selectOptions(choices,current,initial){
 return '<option value="">'+escape(initial)+'</option>'+choices.map(v=>'<option value="'+escape(v.id)+'"'+(v.id===current?' selected':'')+'>'+escape(tripLabel(v))+'</option>').join('');
}
function bookingOptions(){
 const items=data.bookings.filter(b=>b.viaggio_id===sourceId && noCancel(b) && !b.checkin_effettuato && !b.riserva_aziendale)
 .sort((a,b)=>String(a.cliente_nome||a.cliente).localeCompare(String(b.cliente_nome||b.cliente),'it'));
 return '<option value="">Scegli il cliente / la prenotazione</option>'+items.map(b=>'<option value="'+escape(b.id)+'"'+(b.id===bookingId?' selected':'')+'>'+escape((b.cliente_nome||b.cliente)+' · '+b.posti+' posti · '+(b.telefono||'senza telefono'))+'</option>').join('');
}
function targetOptions(){
 const current=getTrip(sourceId);
 return data.trips.filter(v=>validTrip(v)&&sourceId&&v.id!==sourceId&&v.data_partenza!==current.data_partenza&&dest(v)===dest(current))
 .sort((a,b)=>a.data_partenza.localeCompare(b.data_partenza)||String(a.titolo).localeCompare(String(b.titolo),'it'));
}
function layoutFor(t){
 if(!t?.autobus_id)return null;
 const exact=data.tripLayouts.find(x=>x.viaggio_id===t.id&&x.autobus_id===t.autobus_id&&x.configurazione?.rows);
 if(exact)return {...exact,source:'viaggio'};
 const bus=data.busLayouts.find(x=>x.autobus_id===t.autobus_id&&x.configurazione?.rows);
 return bus?{...bus,source:'autobus'}:null;
}
function reserved(t){
 const set=new Set(), active=data.bookings.filter(b=>b.viaggio_id===t.id&&noCancel(b));
 for(const o of data.occupied.filter(o=>o.viaggio_id===t.id))set.add(String(o.posto).trim());
 for(const b of active)seatList(b.posti_selezionati).forEach(seat=>set.add(seat));
 return set;
}
function paintSeats(){
 const t=getTrip(targetId),b=getBooking(bookingId),layout=layoutFor(t);
 const out=$('dgm-layout'),details=$('dgm-details'),submit=$('dgm-submit');
 if(!t||!b||!preview||!layout){if(out)out.innerHTML='';if(details)details.textContent='';if(submit)submit.disabled=true;return}
 const occupied=reserved(t);
 const rows=layout.configurazione.rows;
 if(!Array.isArray(rows)||!rows.length){err('La piantina ufficiale non contiene file di sedili.');return}
 const max=Math.max(...rows.map(r=>Array.isArray(r.cells)?r.cells.length:0));
 let available=0;
 let html='<div class="dgm-front">FRONTE AUTOBUS · AUTISTA</div><div class="dgm-seatrows">';
 rows.forEach((r,i)=>{
  html+='<div class="dgm-seatrow" style="grid-template-columns:28px repeat('+max+',minmax(0,1fr))"><small>'+String(i+1).padStart(2,'0')+'</small>';
  for(let k=0;k<max;k++){
   const c=r.cells?.[k],type=c?.type||'empty',num=String(c?.id||'').trim();
   if(type==='seat'&&num){
    const blocked=String(c.status||'available')!=='available';
    const taken=occupied.has(num);
    if(!taken&&!blocked)available++;
    const isSelected=selected.has(num);
    html+='<button type="button" data-dgm-seat="'+escape(num)+'" class="dgm-seat '+(blocked?'blocked':taken?'taken':isSelected?'selected':'free')+'"'+(taken||blocked?' disabled':'')+' title="'+escape(taken?'Occupato':blocked?'Bloccato':'Posto '+num+' disponibile')+'">'+escape(num)+'<span>'+escape(taken?'OCCUPATO':blocked?'BLOCCATO':isSelected?'SCELTO':'LIBERO')+'</span></button>';
   }else html+='<div class="dgm-nonseat '+(type==='door'?'door':'')+'">'+escape(type==='aisle'?'CORRIDOIO':type==='door'?'PORTA':'')+'</div>';
  }
  html+='</div>';
 });
 html+='</div><div class="dgm-key"><span>🟢 Disponibile</span><span>🔵 Selezionato</span><span>🔴 Occupato</span><span>⚫ Bloccato</span></div>';
 out.innerHTML=html;
 const chosen=[...selected].sort((a,b)=>Number(a)-Number(b));
 details.innerHTML='<b>'+escape(tripLabel(t))+'</b><span>'+b.posti+' posti da assegnare · '+available+' liberi sulla piantina · '+chosen.length+'/'+b.posti+' selezionati</span><p>Scelti: '+(chosen.length?chosen.map(escape).join(', '):'nessuno')+'</p><p>Importi mantenuti: totale '+money(b.totale)+', già versato '+money(b.pagato)+'. '+(preview.price_review_required?'<strong>Attenzione: la tariffa del nuovo viaggio è differente; gli importi originali non cambieranno.</strong>':'')+'</p>';
 submit.disabled=busy||chosen.length!==b.posti;
}
async function loadSeatmap(){
 const token=++requestId;preview=null;selected.clear();paintSeats();err('');
 const b=getBooking(bookingId),t=getTrip(targetId);if(!b||!t)return;
 if(!validTrip(t))return err('Viaggio non disponibile: scegli una partenza futura attiva.');
 const layout=layoutFor(t);
 if(!layout)return err('Per questo viaggio manca la piantina ufficiale pubblicata. Prima associala all’autobus nella sezione Piantine.');
 const physical=(layout.configurazione?.rows||[]).flatMap(r=>r.cells||[]).filter(c=>c?.type==='seat').map(c=>String(c.id||''));
 if(physical.length!==Number(t.posti_totali)||new Set(physical).size!==physical.length)
 return err('Piantina non conforme alla capienza: '+physical.length+' sedili nel layout contro '+t.posti_totali+' posti del viaggio. Correggi la piantina ufficiale prima di spostare il cliente.');
 const note=$('dgm-details');if(note)note.textContent='Verifica disponibilità e pagamenti in corso...';
 try{
  const r=await window.api('rpc/dg3_preview_spostamento_data_v1','',{method:'POST',body:{p_booking_id:b.id,p_target_trip_id:t.id},noCache:true,timeout:20000});
  if(token!==requestId)return;
  if(!r?.success)throw Error('Anteprima non disponibile');
  preview=r;
  const stop=$('dgm-stop');if(stop)stop.value=b.fermata_partenza||'';
  paintSeats();
 }catch(e){if(token!==requestId)return;preview=null;paintSeats();err('Impossibile procedere: '+(e.message||String(e)))}
}
function sourceOptions(){
 return data.trips.filter(t=>!t.archiviato_at&&t.data_partenza>=localDate()&&!/annull|cancel|chius/i.test(String(t.stato||'')))
 .sort((a,b)=>a.data_partenza.localeCompare(b.data_partenza)||String(a.titolo).localeCompare(String(b.titolo),'it'));
}
function fill(){
 const trip=$('dgm-source'),book=$('dgm-booking'),target=$('dgm-target');
 if(!trip||!book||!target)return;
 trip.innerHTML=selectOptions(sourceOptions(),sourceId,'Seleziona la data di partenza attuale');
 book.innerHTML=bookingOptions();
 target.innerHTML=selectOptions(targetOptions(),targetId,'Seleziona la nuova data / BUS BIS');
 $('dgm-info').textContent=bookingId?(getBooking(bookingId)?.posti||0)+' posti da trasferire. Scegli altrettanti sedili liberi sulla piantina di destinazione.':'Scegli prima il viaggio originale e la prenotazione.';
 paintSeats();
}
function page(){
 const host=$('page-'+route);
 if(!host)return;
 host.innerHTML='<header class="dgm-title"><div><small>DELGROSSO VIAGGI · CONTROL ROOM</small><h2>Sposta cliente su altra data</h2><p>Scegli il viaggio, la prenotazione e i nuovi posti liberi direttamente sulla piantina ufficiale.</p></div><button type="button" data-dgm-action="refresh">↻ Aggiorna</button></header>'+
 '<div id="dgm-notice" class="dgm-notice" hidden></div><div id="dgm-error" class="dgm-error" aria-live="polite"></div>'+
 '<section class="dgm-panel"><h3>1 · Seleziona la prenotazione</h3><div class="dgm-filters"><label>Viaggio attuale<select id="dgm-source"></select></label><label>Cliente / Gruppo prenotato<select id="dgm-booking"></select></label><label>Nuova partenza / BUS di destinazione<select id="dgm-target"></select></label><label>Fermata di salita nella nuova data<input id="dgm-stop" placeholder="Es. San Severo · Stazione FS" maxlength="220"></label></div><p id="dgm-info" class="dgm-muted"></p></section>'+
 '<section class="dgm-panel"><h3>2 · Scegli personalmente i posti disponibili</h3><div class="dgm-seatgrid"><div id="dgm-layout"></div><aside id="dgm-details" class="dgm-details"></aside></div></section>'+
 '<section class="dgm-panel dgm-confirm"><div><h3>3 · Verifica e conferma</h3><p>Il cambio è atomico: nessun posto doppio, acconti invariati e prenotazione collegata al nuovo viaggio. La conferma del cliente dovrà essere rigenerata.</p></div><button id="dgm-submit" type="button" data-dgm-action="move" disabled>Conferma spostamento e posti</button></section>';
}
async function refresh(){
 if(busy)return;
 const host=$('page-'+route);if(!host)return;
 page();err('Caricamento prenotazioni e piantine ufficiali...');
 try{
  await getData(true);err('');
  if(!data.trips.some(t=>t.id===sourceId)){sourceId='';bookingId='';targetId=''}
  if(!data.bookings.some(b=>b.id===bookingId&&b.viaggio_id===sourceId)){bookingId='';targetId=''}
  fill();if(bookingId&&targetId)await loadSeatmap();
 }catch(e){err('Impossibile caricare i dati: '+(e.message||String(e)))}
}
async function move(){
 if(busy)return;
 const b=getBooking(bookingId),t=getTrip(targetId),layout=layoutFor(t),old=getTrip(sourceId);
 const seats=[...selected].sort((a,b)=>Number(a)-Number(b));
 if(!b||!t||!old||!layout||!preview||seats.length!==b.posti)return err('Seleziona tutti i nuovi posti.');
 if(!confirm('CONFERMI LO SPOSTAMENTO?\n'+(b.cliente_nome||b.cliente)+' ('+b.posti+' posti)\nDa '+tripLabel(old)+'\na '+tripLabel(t)+'\nPosti: '+seats.join(', ')+'\n\nGli acconti rimangono invariati. La vecchia conferma va rigenerata.'))return;
 busy=true;$('dgm-submit').disabled=true;err('Verifica finale in corso. Non chiudere la pagina...');
 try{
  // The RPC verifies the destination layout version and every seat under DB locks.
  const result=await window.api('rpc/dg3_sposta_prenotazione_posti_scelti_v2','',{
   method:'POST',body:{
    p_booking_id:b.id,p_target_trip_id:t.id,p_expected_source_trip_id:old.id,
    p_target_seats:seats,p_target_stop:($('dgm-stop')?.value||'').trim()||null,
    p_expected_layout_version:layout.versione,p_expected_layout_source:layout.source
   },noCache:true,timeout:30000
  });
  if(!result?.success||!result?.moved)throw Error('Spostamento non confermato da Supabase.');
  notification='✓ Spostamento completato: '+(b.cliente_nome||b.cliente)+' · '+tripLabel(t)+' · posti '+seats.join(', ')+'. Pagamenti conservati. Rigenera la conferma della prenotazione.';
  data=null;sourceId='';bookingId='';targetId='';selected.clear();preview=null;
  busy=false;await refresh();notice(notification);
  if(typeof window.loadAll==='function')Promise.resolve(window.loadAll(true)).catch(()=>{});
 }catch(e){busy=false;err('Spostamento NON confermato: '+(e.message||String(e))+'. Ricarica i posti e riprova.');paintSeats()}
}
function init(){
 const content=document.querySelector('main.main > .content')||document.querySelector('main .content');
 if(!content)return;
 if(!$('page-'+route)){const sec=document.createElement('section');sec.className='page dgm-page';sec.id='page-'+route;content.appendChild(sec)}
 if(typeof PAGE_META!=='undefined')PAGE_META[route]=['Sposta clienti · Scegli posti','Cambio data con assegnazione manuale sedili disponibili'];
 const previousGo=window.go;
 if(typeof previousGo==='function')window.go=function(p){const result=previousGo.apply(this,arguments);if(p===route){refresh()}return result};
 document.addEventListener('change',e=>{
  if(e.target.id==='dgm-source'){sourceId=e.target.value;bookingId='';targetId='';preview=null;selected.clear();fill();err('')}
  if(e.target.id==='dgm-booking'){bookingId=e.target.value;targetId='';preview=null;selected.clear();fill();err('')}
  if(e.target.id==='dgm-target'){targetId=e.target.value;loadSeatmap()}
 });
 document.addEventListener('click',e=>{
  const seat=e.target.closest('[data-dgm-seat]');
  if(seat&&!seat.disabled){
   const b=getBooking(bookingId),n=seat.dataset.dgmSeat;
   if(!b||!preview)return;
   if(selected.has(n))selected.delete(n);
   else if(selected.size<b.posti)selected.add(n);
   paintSeats();return;
  }
  const btn=e.target.closest('[data-dgm-action]');
  if(!btn)return;
  e.preventDefault();
  if(btn.dataset.dgmAction==='refresh')refresh();
  if(btn.dataset.dgmAction==='move')move();
 });
 if(location.hash==='#'+route)refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();