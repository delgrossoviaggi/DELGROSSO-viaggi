/* DELGROSSO 3.0 Ultimate v2.6 — Annullamenti protetti e rimborsi da effettuare.
   Nessun incasso o rimborso viene creato automaticamente.
   Le RPC fanno da sorgente di verità e sono transazionali e sottoposte a permessi.
*/
'use strict';
(function(){
 const E=x=>esc(x??'');
 const stamp=x=>!x?'—':new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(x));
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const refundRoute='refunds';
 NAV[1][1].splice(3,0,[refundRoute,'⚠','Rimborsi in allarme']);
 const previousTrips=renders.trips;
 renders.trips=async function(){
  const html=await previousTrips();
  if(isDemo())return html;
  return html.replace(/(<button\b[^>]*data-dg23-action="edit-assignment"[^>]*data-dg23-id="([0-9a-f-]{36})"[^>]*>[\s\S]*?<\/button>)/gi,
   (matched,button,id)=>button+` <button class="btn-secondary dg26-trip-cancel" type="button" data-dg26-cancel-trip="${E(id)}">⚠ Annulla viaggio e prenotazioni</button>`);
 };
 const emptyRefunds=[];
 let refundFilter='pending';
 function filteredRefunds(rows){return rows.filter(x=>refundFilter==='all'||(refundFilter==='pending'?Number(x.rimborso_residuo)>0:Number(x.rimborso_residuo)<=0));}
 function summary(rows){const pending=rows.filter(x=>Number(x.rimborso_residuo)>0);
  return `<div class="metric-belt" style="margin-bottom:16px"><div class="mini-metric"><strong>${pending.length}</strong><span>Rimborsi da eseguire</span></div><div class="mini-metric"><strong>${euro(pending.reduce((n,x)=>n+Number(x.rimborso_residuo||0),0))}</strong><span>Quote ancora da restituire</span></div><div class="mini-metric"><strong>${rows.length}</strong><span>Prenotazioni cancellate registrate</span></div></div>`;
 }
 function refundTable(rows){return table(rows,[
  ['ANNULLAMENTO',x=>E(stamp(x.created_at))],
  ['CLIENTE',x=>`<strong>${E(x.cliente||'—')}</strong><div class="small-note">${E(x.telefono||'')}</div>`],
  ['VIAGGIO',x=>`<strong>${E(x.titolo_viaggio||'—')}</strong><div class="small-note">${E(fmtDate(x.data_viaggio))}</div>`],
  ['INCASSATO',x=>euro(x.importo_da_restituire)],
  ['GIÀ RIMBORSATO',x=>euro(x.rimborsi_registrati)],
  ['DA RESTITUIRE',x=>Number(x.rimborso_residuo)>0?`<strong style="color:#b42318">${euro(x.rimborso_residuo)}</strong>`:'—'],
  ['STATO',x=>Number(x.rimborso_residuo)>0?'<span class="chip warn">⚠ DA RIMBORSARE</span>':status(x.stato_rimborso)],
  ['AZIONE',x=>Number(x.rimborso_residuo)>0 && x.prenotazione_id&&!isDemo()?`<button class="btn-secondary" type="button" data-dg26-refund="${E(x.id)}">Registra rimborso fatto</button>`:'—']
 ]);}
 async function refundsPage(){
  let rows=[];let error='';
  if(!isDemo())try{rows=await data('refundCases');}catch(e){error=e.message;}
  rows=[...rows].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const list=filteredRefunds(rows);
  return sec('Rimborsi in allarme','Annullamenti di prenotazioni e viaggi; quote versate da restituire ai clienti.')+
   (error?cardInfo('Impossibile leggere il registro rimborsi: '+error,'warn'):'')+
   (isDemo()?cardInfo('Anteprima senza dati finanziari reali. Accedi con Nicola o Raffaele.','info'):'')+
   summary(rows)+
   `<div class="action-row"><label class="field"><span>Visualizza</span><select id="dg26-refund-filter"><option value="pending" ${refundFilter==='pending'?'selected':''}>Solo rimborsi in sospeso</option><option value="all" ${refundFilter==='all'?'selected':''}>Tutto lo storico annullamenti</option><option value="settled" ${refundFilter==='settled'?'selected':''}>Senza rimborsi pendenti</option></select></label><button class="btn-secondary" type="button" data-dg26-export="1">⇩ Esporta CSV allarmi</button><button class="btn-secondary" type="button" data-dg26-refresh="1">↻ Aggiorna dal database</button><button class="btn-secondary" type="button" data-go="bookings">← Prenotazioni</button></div>`+
   `<div id="dg26-refund-list">${mainPanel('Registro cancellazioni e rimborsi',refundTable(list))}</div>`+
   cardInfo('Allarme aperto finché il rimborso NON risulta registrato fra i pagamenti. Annullare una prenotazione NON trasferisce denaro al cliente. Le ricevute e i movimenti originari restano conservati.','warn');
 }
 renders.refunds=refundsPage;
 // Allarme finanziario visibile anche all'accesso nella dashboard.
 const originalDashboard=renders.dashboard;
 renders.dashboard=async function(){
  const html=await originalDashboard();
  if(isDemo())return html;
  try{
   const cases=await data('refundCases');
   const pending=cases.filter(x=>Number(x.rimborso_residuo)>0);
   if(!pending.length)return html;
   const total=pending.reduce((n,x)=>n+Number(x.rimborso_residuo||0),0);
   return `<div class="alert warn"><strong>⚠ ${pending.length} rimborsi da effettuare — ${euro(total)}</strong> · Dopo gli annullamenti di prenotazioni o viaggi, verifica le quote da restituire. <button type="button" class="btn-secondary" data-go="refunds">Apri allarmi rimborsi</button></div>`+html;
  }catch{return html;}
 };
 async function cancelModal(type,id){
  requireLive();if(!UUID.test(id))throw Error('Identificativo non valido');
  const trip=type==='trip',input=trip?{p_booking_id:null,p_viaggio_id:id}:{p_booking_id:id,p_viaggio_id:null};
  const preview=await DGData.rpc('dg26_anteprima_cancellazione_v1',input);
  if(!preview||!Number.isFinite(Number(preview.prenotazioni_da_annullare)))throw Error('Anteprima Supabase non disponibile');
  if(!Number(preview.prenotazioni_da_annullare)&&!trip)throw Error('La prenotazione risulta già annullata o rimossa');
  const tag=trip?'ANNULLA VIAGGIO':'ELIMINA PRENOTAZIONE';
  modal(trip?'Annulla viaggio e gestisci prenotazioni':'Elimina / annulla prenotazione',
   `<form id="dg26-cancellation-form" data-kind="${trip?'trip':'booking'}" data-id="${E(id)}">
    <p><strong>${Number(preview.prenotazioni_da_annullare)} prenotazioni</strong> saranno gestite in un’unica operazione.</p>
    <div class="metric-belt"><div class="mini-metric"><strong>${Number(preview.con_pagamento||0)}</strong><span>Con somme incassate</span></div><div class="mini-metric"><strong>${Number(preview.senza_pagamento||0)}</strong><span>Senza pagamenti</span></div><div class="mini-metric"><strong>${euro(preview.quote_da_rimborsare)}</strong><span>Quote da restituire</span></div></div>
    <div class="alert warn">I pagamenti registrati NON saranno eliminati. Le somme incassate genereranno allarmi da rimborsare. Le prenotazioni senza pagamenti verranno eliminate solo quando non esistono documenti o altri riferimenti da conservare; altrimenti verranno annullate e nascoste dall’elenco operativo.${trip?' Il viaggio sarà annullato, archiviato e nascosto dal sito; i clienti andranno avvisati.':''}</div>
    <label class="field"><span>Motivo della cancellazione (obbligatorio)</span><textarea name="motivo" required minlength="8" maxlength="1000" rows="3" placeholder="Es. Viaggio annullato dall’organizzazione"></textarea></label>
    <label class="field"><span>Per confermare digita esattamente <strong>${tag}</strong></span><input name="conferma" type="text" required autocomplete="off" placeholder="${tag}"></label>
    <p class="auth-error" id="dg26-error" hidden role="alert"></p>
    <div class="modal-footer"><button class="btn-secondary" type="button" data-dismiss="1">Torna indietro</button><button type="submit" class="btn btn-main">Conferma cancellazione</button></div>
   </form>`);
 }
 async function submitCancellation(form){
  requireLive();const {id,kind}=form.dataset;const v=Object.fromEntries(new FormData(form));
  const tag=kind==='trip'?'ANNULLA VIAGGIO':'ELIMINA PRENOTAZIONE';
  if(v.conferma!==tag)throw Error('Digita esattamente '+tag);
  if(String(v.motivo||'').trim().length<8)throw Error('Descrivi il motivo (almeno 8 caratteri)');
  if(!confirm('ULTIMA CONFERMA: eseguire la cancellazione? Le quote già versate NON verranno rimborsate automaticamente.'))return;
  const result=await DGData.rpc(kind==='trip'?'dg26_annulla_viaggio_e_prenotazioni_v1':'dg26_elimina_prenotazione_v1',
    kind==='trip'?{p_viaggio_id:id,p_motivo:v.motivo.trim(),p_conferma:tag}:
    {p_booking_id:id,p_motivo:v.motivo.trim(),p_conferma:tag});
  if(kind==='trip'&&result?.success!==true)throw Error('Supabase non ha confermato l’annullamento');
  if(kind==='booking'&&result?.annullata!==true)throw Error('Supabase non ha confermato la cancellazione');
  for(const k of ['bookings','trips','seatrows','refundCases','payments','notifications'])delete cache[k];
  closeModal();
  toast(kind==='trip'?`Viaggio annullato: ${Number(result.prenotazioni_con_rimborso||0)} prenotazioni con rimborso da gestire`:
   result.alert_rimborso?'Prenotazione annullata: ATTENZIONE, quota da rimborsare':'Prenotazione eliminata o annullata senza incassi');
  go(kind==='trip'?'archivedTrips':'bookings');
 }
 async function refundModal(id){
  requireLive();const rows=await DGData.rows('refundCases',{order:'created_at.desc'});
  const r=rows.find(x=>x.id===id);if(!r)throw Error('Allarme rimborso non trovato');
  if(!r.prenotazione_id||Number(r.rimborso_residuo)<=0)throw Error('Nessun rimborso aperto');
  modal('Registra rimborso realmente effettuato',`<form id="dg26-refund-form" data-id="${E(id)}" data-booking="${E(r.prenotazione_id)}" data-max="${E(r.rimborso_residuo)}">
   <p>Cliente: <strong>${E(r.cliente)}</strong></p><p>Rimborso ancora dovuto: <strong style="color:#b42318">${euro(r.rimborso_residuo)}</strong></p>
   <div class="alert warn">Non premere Salva finché i soldi non sono stati effettivamente restituiti. La procedura creerà un movimento contabile di RIMBORSO e una ricevuta.</div>
   <div class="form-grid"><label class="field"><span>Importo restituito (€)</span><input name="importo" type="number" step="0.01" min="0.01" max="${E(r.rimborso_residuo)}" value="${E(r.rimborso_residuo)}" required></label>
   <label class="field"><span>Metodo</span><select name="metodo"><option value="Contanti">Contanti</option><option value="Bonifico">Bonifico</option><option value="POS">POS</option><option value="Altro">Altro</option></select></label>
   <label class="field"><span>Data effettiva del rimborso</span><input name="data" type="date" required value="${new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Rome'}).format(new Date())}"></label></div>
   <p id="dg26-error" class="auth-error" hidden role="alert"></p>
   <div class="modal-footer"><button type="button" class="btn-secondary" data-dismiss="1">Annulla</button><button class="btn btn-main" type="submit">Registra rimborso eseguito</button></div>
  </form>`);
 }
 async function submitRefund(form){requireLive();const rowid=form.dataset.id,bookingid=form.dataset.booking,v=Object.fromEntries(new FormData(form));
  const amount=Number(v.importo),max=Number(form.dataset.max);
  if(!Number.isFinite(amount)||amount<=0||amount>max+0.0001)throw Error('Importo non valido');
  if(!confirm(`Confermi di aver già restituito ${euro(amount)} al cliente? Sarà registrato un movimento contabile di rimborso.`))return;
  const res=await DGData.registerPayment({booking_id:bookingid,type:'Rimborso',amount,method:v.metodo,date:v.data,note:'Rimborso a seguito di cancellazione prenotazione. Registro: '+rowid});
  if(!res?.payment_id)throw Error('La registrazione del rimborso non è stata confermata');
  for(const k of ['refundCases','payments','bookings','cashoperators','economy'])delete cache[k];
  closeModal();toast('Rimborso registrato in Supabase · Ricevuta '+(res.receipt_number||''));go('refunds');
 }
 function downloadRefundCSV(){requireLive();const rows=(cache.refundCases||[]).filter(x=>Number(x.rimborso_residuo)>0);
  DGData.downloadCSV([['ANNULLAMENTO','CLIENTE','TELEFONO','VIAGGIO','DATA VIAGGIO','INCASSATO EUR','GIÀ RIMBORSATO EUR','DA RESTITUIRE EUR','STATO'],...rows.map(x=>[stamp(x.created_at),x.cliente,x.telefono||'',x.titolo_viaggio,x.data_viaggio,x.importo_da_restituire,x.rimborsi_registrati,x.rimborso_residuo,x.stato_rimborso])],'DELGROSSO_RIMBORSI_DA_ESEGUIRE.csv');
 }
 document.addEventListener('click',async e=>{
  const booking=e.target.closest('[data-dg26-cancel-booking]'),trip=e.target.closest('[data-dg26-cancel-trip]'),refund=e.target.closest('[data-dg26-refund]'),ex=e.target.closest('[data-dg26-export]'),up=e.target.closest('[data-dg26-refresh]');
  if(!booking&&!trip&&!refund&&!ex&&!up)return;
  e.preventDefault();const node=booking||trip||refund||ex||up;node.disabled=true;
  try{if(booking)await cancelModal('booking',booking.dataset.dg26CancelBooking);
    else if(trip)await cancelModal('trip',trip.dataset.dg26CancelTrip);
    else if(refund)await refundModal(refund.dataset.dg26Refund);
    else if(ex)downloadRefundCSV();
    else if(up){delete cache.refundCases;await loadPage();}
  }catch(error){toast('Operazione non eseguita: '+error.message)}finally{node.disabled=false;}
 });
 document.addEventListener('change',e=>{if(e.target.id==='dg26-refund-filter'){
  refundFilter=e.target.value;delete cache.refundCases;loadPage();
 }});
 document.addEventListener('submit',async e=>{
  const f=e.target;if(!['dg26-cancellation-form','dg26-refund-form'].includes(f.id))return;
  e.preventDefault();e.stopImmediatePropagation();const btn=f.querySelector('button[type="submit"]');if(btn)btn.disabled=true;
  try{if(f.id==='dg26-cancellation-form')await submitCancellation(f);else await submitRefund(f)}catch(err){
    const holder=f.querySelector('#dg26-error');if(holder){holder.textContent=err.message;holder.hidden=false}else toast(err.message);
  }finally{if(btn)btn.disabled=false;}
 });
 window.DGCancellazioni26=Object.freeze({version:'2.6',refundTable,filteredRefunds});
})();
