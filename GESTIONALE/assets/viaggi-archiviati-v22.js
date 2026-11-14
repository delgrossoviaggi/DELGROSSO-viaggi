/* DELGROSSO 3.0 ULTIMATE v2.2 — pagina archivio viaggi con rimozione server-side protetta.
 * No DELETE REST. Soltanto RPC che controllano tutte le dipendenze sotto RLS e in transazione.
 */
'use strict';
(function(){
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 NAV[0][1].splice(2,0,['archivedTrips','▣','Viaggi archiviati']);
 const tripsRenderer=renders.trips;
 renders.trips=async function(){
  const html=await tripsRenderer();
  const link='<button type="button" class="btn-secondary" data-go="archivedTrips">▣ Apri viaggi archiviati</button>';
  return html.includes('<div class="action-row">')
    ? html.replace('<div class="action-row">','<div class="action-row">'+link)
    : html+'<div class="action-row">'+link+'</div>';
 };
 const demoArchived=[{id:'demo-archivio',titolo:'Gita di prova archiviata',destinazione:'Destinazione dimostrativa',data_partenza:'2026-10-18',archiviato_at:'2026-10-19T12:00:00Z',autobus:'Bus dimostrativo',stato:'Archiviato'}];
 let archiveRows=[];
 const acts=r=>{
  if(isDemo())return '<span class="small-note">Anteprima: nessuna scrittura</span>';
  const id=esc(r.id);
  return `<div class="action-row" style="gap:6px;flex-wrap:wrap">
  <button class="btn-secondary" type="button" data-dg22-check="${id}">Verifica eliminazione</button>
  <button class="btn-secondary" type="button" data-dg9-action="trip-archive" data-dg9-id="${id}">Ripristina</button>
  </div>`;
 };
 function renderRows(rows){return table(rows,[
  ['DATA',x=>fmtDate(x.data_partenza)],
  ['VIAGGIO',x=>`<strong>${esc(x.titolo||x.destinazione||'—')}</strong><div class="small-note">${esc(x.destinazione||'')}</div>`],
  ['AUTOBUS',x=>esc(x.autobus||'—')],
  ['ARCHIVIATO IL',x=>fmtDate(x.archiviato_at)],
  ['VERIFICA',x=>x.preview ? (x.preview.eliminabile?'<span class="chip ok">Eliminabile</span>':`<span class="chip warn">${Number(x.preview.blocchi?.length)||0} vincoli</span>`):'<span class="chip">Da verificare</span>'],
  ['AZIONI',acts]
 ]);}
 async function showArchived(){
  const trips=isDemo()?demoArchived:await data('trips');
  archiveRows=trips.filter(x=>!!x.archiviato_at).sort((a,b)=>String(b.data_partenza||'').localeCompare(String(a.data_partenza||'')));
  return sec('Viaggi archiviati','Consulta tutti i viaggi nascosti dalla programmazione, ripristina oppure verifica una cancellazione definitiva')+
   `<div class="action-row"><button class="btn-secondary" type="button" data-go="trips">← Torna ai viaggi</button></div>`+
   (isDemo()?cardInfo('Questi sono dati fittizi. Accedi come Nicola o Raffaele per vedere i veri viaggi archiviati.','info'):'')+
   `<div class="filters"><label class="search-box">⌕ <input id="dg22-archived-search" type="search" placeholder="Cerca destinazione, viaggio, data..."></label><span class="chip">${archiveRows.length} viaggi archiviati</span></div>`+
   `<div id="dg22-archived-results">${mainPanel('Archivio storico dei viaggi',renderRows(archiveRows))}</div>`+
   cardInfo('La cancellazione definitiva è irreversibile. I viaggi con prenotazioni, incassi, ricevute, documenti, BUS BIS o altri collegamenti vengono BLOCCATI dal server. Le fermate del solo viaggio vuoto possono essere rimosse insieme ad esso.','warn');
 }
 renders.archivedTrips=showArchived;
 async function checkArchived(id){
  requireLive();if(!UUID.test(id))throw Error('Identificativo viaggio non valido');
  const info=await DGData.rpc('dg3_archived_trip_check_v1',{p_trip_id:id});
  if(!info||info.trip_id!==id)throw Error('Risposta di controllo Supabase non valida');
  const row=archiveRows.find(x=>x.id===id);if(row)row.preview=info;
  const el=document.getElementById('dg22-archived-results');if(el)el.innerHTML=mainPanel('Archivio storico dei viaggi',renderRows(archiveRows));
  const blockers=Array.isArray(info.blocchi)?info.blocchi:[];
  const label=esc(info.titolo||'Viaggio');
  const details=blockers.length?`<ul>${blockers.map(b=>`<li><strong>${esc(b.archivio||'Archivio')}</strong>: ${esc(b.record??b.motivo??'collegamento presente')} record</li>`).join('')}</ul>`:'<p>Nessuna dipendenza storica rilevata dalla verifica protetta.</p>';
  const content=`<div class="modal-content"><p><strong>${label}</strong> · ${esc(fmtDate(info.data_partenza))}</p>`+
   `<p><strong>Fermate collegate:</strong> ${Number(info.fermate_da_rimuovere||0)} (saranno rimosse se il viaggio verrà eliminato).</p>`+details+
   (info.eliminabile?`<p class="alert warn">L'eliminazione sarà definitiva. Per confermare dovrai digitare ELIMINA.</p>
    <button type="button" class="btn btn-main" data-dg22-confirm="${esc(id)}">Procedi all'eliminazione...</button>`:
    `<div class="alert warn">Eliminazione NON consentita. Questo viaggio deve restare archiviato per conservare prenotazioni, documenti, pagamenti o altri dati collegati.</div>`)+
   '</div>';
  modal(info.eliminabile?'Viaggio eliminabile · conferma richiesta':'Eliminazione bloccata',content);
 }
 function openFinalConfirmation(id){
  const row=archiveRows.find(x=>x.id===id);
  if(!row||!row.preview?.eliminabile)throw Error('Verifica eliminazione da ripetere');
  modal('Elimina definitivamente · '+(row.titolo||row.destinazione),`<form id="dg22-delete-form" data-id="${esc(id)}">
   <p><strong>${esc(row.titolo||row.destinazione)}</strong> · ${esc(fmtDate(row.data_partenza))}</p>
   <div class="alert warn">Non potrai annullare questa operazione. I dati collegati sono ricontrollati da Supabase nell'istante della cancellazione.</div>
   <label class="field"><span>Per confermare digita esattamente <strong>ELIMINA</strong></span><input name="conferma" type="text" autocomplete="off" autocapitalize="characters" required placeholder="ELIMINA"></label>
   ${actFooter('Elimina definitivamente')}</form>`);
 }
 document.addEventListener('click',async e=>{
  const check=e.target.closest('[data-dg22-check]');
  const commit=e.target.closest('[data-dg22-confirm]');
  if(!check&&!commit)return;
  const button=check||commit;button.disabled=true;
  try{if(check)await checkArchived(check.dataset.dg22Check);else openFinalConfirmation(commit.dataset.dg22Confirm);}
  catch(error){toast('Non completato: '+error.message)}finally{button.disabled=false;}
 });
 document.addEventListener('submit',async e=>{
  const f=e.target;if(f.id!=='dg22-delete-form')return;
  e.preventDefault();e.stopImmediatePropagation();
  const submit=f.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
  try{
   requireLive();const id=f.dataset.id;
   if(!UUID.test(id))throw Error('Riferimento viaggio non valido');
   if(String(new FormData(f).get('conferma')||'').trim()!=='ELIMINA')throw Error('Devi digitare esattamente ELIMINA');
   if(!confirm('ULTIMA CONFERMA: eliminare definitivamente il viaggio archiviato? Questa operazione non può essere annullata.'))return;
   const result=await DGData.rpc('dg3_delete_archived_trip_v1',{p_trip_id:id,p_conferma:'ELIMINA'});
   if(result?.success!==true||result?.deleted!==true||result?.trip_id!==id)throw Error('Il database non ha confermato la cancellazione');
   delete cache.trips;delete cache.bookings;delete cache.seatrows;closeModal();toast('Viaggio archiviato eliminato definitivamente');go('archivedTrips');
  }catch(error){const err=f.querySelector('#dg-form-error');if(err){err.hidden=false;err.textContent=error.message;}else toast(error.message)}
  finally{if(submit)submit.disabled=false;}
 });
 document.addEventListener('input',e=>{
  if(e.target.id!=='dg22-archived-search'||page!=='archivedTrips')return;
  const q=String(e.target.value||'').trim().toLocaleLowerCase('it');
  const rows=archiveRows.filter(x=>[x.titolo,x.destinazione,x.autobus,x.data_partenza].join(' ').toLocaleLowerCase('it').includes(q));
  const list=document.getElementById('dg22-archived-results');if(list)list.innerHTML=mainPanel('Archivio storico dei viaggi',renderRows(rows));
 });
 window.DGArchivedTrips22=Object.freeze({renderRows,version:'2.2',route:'archivedTrips'});
})();
