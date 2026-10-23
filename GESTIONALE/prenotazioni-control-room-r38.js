/* DELGROSSO R38 - Monitor prenotazioni BUS / BIS. Nessuna modifica allo schema dati. */
(function(){
'use strict';
const $e=id=>document.getElementById(id);
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moneyR=x=>typeof money==='function'?money(Number(x)||0):new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(x)||0);
const dateR=x=>typeof dateIT==='function'?dateIT(x):String(x||'');
const fmtTime=t=>new Date(t).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
const valid=b=>b&&!/annull|cancel|eliminat/i.test(String(b.stato||''));
const root=v=>String(v?.bis_parent_id||v?.id||'');
const group=id=>((state.viaggi||[]).filter(v=>root(v)===String(id||''))).slice().sort((a,b)=>Number(a.bis_numero||1)-Number(b.bis_numero||1));
const roots=()=>((state.viaggi||[]).filter(v=>!v.bis_parent_id&&!/annull|cancel/i.test(String(v.stato||'')))).slice().sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||'')));
const bno=v=>Number(v?.bis_numero||1);
const label=v=>'BUS '+bno(v)+(bno(v)>1?' · BIS':' · principale');
const seatsOf=b=>{const listed=(state.prenotazionePosti||[]).filter(s=>s.prenotazione_id===b.id).map(s=>String(s.posto).trim()).filter(Boolean);return [...new Set(listed.length?listed:String(b.posti_selezionati||'').split(',').map(x=>x.trim()).filter(Boolean))];};
let activeRoot='',activeBus='all',busy=false,lastOk=0,needsRefresh=false,initialSelectionDone=false,lastError='';
const hasSession=()=>typeof authSession!=='undefined'&&!!authSession;
function selectRoot(){
 const s=$e('dg38-trip');if(!s)return;
 const all=roots();const preferred=all.find(v=>String(v.id)===activeRoot);
 if(!preferred&&all.length){if(!initialSelectionDone){const now=new Date().toISOString().slice(0,10);activeRoot=(all.find(v=>String(v.data_partenza||'')>=now)||all[all.length-1]).id;initialSelectionDone=true;}else activeRoot=all[0].id;}
 s.innerHTML=all.map(v=>{const num=group(v.id).length;return `<option value="${html(v.id)}" ${v.id===activeRoot?'selected':''}>${html(v.titolo||v.destinazione||'Viaggio')} · ${dateR(v.data_partenza)} · ${num} ${num===1?'bus':'bus'}</option>`}).join('')||'<option value="">Nessun viaggio disponibile</option>';
 s.value=activeRoot||'';
}
function bookingsFor(id){return (state.prenotazioni||[]).filter(b=>b.viaggio_id===id&&valid(b));}
function tripInfo(v){
 const bs=bookingsFor(v.id),cap=Math.max(0,Number(v.posti_totali)||0);const owner=new Map(),conflicts=new Set(),orphans=new Set();let seatMissing=0;
 const byId=new Map(bs.map(b=>[String(b.id),b]));
 // Un posto registrato sul database ha priorità rispetto alla copia testuale nella prenotazione.
 (state.prenotazionePosti||[]).filter(s=>s.viaggio_id===v.id).forEach(s=>{
   const seat=String(s.posto).trim();if(!/^\d+$/.test(seat)||Number(seat)<1||Number(seat)>cap)return;
   const b=byId.get(String(s.prenotazione_id));if(!b){orphans.add(seat);return;}
   if(owner.has(seat)&&owner.get(seat).id!==b.id)conflicts.add(seat);
   owner.set(seat,b);
 });
 for(const b of bs){const values=seatsOf(b);if(!values.length){seatMissing+=Math.max(1,Number(b.posti)||1);continue;}
   // Only fall back when no explicit assignment rows exist for this booking.
   const existsRows=(state.prenotazionePosti||[]).some(s=>String(s.prenotazione_id)===String(b.id));
   if(!existsRows)for(const seat of values){if(!/^\d+$/.test(seat)||Number(seat)<1||Number(seat)>cap)continue;if(owner.has(seat)&&owner.get(seat).id!==b.id)conflicts.add(seat);else owner.set(seat,b);}
   seatMissing+=Math.max(0,(Number(b.posti)||values.length)-values.length);
 }
 const assigned=new Set([...owner.keys(),...orphans]);const pax=bs.reduce((n,b)=>n+Math.max(0,Number(b.posti)||0),0);
 const occupied=Math.min(cap,Math.max(assigned.size,pax,Number(v.posti_occupati)||0));const free=Math.max(0,cap-occupied);
 const uncertain=seatMissing>0||conflicts.size>0||assigned.size!==occupied;
 return {v,bs,cap,pax,occupied,free,owner,conflicts,orphans,seatMissing,uncertain};
}
function groupInfo(){return group(activeRoot).map(tripInfo)}
function setLive(message,color){const e=$e('dg38-live-status');if(!e)return;const dot=`<span class="dg38-dot ${color||''}"></span>`;e.innerHTML=dot+html(message);}
function totals(infos){return infos.reduce((a,x)=>({capacity:a.capacity+x.cap,occupied:a.occupied+x.occupied,free:a.free+x.free,bookings:a.bookings+x.bs.length,pax:a.pax+x.pax}),{capacity:0,occupied:0,free:0,bookings:0,pax:0});}
function metricsRender(infos){const t=totals(infos),el=$e('dg38-metrics');if(!el)return;el.innerHTML=[['Bus attivi',infos.length,''],['Posti totali',t.capacity,'blue'],['Posti occupati',t.occupied,'amber'],['Posti liberi',t.free,'green'],['Prenotazioni',t.bookings,'']].map(([a,b,c])=>`<div class="dg38-metric ${c}"><small>${a}</small><b>${b}</b></div>`).join('');}
function oneBus(i){const {v,cap,occupied,free,owner,conflicts,orphans,uncertain,seatMissing,pax,bs}=i;
 let seats='';for(let n=1;n<=cap;n+=4){for(let j=0;j<4;j++){
   const x=n+j;if(j===2)seats+='<span class="dg38-aisle" aria-hidden="true">·</span>';
   if(x>cap){seats+='<span></span>';continue;}
   const key=String(x),b=owner.get(key),alert=conflicts.has(key),orphan=orphans.has(key)&&!b;
   const c=alert?'conflict':(orphan?'orphan':b?'busy':'free'),ownerName=b?String(b.cliente||b.cliente_nome||'Cliente'):'';
   const hint=b?ownerName+' · '+String(b.fermata_partenza||'')+' · CLICCA PER CAMBIARE POSTO/BUS':(orphan?'Posto assegnato: cliente da verificare':('Posto '+x+' libero'));
   seats+=`<button type="button" class="dg38-seat ${c}" data-dg38-seat="${x}" data-dg38-trip="${html(v.id)}" ${b?`data-dg38-booking="${html(b.id)}"`:''} ${alert||orphan?'disabled':''} aria-label="${html(hint)}" title="${html(hint)}"><strong>${x}</strong><small>${alert?'Conflitto':orphan?'Verifica':b?html(ownerName.split(' ')[0]):'Libero'}</small></button>`;
 }}
 const vehicle=(state.flotta||[]).find(f=>f.id===v.autobus_id);
 const actualBus=v.autobus||[vehicle?.marca,vehicle?.modello].filter(Boolean).join(' ')||'Mezzo da assegnare';
 return `<article class="dg38-bus"><div class="dg38-bus-header"><div><h3>🚌 ${html(label(v))}</h3><small>${html(actualBus)} · ${dateR(v.data_partenza)}</small></div><span class="dg38-bus-chip">${bs.length} prenotaz.</span></div><div class="dg38-bus-body"><div class="dg38-bus-stat"><span><strong>${cap}</strong>Capienza</span><span><strong>${occupied}</strong>Occupati</span><span><strong>${free}</strong>Liberi</span></div><div class="dg38-progress"><span style="width:${cap?Math.min(100,100*occupied/cap):0}%"></span></div><div class="dg38-legend"><span><i class="dg38-swatch free"></i> Libero</span><span><i class="dg38-swatch busy"></i> Occupato</span><span><i class="dg38-swatch alert"></i> Da verificare</span></div><div class="dg38-cabina">▲ CABINA DI GUIDA</div><div class="dg38-seats" aria-label="Pianta posti ${html(label(v))}">${seats||'<div class="dg38-empty">Capienza non impostata.</div>'}</div>${uncertain?`<div class="dg38-warning">⚠️ Verificare assegnazioni: ${seatMissing} passeggeri senza posto completo; ${conflicts.size} conflitti. Per prudenza, la disponibilità conteggia anche i passeggeri non assegnati. La pianta non indica automaticamente quali posti liberi vadano riservati a loro.</div>`:''}</div><div class="dg38-bus-foot"><span style="font-size:11px;color:#627e91">${pax} passeggeri · ${owner.size} posti identificati · ${String(v.pubblicato||'').toUpperCase()==='NO'?'🔒 Sito sospeso':'Sito da verificare'}</span><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" type="button" data-dg38-new="${html(v.id)}">＋ Prenota su questo bus</button><button class="btn btn-ghost btn-sm" type="button" data-dg38-manage="${html(v.id)}">⇄ Gestisci posti e scambi</button></div></div></article>`;
}
function renderTable(infos){const tbody=$e('bookingsTable');if(!tbody)return;
 const search=String($e('bookSearch')?.value||'').trim().toLowerCase(),status=$e('bookFilter')?.value||'',bus=activeBus;
 const inGroup=new Set(infos.map(x=>x.v.id));const rows=(state.prenotazioni||[]).filter(b=>inGroup.has(b.viaggio_id)&&(!status||b.stato===status)&&(!search||[b.cliente,b.cliente_nome,b.telefono,b.email,b.codice,b.fermata_partenza,b.posti_selezionati].map(x=>String(x||'')).join(' ').toLowerCase().includes(search))&&(bus==='all'||b.viaggio_id===bus));
 const trips=new Map(infos.map(x=>[x.v.id,x.v]));
 tbody.innerHTML=rows.map(b=>{const v=trips.get(b.viaggio_id),seats=seatsOf(b).join(', ')||'Non assegnati',paid=Number(b.pagato)||0,total=Number(b.totale)||0,remaining=typeof b.saldo==='number'?b.saldo:total-paid;
 return `<tr><td><b>${html(b.cliente||b.cliente_nome||'Cliente')}</b><small>${html(b.telefono||b.email||'Nessun contatto')}</small></td><td><span class="dg38-tag">${html(label(v))}</span><small>${dateR(v?.data_partenza)}</small></td><td><b>${Number(b.posti)||0} pax</b><small>Posti: ${html(seats)}</small></td><td>${html(b.fermata_partenza||'Da definire')}</td><td><b>${moneyR(total)}</b><small>Pagato: ${moneyR(paid)}</small></td><td><b style="color:${remaining>0?'#a96814':'#14805a'}">${moneyR(remaining)}</b><small>${html(b.stato||'Non specificato')}</small></td><td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" type="button" data-dg38-open="${html(b.id)}">Apri</button> <button class="btn btn-secondary btn-sm" type="button" data-dg40-move="${html(b.id)}" data-dg40-mode="same">↔ Cambia posto</button> <button class="btn btn-primary btn-sm" type="button" data-dg40-move="${html(b.id)}" data-dg40-mode="bus">🚍 Cambia BUS</button> <button class="btn btn-ghost btn-sm" type="button" data-dg38-confirm="${html(b.id)}">🎫 Conferma</button></td></tr>`;
 }).join('')||'<tr><td colspan="7" style="padding:25px;color:#698298;text-align:center">Nessuna prenotazione per i filtri selezionati.</td></tr>';
 const count=$e('dg38-booking-count');if(count)count.textContent=`${rows.length} prenotazioni visualizzate`;
}
function renderPauseNotice(){const n=$e('dg40-urgent');if(!n)return;const rootTrip=(state.viaggi||[]).find(v=>v.id==='ed6881e1-e693-4f5e-b068-6ac976e7a813');const other=(state.viaggi||[]).find(v=>v.id==='2b3b83b1-0f4b-4f04-aae9-d29ea5d7800f');n.hidden=!(rootTrip&&other&&String(rootTrip.pubblicato||'').toUpperCase()==='NO'&&String(other.pubblicato||'').toUpperCase()==='NO');}
function render(){if(!$e('dg38-trip'))return;renderPauseNotice();selectRoot();const infos=groupInfo(),s=$e('dg38-bus');if(s){const old=activeBus;s.innerHTML='<option value="all">Tutti gli autobus</option>'+infos.map(i=>`<option value="${html(i.v.id)}">${html(label(i.v))} · ${html(i.v.autobus||'')}</option>`).join('');s.value=infos.some(i=>i.v.id===old)?old:'all';activeBus=s.value;}
 metricsRender(infos);const cards=$e('dg38-bus-cards');if(cards)cards.innerHTML=infos.map(oneBus).join('')||'<div class="dg38-empty">Seleziona un viaggio per vedere la disponibilità dei singoli autobus.</div>';
 const h=$e('dg38-trip-subtitle'),v=infos[0]?.v;if(h)h.textContent=v?`${v.titolo||v.destinazione||'Viaggio'} · ${dateR(v.data_partenza)} · ${infos.length} autobus · ${totals(infos).free} posti liberi complessivi`:'Nessun viaggio selezionato';
 renderTable(infos);
 const age=Date.now()-lastOk;if(lastOk&&age<45000)setLive('Sincronizzato alle '+fmtTime(lastOk)+' · aggiornamento ogni 15 s','ok');else if(lastError)setLive('Non verificato: '+lastError,'bad');else setLive('Disponibilità da verificare online','');
 renderModalInfo();
}
function switchTrip(id){activeRoot=String(id||'');activeBus='all';lastOk=0;lastError='';render();refresh(true);}
function switchBus(id){activeBus=id;renderTable(groupInfo());}
function beginBooking(tripId,seat){const trip=(state.viaggi||[]).find(v=>v.id===tripId);if(!trip)return toast('Autobus non trovato',false);
 openBookingModal();const sel=$e('b_trip');if(!sel)return;
 sel.value=tripId;modalSelectedSeats=[];renderSeatPicker();
 if(seat){const busy=new Set((state.prenotazionePosti||[]).filter(s=>s.viaggio_id===tripId).map(s=>String(s.posto)));if(busy.has(String(seat)))return toast('Il posto risulta occupato: aggiorna prima di prenotare.',false);toggleSeat(String(seat));}
 if($e('b_total'))$e('b_total').value=(Number(trip.prezzo)||0)*(seat?1:0);
 renderModalInfo();
}
function renderModalInfo(){const sel=$e('b_trip'),picker=$e('seatPicker');if(!sel||!picker||!$e('modal')?.classList.contains('on'))return;
 const v=(state.viaggi||[]).find(x=>x.id===sel.value);if(!v)return;
 let el=$e('dg38-modal-info');if(!el){el=document.createElement('div');el.id='dg38-modal-info';el.className='dg38-modal-overview';picker.parentElement.insertBefore(el,picker);}
 const infos=group(root(v)).map(tripInfo);el.innerHTML=`<b>🚍 Situazione autobus del viaggio</b><div class="dg38-modal-buses">${infos.map(i=>`<button type="button" data-dg38-switch="${html(i.v.id)}" ${sel.disabled?'disabled':''} class="${i.v.id===v.id?'selected':''}">${html(label(i.v))} · ${i.free} liberi / ${i.occupied} occupati</button>`).join('')}</div><small>Ogni autobus ha una propria pianta. Seleziona il bus corretto prima di assegnare posti.${infos.some(i=>i.uncertain)?' ⚠️ Alcune assegnazioni richiedono verifica.':''}</small>`;
}
function seatClick(tripId,seat,bId){if(bId){if(typeof window.dg40StartMove==='function')return window.dg40StartMove(bId,'same');openBookingModal(bId);renderModalInfo();return;}
 if(!lastOk||Date.now()-lastOk>45000){toast('Disponibilità non aggiornata: sincronizza prima di scegliere il posto.',false);refresh(true);return;}
 const info=groupInfo().find(i=>i.v.id===tripId);if(!info)return;
 if(info.owner.has(String(seat))||info.orphans.has(String(seat))||info.conflicts.has(String(seat))){toast('Il posto non è libero. Ricarica per verificare.',false);return;}
 if(info.uncertain){toast('Posti non assegnati o differenze nei conteggi: controlla la situazione prima di prenotare.',false);return;}
 beginBooking(tripId,seat);
}
async function refresh(force=false){
 if(busy){needsRefresh=true;return;}
 const pageActive=!!$e('page-prenotazioni')?.classList.contains('active');
 const selectedModal=$e('modal')?.classList.contains('on')?$e('b_trip')?.value:'';
 const modalTrip=(state.viaggi||[]).find(v=>v.id===selectedModal);
 const queryRoot=modalTrip?root(modalTrip):activeRoot;
 if(!hasSession()||!queryRoot||(!pageActive&&!modalTrip)||document.visibilityState!=='visible')return;
 busy=true;
 try{
  // Fetch the parent and all BIS buses first; a second bus opened elsewhere is visible at the next refresh.
  let siblings=[];
  try{siblings=await api('viaggi','or=(id.eq.'+queryRoot+',bis_parent_id.eq.'+queryRoot+')&select=*',{noCache:true});}
  catch(err){siblings=group(queryRoot);}
  if(!Array.isArray(siblings)||!siblings.length)throw new Error('Autobus non disponibili nel database');
  const ids=siblings.map(v=>v.id),filter='in.('+ids.join(',')+')';
  const [newBookings,newSeats]=await Promise.all([
   api('prenotazioni','viaggio_id='+filter+'&select=*',{noCache:true}),
   api('prenotazione_posti','viaggio_id='+filter+'&select=*',{noCache:true})
  ]);
  if(!Array.isArray(newBookings)||!Array.isArray(newSeats))throw new Error('dati incompleti');
  const idsSet=new Set(ids),replace=(array,rows,pred)=>array.filter(x=>!pred(x)).concat(rows);
  state.viaggi=replace(state.viaggi||[],siblings,v=>root(v)===queryRoot);
  state.prenotazioni=replace(state.prenotazioni||[],newBookings,b=>idsSet.has(b.viaggio_id));
  state.prenotazionePosti=replace(state.prenotazionePosti||[],newSeats,s=>idsSet.has(s.viaggio_id));
  lastOk=Date.now();lastError='';if(typeof markSynced==='function')markSynced();
  if(pageActive)render();else renderModalInfo();
 }catch(e){lastError=String(e?.message||'rete o permessi').slice(0,85);if(pageActive)setLive('Errore sincronizzazione. Dati non verificati.','bad');}
 finally{busy=false;if(needsRefresh){needsRefresh=false;setTimeout(()=>refresh(false),150)}}
}
function manualRefresh(){lastOk=0;lastError='';render();refresh(true);}
function onClick(e){const t=e.target.closest?.('[data-dg38-seat],[data-dg38-new],[data-dg38-open],[data-dg38-confirm],[data-dg38-manage],[data-dg38-switch],[data-dg40-move]');if(!t)return;
 if(t.hasAttribute('data-dg38-seat'))return seatClick(t.dataset.dg38Trip,t.dataset.dg38Seat,t.dataset.dg38Booking||'');
 if(t.hasAttribute('data-dg40-move'))return window.dg40StartMove?.(t.dataset.dg40Move,t.dataset.dg40Mode);
 if(t.hasAttribute('data-dg38-new'))return beginBooking(t.dataset.dg38New);
 if(t.hasAttribute('data-dg38-open'))return openBookingModal(t.dataset.dg38Open);
 if(t.hasAttribute('data-dg38-confirm'))return printConfirmation(t.dataset.dg38Confirm);
 if(t.hasAttribute('data-dg38-manage'))return typeof openMultiBusSeatManager==='function'?openMultiBusSeatManager(t.dataset.dg38Manage):go('posti');
 if(t.hasAttribute('data-dg38-switch')){const sel=$e('b_trip');if(!sel||sel.disabled)return;sel.value=t.dataset.dg38Switch;modalSelectedSeats=[];renderSeatPicker();renderModalInfo();}
}
window.dg38={render,refresh,manualRefresh,switchTrip,switchBus,beginBooking,tripInfo,groupInfo};
const previousRender=window.renderBookings;
window.renderBookings=function(){if($e('dg38-trip'))render();else if(typeof previousRender==='function')previousRender();};
// Intercetta solo l'apertura della finestra, senza modificare il salvataggio RPC.
const previousOpen=window.openBookingModal;
if(typeof previousOpen==='function')window.openBookingModal=function(...args){const out=previousOpen.apply(this,args);renderModalInfo();return out;};
document.addEventListener('click',onClick);
document.addEventListener('change',e=>{if(e.target?.id==='b_trip')setTimeout(renderModalInfo,0)});
document.addEventListener('DOMContentLoaded',render);
setInterval(()=>{if($e('page-prenotazioni')?.classList.contains('active'))refresh();else if($e('modal')?.classList.contains('on')&&$e('b_trip'))refresh();},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&$e('page-prenotazioni')?.classList.contains('active'))refresh(true)});
// La prima apertura pagina avvia il refresh senza fermare altre pagine.
document.addEventListener('click',e=>{if(e.target.closest?.('[data-page="prenotazioni"]'))setTimeout(()=>refresh(true),200)});
})();
