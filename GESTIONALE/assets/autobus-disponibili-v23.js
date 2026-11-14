/* DELGROSSO VIAGGI 3.0 ULTIMATE v2.3 — disponibilita' autobus e BUS BIS.
   Disponibilita' verificata dal database; salvataggi con RPC transazionale.
   Non permette il Mercedes V250D nelle gite e non cambia posti prenotati. */
'use strict';
(function(global){
 const stamp='2.3';
 const safe=esc;
 const allowed=f=>!!f && f.attivo===true && !/mercedes|v250|\bvan\b|\bncc\b/i.test([f.titolo,f.modello,f.categoria,f.marca].join(' '));
 const num=x=>Number.isSafeInteger(Number(x))?Number(x):0;
 const adultDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const isUuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x||''));
 const label=f=>String(f.nome||f.titolo||f.modello||'Autobus');
 const name=f=>`${label(f)} · ${num(f.posti)} posti${f.targa?' · '+f.targa:''}`;
 let lastDate=adultDate();
 function capacityField(value=63){return formInput('Posti disponibili per la vendita (≤ capienza autobus)','posti_totali','number',{required:true,min:1,max:100,value});}
 function selectorField(){return `<label class="field dg23-fleet-field"><span>Autobus disponibile *</span><select name="autobus_id" required><option value="">Seleziona la data per vedere gli autobus...</option></select></label>`;}
 function vehicleFields(item={}, {clone=false}={}){
  return selectorField()+capacityField(num(item.posti_totali)||63).replace('name="posti_totali"','name="posti_totali" data-manually-edited="1"')+
   `<p class="small-note dg23-status" role="status">La disponibilità viene verificata da Supabase per la data scelta, inclusi BUS BIS, noleggi e blocchi flotta.</p>`;
 }
 async function availability(date,excludeTrip=null){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Seleziona una data valida');
  if(isDemo()){
   const fl=await data('fleet');
   return fl.filter(allowed).map(f=>({id:f.id,nome:f.titolo||f.modello,modello:f.modello,posti:f.posti,targa:f.targa||'',disponibile:true,motivo:'Disponibile (demo)'}));
  }
  const a=await DGData.rpc('dg3_autobus_disponibili_v23',{p_data:date,p_exclude_trip:excludeTrip||null});
  if(!Array.isArray(a))throw Error('Supabase non ha restituito un elenco autobus valido');
  return a;
 }
 function updateCapacity(form){
  const select=form?.querySelector('[name=autobus_id]');const cap=form?.querySelector('[name=posti_totali]');
  const chosen=select?.selectedOptions?.[0];if(!chosen||!cap)return;
  const fleetCap=num(chosen.dataset.capacity);if(!fleetCap)return;
  const previousCap=num(cap.value);cap.max=fleetCap;
  if(!cap.dataset.manuallyEdited||previousCap<1||previousCap>fleetCap){cap.value=fleetCap;delete cap.dataset.manuallyEdited;}
  const min=form.querySelector('[name=minimo_partecipanti]');if(min&&num(min.value)>fleetCap)min.value=fleetCap;
 }
 async function refreshVehicleForm(form,excludeTrip=null,prefer=null){
  if(!form||!document.contains(form))return;
  const date=form.querySelector('[name=data_partenza]')?.value||form.dataset.tripDate;
  const select=form.querySelector('[name=autobus_id]'),message=form.querySelector('.dg23-status');
  if(!select)return;
  if(!date){select.innerHTML='<option value="">Seleziona prima una data</option>';if(message)message.textContent='Scegli prima la data del viaggio.';return;}
  const previous=prefer||select.value;
  const seq=String((Number(form.dataset.dg23Seq)||0)+1);form.dataset.dg23Seq=seq;
  select.disabled=true;select.innerHTML='<option value="">Verifica disponibilità in corso…</option>';
  if(message)message.textContent='Controllo la disponibilità reale degli autobus nella data indicata…';
  try{
   const rows=await availability(date,excludeTrip);
   if(!document.contains(form)||form.dataset.dg23Seq!==seq)return;
   const available=rows.filter(x=>x.disponibile===true);
   select.innerHTML='<option value="">— Scegli un autobus libero —</option>'+
    rows.map(f=>`<option value="${safe(f.id)}" data-capacity="${num(f.posti)}" ${!f.disponibile?'disabled':''}>${safe(name(f))} · ${safe(f.motivo||'Disponibilità da verificare')}</option>`).join('');
   const canKeep=available.some(x=>x.id===previous);
   if(canKeep)select.value=previous;
   else if(available.length===1)select.value=available[0].id;
   else select.value='';
   select.disabled=false;
   if(message)message.textContent=`${available.length} autobus disponibili su ${rows.length} mezzi idonei · data ${date}. La scelta viene ricontrollata al salvataggio.`;
   updateCapacity(form);
  }catch(err){
   if(!document.contains(form)||form.dataset.dg23Seq!==seq)return;
   select.innerHTML='<option value="">Disponibilità non verificata</option>';select.disabled=true;
   if(message)message.textContent='Impossibile verificare Supabase: '+String(err.message||'errore')+'; il salvataggio rimane bloccato.';
  }
 }
 async function verifyLocalChoice(form,excludeTrip=null){
  const dataF=form.querySelector('[name=data_partenza]')?.value||form.dataset.tripDate;
  const busId=form.querySelector('[name=autobus_id]')?.value||'';
  const cap=num(form.querySelector('[name=posti_totali]')?.value);
  if(!busId)throw Error('Seleziona un autobus disponibile');
  const avail=await availability(dataF,excludeTrip);
  const f=avail.find(x=>x.id===busId);
  if(!f?.disponibile)throw Error('L’autobus non è più disponibile per quella data. Ricarica la disponibilità.');
  if(cap<1||cap>num(f.posti))throw Error('I posti vendibili devono essere compresi fra 1 e '+f.posti);
  const min=form.querySelector('[name=minimo_partecipanti]');
  if(min&&(num(min.value)<1||num(min.value)>cap))throw Error('Il minimo partecipanti deve essere compreso fra 1 e '+cap);
  return f;
 }
 async function openNewTrip(){
  requireLive();
  modal('Nuovo viaggio · scegli autobus disponibile',modelForm('trip',
   formInput('Titolo viaggio','titolo','text',{required:true})+
   formInput('Destinazione','destinazione','text',{required:true})+
   formInput('Data partenza','data_partenza','date',{required:true,value:adultDate()})+
   formInput('Ora partenza','ora_partenza','time',{required:true,value:'06:00'})+
   formInput('Partenza / fermata principale','luogo_partenza','text')+
   formInput('Prezzo a persona (€)','prezzo','number',{required:true,min:0,step:'0.01'})+
   vehicleFields({posti_totali:63})+
   formInput('Minimo partecipanti','minimo_partecipanti','number',{required:true,min:1,max:100,value:40})+
   formInput('Descrizione','descrizione','text'),
   'Crea viaggio e assegna autobus'));
  await refreshVehicleForm(document.querySelector('#dg-form[data-operation=trip]'));
 }
 async function saveNewTrip(values){
  if(!values?.autobus_id)throw Error('Seleziona un autobus');
  const form=document.querySelector('#dg-form[data-operation=trip]');
  if(!form)throw Error('Modulo viaggio non disponibile');
  await verifyLocalChoice(form);
  const res=await DGData.rpc('dg3_viaggi_autobus_v23',{
   p_azione:'nuovo',p_viaggio_id:null,p_autobus_id:values.autobus_id,p_dati:values
  });
  if(res?.success!==true||res.autobus_id!==values.autobus_id)throw Error('Autobus non confermato dal database');
  return res;
 }
 async function openBusBis(id){
  requireLive();if(!isUuid(id))throw Error('Riferimento viaggio non valido');
  const trips=await data('trips'),t=trips.find(x=>x.id===id);
  if(!t||t.archiviato_at||t.bis_parent_id||/annull|chius/i.test(t.stato||''))throw Error('Viaggio principale non idoneo a un BUS BIS');
  modal('Aggiungi BUS BIS · '+(t.titolo||t.destinazione),`<form id="dg23-bis-form" data-parent="${safe(t.id)}" data-trip-date="${safe(t.data_partenza)}">
    <p><strong>Viaggio:</strong> ${safe(t.titolo||t.destinazione)} · ${safe(fmtDate(t.data_partenza))}</p>
    <p>Ogni BUS BIS avrà la propria piantina e la propria capienza. Non modifica i posti del primo autobus.</p>
    <div class="form-grid">${selectorField()}${capacityField(63)}</div>
    <p class="small-note dg23-status">Sto cercando gli autobus disponibili nella stessa data…</p>
    <p id="dg23-bis-error" class="auth-error" role="alert" hidden></p>
    ${actFooter('Aggiungi BUS BIS')}</form>`);
  await refreshVehicleForm(document.getElementById('dg23-bis-form'));
 }
 async function saveBusBis(form){
  requireLive();const parentId=form.dataset.parent;
  if(!isUuid(parentId))throw Error('Viaggio principale non valido');
  const rows=await data('trips');const parent=rows.find(x=>x.id===parentId);
  if(!parent||parent.archiviato_at)throw Error('Viaggio principale non disponibile');
  await verifyLocalChoice(form);
  const busId=form.querySelector('[name=autobus_id]').value;
  const capacity=num(form.querySelector('[name=posti_totali]').value);
  if(!confirm(`Aggiungere un autobus BIS al viaggio ${parent.titolo||parent.destinazione} del ${parent.data_partenza}?\nAutobus: ${form.querySelector('[name=autobus_id]')?.selectedOptions?.[0]?.textContent}\nPosti vendibili: ${capacity}\nIl nuovo BUS BIS sarà creato NON pubblicato e senza prenotazioni.`))return;
  const res=await DGData.rpc('dg3_viaggi_autobus_v23',{
   p_azione:'bis',p_viaggio_id:parentId,p_autobus_id:busId,p_dati:{posti_totali:capacity}
  });
  if(res?.success!==true||res.autobus_id!==busId)throw Error('Supabase non ha confermato il BUS BIS');
  delete cache.trips;delete cache.fleet;closeModal();toast('BUS BIS aggiunto: autobus assegnato correttamente');go('trips');
 }
 const baseTrips=renders.trips;
 renders.trips=async function(){
  const html=await baseTrips();
  const date=lastDate||adultDate();
  let rows=[],error='';
  try{rows=await availability(date);}catch(e){error=String(e.message||'Verifica non disponibile');}
  const count=rows.filter(x=>x.disponibile).length;
  const panel=mainPanel('Autobus disponibili per la partenza',
   `<p class="small-note">Controlla quali mezzi GT e Limousine Bus puoi assegnare o aggiungere come BUS BIS. Non comprende il Mercedes V250D.</p>
   <div class="dg23-availability-head"><label class="field"><span>Data di disponibilità</span><input id="dg23-available-date" type="date" value="${safe(date)}"></label>
   <span class="chip ${count?'ok':'warn'}" id="dg23-count">${count} autobus liberi</span>
   <button type="button" class="btn-secondary" id="dg23-reload">↻ Aggiorna disponibilità</button></div>
   <div id="dg23-availability-list">${error?cardInfo(error,'warn'):renderAvailable(rows)}</div>`);
  return html+panel+cardInfo('La disponibilità mostrata è riferita a un giorno. Il server controlla nuovamente assegnazioni, noleggi e blocchi flotta durante il salvataggio. Per un secondo autobus seleziona ＋ BUS BIS sul viaggio principale.','info');
 };
 function renderAvailable(rows){
  if(!rows.length)return cardInfo('Nessun autobus GT o Limousine Bus disponibile in archivio. Verifica Flotta e Supabase.','warn');
  return table(rows,[
   ['MEZZO',f=>`<strong>${safe(label(f))}</strong>${f.targa?`<div class="small-note">${safe(f.targa)}</div>`:''}`],
   ['CAPIENZA',f=>`${num(f.posti)} posti`],
   ['STATO PER LA DATA',f=>`<span class="chip ${f.disponibile?'ok':'warn'}">${safe(f.motivo||'Da verificare')}</span>`]
  ]);
 }
 async function refreshPanel(){
  const input=document.querySelector('#dg23-available-date'),list=document.querySelector('#dg23-availability-list');
  if(!input||!list)return;
  lastDate=input.value;
  const previous=lastDate;list.innerHTML='<div class="loading">Controllo autobus in corso…</div>';
  try{
   const rows=await availability(previous);
   if(!document.contains(list)||lastDate!==previous)return;
   list.innerHTML=renderAvailable(rows);
   const counter=document.querySelector('#dg23-count');if(counter)counter.textContent=`${rows.filter(x=>x.disponibile).length} autobus liberi`;
  }catch(error){if(document.contains(list))list.innerHTML=cardInfo(error.message,'warn');}
 }
 document.addEventListener('change',e=>{
  const target=e.target;
  if(target.id==='dg23-available-date'){refreshPanel();return;}
  const form=target.closest('#dg-form[data-operation=trip],#dg9-trip-form,#dg23-bis-form');
  if(!form)return;
  if(target.name==='data_partenza')refreshVehicleForm(form,form.id==='dg9-trip-form'&&form.dataset.clone!=='1'?form.dataset.id:null);
  if(target.name==='autobus_id')updateCapacity(form);
 });
 document.addEventListener('input',e=>{
  if(e.target.matches('#dg-form[data-operation=trip] [name=posti_totali],#dg9-trip-form [name=posti_totali],#dg23-bis-form [name=posti_totali]'))e.target.dataset.manuallyEdited='1';
 });
 document.addEventListener('click',e=>{
  if(e.target.closest('#dg23-reload'))refreshPanel();
 });
 document.addEventListener('submit',async e=>{
  const form=e.target;if(form.id!=='dg23-bis-form')return;
  e.preventDefault();e.stopImmediatePropagation();
  const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=true;
  try{await saveBusBis(form);}catch(error){
   const box=form.querySelector('#dg23-bis-error');if(box){box.hidden=false;box.textContent=error.message;}
   else toast(error.message);
  }finally{if(submit)submit.disabled=false;}
 });
 global.DGTripBus23=Object.freeze({version:stamp,availability,vehicleFields,refreshVehicleForm,
  verifyLocalChoice,openNewTrip,saveNewTrip,openBusBis,renderAvailable});
})(window);
