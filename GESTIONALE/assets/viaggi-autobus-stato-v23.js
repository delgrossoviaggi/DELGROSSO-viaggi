/* DELGROSSO VIAGGI 3.0 ULTIMATE v2.3
 * Assegnazione/sostituzione/rimozione bus e stato dei viaggi.
 * Backend RPC transazionale; mai cancellare pagamenti o prenotazioni.
 */
'use strict';
(function(){
 const E=x=>esc(x??'');
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const EXCLUDE_BUS=/mercedes|v250/i;
 const legitimateFleet=f=>
   (/(^|\W)GT(\W|$)|limousine|gran turismo/i.test(String(f.categoria||'')))&&
   !EXCLUDE_BUS.test([f.marca,f.modello,f.titolo].join(' '));
 const formFooter=(label)=>`<div class="modal-footer"><button type="button" class="btn-secondary" data-dismiss="1">Annulla</button><button type="submit" class="btn btn-main">${E(label)}</button></div>`;
 const infoText='Annullato: il viaggio non è pubblicato e libera l’autobus per altre date compatibili. Le prenotazioni e gli incassi restano nello storico; eventuali rimborsi e comunicazioni ai clienti vanno gestiti separatamente.';
 let currentRows=[];
 function availableCount(fleet,trip){return fleet.filter(f=>legitimateFleet(f)&&f.attivo===true&&String(f.stato).toLowerCase()==='disponibile'&&Number(f.posti)>=Number(trip.posti_totali||0)).length}
 function button(verb,id,label){return `<button type="button" class="btn-secondary" data-dg23-action="${E(verb)}" data-dg23-id="${E(id)}">${E(label)}</button>`}
 function renderFiltered(rows){
  const live=rows.filter(x=>!x.archiviato_at),bookingRows=cache.bookings||[];
  return mainPanel(`Programmazione · ${live.length} viaggi`,table(live,[
    ['DATA',v=>fmtDate(v.data_partenza)],
    ['VIAGGIO',v=>`<strong>${E(v.titolo||v.destinazione)}</strong><div class="small-note">${E(v.destinazione||'')} · ${E(v.bis_numero>1?'BUS BIS '+v.bis_numero:'BUS PRINCIPALE')}</div>`],
    ['STATO',v=>status(v.stato||'Programmato')],
    ['AUTOBUS ASSEGNATO',v=>`<strong>${E(v.autobus_id?(v.autobus||'Autobus assegnato'):'DA ASSEGNARE')}</strong><div class="small-note">Capienza piantina: ${E(v.posti_totali??0)} posti</div>`],
    ['PRENOTATI',v=>bookingRows.filter(b=>b.viaggio_id===v.id&&!/annull|cancell|cancel/i.test(b.stato||'')).reduce((s,b)=>s+Number(b.posti||0),0)],
    ['GESTIONE',v=>isDemo()?'<span class="small-note">Anteprima</span>':`<div class="action-row" style="gap:5px;margin:0;flex-wrap:wrap">${button('edit-assignment',v.id,'🚌 Autobus e stato')}<button class="btn-secondary" data-dg9-action="trip-edit" data-dg9-id="${E(v.id)}">✎ Modifica</button><button class="btn-secondary" data-dg9-action="trip-clone" data-dg9-id="${E(v.id)}">Duplica</button><button class="btn-secondary" data-dg9-action="trip-archive" data-dg9-id="${E(v.id)}">Archivia</button></div>`]
  ]));
 }
 async function pageTrips23(){
  const [trips,bookings,fleet]=await Promise.all([data('trips'),data('bookings'),data('fleet')]);
  currentRows=trips.filter(x=>!x.archiviato_at).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
  const filtered=fleet.filter(f=>legitimateFleet(f));
  return sec('Viaggi e partenze · autobus e conferme','Assegna autobus disponibili, sostituisci o rimuovi un mezzo e imposta Confermato o Annullato')+
   `<div class="action-row" style="margin-bottom:15px"><button type="button" class="btn-secondary" data-create="trip">＋ Nuovo viaggio</button><button type="button" class="btn-secondary" data-dg23-action="new-bus">＋ Registra autobus disponibile</button><button type="button" class="btn-secondary" data-go="archivedTrips">▣ Viaggi archiviati</button></div>`+
   `<div class="metric-belt" style="margin-bottom:17px"><div class="mini-metric"><strong>${currentRows.length}</strong><span>Viaggi non archiviati</span></div><div class="mini-metric"><strong>${currentRows.filter(t=>String(t.stato).toLowerCase()==='confermato').length}</strong><span>Viaggi confermati</span></div><div class="mini-metric"><strong>${currentRows.filter(t=>String(t.stato).toLowerCase()==='annullato').length}</strong><span>Viaggi annullati</span></div><div class="mini-metric"><strong>${filtered.filter(f=>f.attivo===true&&String(f.stato).toLowerCase()==='disponibile').length}</strong><span>Autobus in flotta (stato disponibile)</span></div></div>`+
   `<div class="filters"><label class="search-box">⌕ <input type="search" id="dg23-trip-search" placeholder="Cerca viaggio, data, destinazione o autobus..."></label><select id="dg23-trip-status"><option value="">Tutti gli stati</option><option value="Programmato">Programmato</option><option value="Confermato">Confermato</option><option value="Annullato">Annullato</option><option value="SOLD OUT">SOLD OUT</option></select></div>`+
   `<div id="dg23-list">${renderFiltered(currentRows)}</div>`+
   cardInfo('Disponibilità reale verificata da Supabase per la data. La rimozione del bus NON cancella il viaggio, i posti, le prenotazioni o i pagamenti: il viaggio viene tolto dalla pubblicazione finché il mezzo non è riassegnato.','info')+
   cardInfo(infoText,'warn');
 }
 renders.trips=pageTrips23;
 function getRow(id){const row=currentRows.find(x=>String(x.id)===String(id));if(!row)throw Error('Viaggio non trovato. Ricarica la pagina.');return row;}
 async function editAssignment(id){
  requireLive();if(!UUID.test(id))throw Error('Identificativo viaggio non valido');
  const row=getRow(id), result=await DGData.rpc('dg3_disponibilita_autobus_viaggio_v1',{p_viaggio_id:id});
  if(result?.viaggio_id!==id||!Array.isArray(result.autobus))throw Error('Risposta disponibilità Supabase non valida');
  // Le disponibilità possono cambiare: il backend controlla di nuovo al salvataggio.
  const choices=result.autobus;
  const options=[`<option value="">— Nessun autobus / Da assegnare —</option>`,...choices.map(b=>{
   const selected=String(row.autobus_id||'')===String(b.id);
   return `<option value="${E(b.id)}" ${selected?'selected':''} ${!b.disponibile&&!selected?'disabled':''}>${E(b.titolo)} · ${E(b.posti)} posti — ${E(b.motivo)}</option>`;
  })].join('');
  const occupied=(cache.bookings||[]).filter(x=>x.viaggio_id===id&&!/annull|cancel|cancell/i.test(x.stato||'')).reduce((n,b)=>n+Number(b.posti||0),0);
  modal('Gestisci autobus e stato · '+(row.titolo||row.destinazione),`<form id="dg23-assignment-form" data-id="${E(id)}" data-prev-state="${E(row.stato||'')}" data-prev-bus="${E(row.autobus_id||'')}">
   <p><strong>${E(row.titolo||row.destinazione)}</strong> · ${E(fmtDate(row.data_partenza))}</p>
   <div class="form-grid">
     <label class="field"><span>Stato del viaggio</span><select name="stato" required>${['Programmato','Confermato','Annullato','SOLD OUT'].map(s=>`<option value="${E(s)}" ${s===row.stato?'selected':''}>${E(s)}</option>`).join('')}</select></label>
     <label class="field"><span>Autobus (solo mezzi aziendali)</span><select name="autobus_id" id="dg23-assignment-bus">${options}</select></label>
   </div>
   <p class="small-note">Piantina del viaggio: <strong>${E(row.posti_totali)} posti</strong> · prenotati: <strong>${occupied}</strong> · autobus attuale: ${E(row.autobus||'DA ASSEGNARE')}.</p>
   <div class="alert info">Per togliere il mezzo seleziona <strong>Nessun autobus / Da assegnare</strong>. Verrà rimosso dal viaggio, non dalla flotta aziendale. Il viaggio senza autobus non sarà pubblicato.</div>
   <div class="alert warn">${E(infoText)} Il campo <strong>Confermato</strong> non invia automaticamente messaggi ai clienti e non pubblica da solo il viaggio.</div>
   <p class="small-note">Stato disponibilità aggiornato all'apertura. Se un altro operatore occupa il mezzo, la conferma verrà rifiutata e dovrai riaprire la scheda.</p>
   <p id="dg23-error" class="auth-error" hidden role="alert"></p>${formFooter('Conferma autobus e stato')}
   </form>`);
 }
 function newFleet(){requireLive();modal('Registra un autobus disponibile',`<form id="dg23-new-bus-form"><div class="form-grid">
 <label class="field"><span>Nome / identificativo autobus</span><input name="titolo" required maxlength="90" placeholder="Es. IRIZAR SCANIA GT63 C"></label>
 <label class="field"><span>Marca</span><input name="marca" required maxlength="80" placeholder="Es. IRIZAR SCANIA"></label>
 <label class="field"><span>Modello</span><input name="modello" required maxlength="80" placeholder="Es. PB"></label>
 <label class="field"><span>Categoria</span><select name="categoria"><option value="GT">Autobus GT</option><option value="Limousine Bus">Limousine Bus</option></select></label>
 <label class="field"><span>Posti effettivi omologati</span><input type="number" name="posti" required min="1" max="100" step="1"></label>
 <label class="field"><span>Targa (facoltativa)</span><input name="targa" maxlength="24" autocomplete="off"></label>
 </div><div class="alert warn">Registra solo un mezzo reale della flotta, verificando i posti omologati. Non aggiunge sedili a viaggi già prenotati e non modifica altre piantine.</div>
 <p id="dg23-error" class="auth-error" hidden role="alert"></p>${formFooter('Salva autobus nella flotta')}</form>`);}
 async function submitAssignment(form){
  requireLive();const id=form.dataset.id,old=getRow(id),values=Object.fromEntries(new FormData(form));
  const nextState=String(values.stato||'');if(!['Programmato','Confermato','Annullato','SOLD OUT'].includes(nextState))throw Error('Stato del viaggio non consentito');
  const nextBus=values.autobus_id||null;
  if(nextBus&&!UUID.test(nextBus))throw Error('Autobus non valido');
  const previousBus=form.dataset.prevBus||null,previousState=form.dataset.prevState||null;
  const changed=nextBus!==previousBus||nextState!==previousState;
  if(!changed){closeModal();toast('Nessuna modifica da salvare');return;}
  const notices=[];
  if(nextState==='Annullato')notices.push('Il viaggio verrà ANNULLATO e nascosto dal sito. Gli incassi e le prenotazioni NON saranno rimborsati automaticamente.');
  if(!nextBus)notices.push('L’autobus verrà RIMOSSO dal viaggio; il mezzo rimarrà disponibile in flotta e il viaggio verrà nascosto dal sito.');
  if(nextState==='Confermato'&&!nextBus)notices.push('Il viaggio risulterà Confermato ma senza autobus assegnato e NON pubblicato.');
  if(!confirm(`SALVARE LE MODIFICHE?\n${old.titolo||old.destinazione}\nStato: ${nextState}\nAutobus: ${nextBus?'assegnato':'DA ASSEGNARE'}\n\n${notices.join('\n')||'Nessuna prenotazione o pagamento verrà modificato.'}`))return;
  const result=await DGData.rpc('dg3_aggiorna_viaggio_autobus_stato_v1',{
   p_viaggio_id:id,p_autobus_id:nextBus,p_stato:nextState,
   p_autobus_precedente_id:previousBus,p_stato_precedente:previousState
  });
  if(result?.success!==true||result?.viaggio_id!==id||result.stato!==nextState||(result.autobus_id||null)!==nextBus)
   throw Error('Supabase non ha confermato lo stato e il bus richiesti: nessun esito positivo dichiarato.');
  delete cache.trips;delete cache.fleet;delete cache.bookings;closeModal();
  toast('Viaggio aggiornato: '+nextState+' · '+(result.autobus||'DA ASSEGNARE'));
  go('trips');
 }
 async function submitFleet(form){
  requireLive();const v=Object.fromEntries(new FormData(form));
  const title=String(v.titolo||'').trim(),brand=String(v.marca||'').trim(),model=String(v.modello||'').trim();
  const cap=Number(v.posti);
  if(title.length<3||title.length>90||brand.length<2||brand.length>80||model.length<2||model.length>80)
   throw Error('Marca, modello e denominazione obbligatori');
  if(!Number.isInteger(cap)||cap<1||cap>100)throw Error('Posti effettivi non validi');
  if(!['GT','Limousine Bus'].includes(v.categoria))throw Error('Categoria non valida');
  const fleet=await data('fleet');
  if(fleet.some(f=>String(f.titolo||'').trim().toLowerCase()===title.toLowerCase()))throw Error('Esiste già un autobus con questo nome: non duplicarlo');
  if(!confirm(`Aggiungere davvero alla flotta l’autobus ${title}, con ${cap} posti?\nQuesta operazione crea un nuovo mezzo aziendale in Supabase.`))return;
  const record=await DGData.insert('flotta',{titolo:title,marca:brand,modello:model,categoria:v.categoria,posti:cap,
   targa:String(v.targa||'').trim()||null,stato:'Disponibile',attivo:true});
  if(!record?.id)throw Error('Supabase non ha restituito il nuovo autobus');
  delete cache.fleet;closeModal();toast('Autobus registrato nella flotta');go('trips');
 }
 document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-dg23-action]');if(!el)return;
  e.preventDefault();e.stopPropagation();el.disabled=true;
  try{if(el.dataset.dg23Action==='edit-assignment')await editAssignment(el.dataset.dg23Id);
      else if(el.dataset.dg23Action==='new-bus')newFleet();
  }catch(err){toast('Operazione non completata: '+err.message)}finally{el.disabled=false;}
 });
 document.addEventListener('submit',async e=>{
  const form=e.target;if(!['dg23-assignment-form','dg23-new-bus-form'].includes(form.id))return;
  e.preventDefault();e.stopImmediatePropagation();const b=form.querySelector('button[type=submit]');if(b)b.disabled=true;
  try{if(form.id==='dg23-assignment-form')await submitAssignment(form);else await submitFleet(form)}
  catch(err){const box=form.querySelector('#dg23-error');if(box){box.hidden=false;box.textContent=err.message;}else toast(err.message)}
  finally{if(b)b.disabled=false;}
 });
 document.addEventListener('input',e=>{if(e.target.id!=='dg23-trip-search'&&e.target.id!=='dg23-trip-status')return;
  const list=document.getElementById('dg23-list');if(!list)return;
  const q=String(document.getElementById('dg23-trip-search')?.value||'').trim().toLowerCase();
  const s=String(document.getElementById('dg23-trip-status')?.value||'');
  const rows=currentRows.filter(x=>(!s||x.stato===s)&&[x.titolo,x.destinazione,x.autobus,x.data_partenza].join(' ').toLowerCase().includes(q));
  list.innerHTML=renderFiltered(rows);
 });
 document.addEventListener('change',e=>{if(e.target.id!=='dg23-trip-status')return;
   document.getElementById('dg23-trip-search')?.dispatchEvent(new Event('input',{bubbles:true}));});
 window.DGViaggiBus23=Object.freeze({version:'2.3',legitimateFleet,availableCount});
})();
