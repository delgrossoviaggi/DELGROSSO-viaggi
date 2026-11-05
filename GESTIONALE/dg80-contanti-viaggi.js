/* DELGROSSO V80 — pagina separata CONTANTI VIAGGI.
 * Letture Supabase fresche e protette, nessuna modifica a pagamenti o prenotazioni.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=s=>window.DG80CashModel?.money(s)||'—';
const str=s=>String(s??'');
let result=null,busy=false,lastAt=0,error='',lastUpdated='',version=0;
let filters={trip:'',query:'',showEmpty:false};
const dateIT=s=>/^\d{4}-\d{2}-\d{2}/.test(str(s))?str(s).slice(8,10)+'/'+str(s).slice(5,7)+'/'+str(s).slice(0,4):'—';
async function paged(table,columns){
 const out=[];
 if(typeof api!=='function')throw Error('Connessione al gestionale non disponibile.');
 for(let offset=0;offset<=10000;offset+=1000){
  const page=await api(table,'select='+columns+'&limit=1000&offset='+offset,{noCache:true});
  if(!Array.isArray(page))throw Error('Risposta del database non valida: '+table);
  out.push(...page);
  if(page.length<1000)return out;
 }
 throw Error('L’elenco '+table+' supera il limite di sicurezza: richiedere verifica.');
}
function allowed(){
 if(typeof authSession!=='undefined'&&!authSession?.access_token)return false;
 if(typeof can==='function'&&!can('cassa','read'))return false;
 return true;
}
async function reload(){
 if(busy)return;
 if(!allowed()){result=null;error='Accedi con un operatore abilitato alla lettura della Cassa.';renderOnly();return;}
 busy=true;error='';renderOnly();
 const run=++version;
 try{
  const [trips,bookings,payments,operators,cashTransfers]=await Promise.all([
   paged('viaggi','id,titolo,destinazione,data_partenza,bis_parent_id,bis_numero,archiviato_at'),
   paged('prenotazioni','id,viaggio_id,cliente,cliente_nome,codice,confirmation_number,id_prenotazione,fermata_partenza,stato,riserva_aziendale'),
   paged('pagamenti','id,viaggio_id,prenotazione_id,cliente,importo,tipo,stato,metodo,metodo_pagamento,incassato_da_user_id,incassato_da,data_pagamento,created_at,receipt_number,ricevuta'),
   paged('operatori_gestionale','user_id,username,nome,attivo'),
   paged('cassa_trasferimenti','id,da_operatore_user_id,a_operatore_user_id,importo,stato,data_trasferimento,created_at,note')
  ]);
  if(run!==version)return;
  if(!allowed()){result=null;error='Sessione scaduta: rientra prima di consultare gli incassi.';return;}
  if(!window.DG80CashModel?.build)throw Error('Modulo di calcolo contanti non caricato.');
  result=window.DG80CashModel.build({trips,bookings,payments,operators,cashTransfers});
  lastAt=Date.now();lastUpdated=new Date().toLocaleString('it-IT');
 }catch(err){
  if(run!==version)return;
  result=null;error='Impossibile aggiornare i contanti: '+str(err?.message||err);
 }finally{if(run===version){busy=false;renderOnly();}}
}
function rowTable(items){
 if(!items.length)return '<p class="dg80-empty">Nessun pagamento in contanti registrato per questo operatore.</p>';
 return '<div class="dg80-scroll"><table class="dg80-table"><thead><tr>'+
  '<th>Data</th><th>Chi ha consegnato i soldi</th><th>Prenotazione</th><th>Tipo</th><th>Importo</th></tr></thead><tbody>'+
  items.map(m=>'<tr>'+
   '<td>'+esc(dateIT(m.date))+'</td>'+
   '<td><b>'+esc(m.cliente)+'</b>'+(m.bookingStatus?'<small>'+esc(m.bookingStatus)+'</small>':'')+'</td>'+
   '<td>'+esc(m.booking||'—')+(m.bus>1?' <small>BUS '+esc(m.bus)+'</small>':'')+'</td>'+
   '<td>'+esc(m.tipo)+(m.refund?' <span class="dg80-red">· Uscita</span>':'')+'</td>'+
   '<td class="dg80-amount '+(m.amount<0?'dg80-red':'')+'">'+e(m.amount)+'</td>'+
  '</tr>').join('')+'</tbody></table></div>';
}
function officerCard(group,key,label){
 const list=group.movements.filter(x=>x.owner===key);
 return '<div class="dg80-owner"><div class="dg80-owner-top"><strong>'+label+'</strong><b>'+e(group[key])+'</b></div>'+
  '<div class="dg80-owner-sub">'+list.length+' movimenti · elenco dei clienti che hanno versato contanti</div>'+
  rowTable(list)+'</div>';
}
function groupCard(g,autoOpen){
 const title=str(g.trip.titolo||g.trip.destinazione||'Viaggio');
 const details=g.buses.length>1?' · '+g.buses.length+' autobus (BUS/BIS)':'';
 return '<details class="dg80-trip" '+(autoOpen?'open':'')+'>'+
   '<summary><span class="dg80-trip-title"><b>'+esc(title)+'</b><small>'+
     esc(dateIT(g.trip.data_partenza))+esc(details)+'</small></span>'+
    '<span class="dg80-trip-numbers"><span>Nicola <b>'+e(g.nicola)+'</b></span>'+
      '<span>Raffaele <b>'+e(g.raffaele)+'</b></span>'+
      '<span>Totale <b>'+e(g.netto)+'</b></span></span></summary>'+
   '<div class="dg80-trip-body">'+
    '<div class="dg80-trip-meta">Incassi: '+e(g.received)+' · Rimborsi: '+e(g.refunds)+
      ' · Da attribuire: '+e(g.nonAttribuiti)+'</div>'+
    '<div class="dg80-columns">'+officerCard(g,'nicola','💶 Nicola')+
      officerCard(g,'raffaele','💶 Raffaele')+'</div>'+
    (g.movements.some(x=>x.owner==='nonAttribuiti')?
      '<div class="dg80-unassigned"><strong>⚠️ Da attribuire</strong>'+
      rowTable(g.movements.filter(x=>x.owner==='nonAttribuiti'))+'</div>':'')+
    '</div></details>';
}
function metric(label,value,secondary=''){
 return '<div class="dg80-stat"><span>'+esc(label)+'</span><strong>'+e(value)+'</strong>'+
   (secondary?'<small>'+esc(secondary)+'</small>':'')+'</div>';
}
function renderOnly(){
 const body=$('dg80CashResults'),metrics=$('dg80CashMetrics'),warning=$('dg80CashWarnings'),meta=$('dg80CashMeta');
 if(!body||!metrics||!warning)return;
 if(!allowed()){
  body.innerHTML='<div class="dg80-error">Accesso riservato: occorre il permesso di lettura Cassa.</div>';
  metrics.innerHTML='';warning.innerHTML='';return;
 }
 if(meta)meta.textContent=busy?'Aggiornamento dal database in corso…':lastUpdated?'Dati letti da Supabase: '+lastUpdated:'Dati non ancora caricati';
 if(error){body.innerHTML='<div class="dg80-error" role="alert">'+esc(error)+'</div>';metrics.innerHTML='';warning.innerHTML='';return}
 if(!result){body.innerHTML='<div class="dg80-empty">Lettura dei pagamenti registrati…</div>';return;}
 const t=result.totals;
 metrics.innerHTML=metric('Incassi registrati a Nicola',t.nicola,'Al netto dei rimborsi')+
  metric('Incassi registrati a Raffaele',t.raffaele,'Al netto dei rimborsi')+
  metric('Contanti da attribuire',t.nonAttribuiti,'Da controllare')+
  metric('Totale contanti dei viaggi',t.netto,'Incassi meno rimborsi');
 const select=$('dg80TripSelect');
 if(select){
  const current=filters.trip;
  select.innerHTML='<option value="">Tutti i viaggi</option>'+
   result.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(dateIT(g.trip.data_partenza)+' · '+str(g.trip.titolo||g.trip.destinazione))+'</option>').join('');
  select.value=current;
 }
 const q=filters.query.toLocaleLowerCase('it');
 const list=result.groups.filter(g=>(filters.showEmpty||g.movements.length)&&
  (!filters.trip||g.id===filters.trip)&&
  (!q||[g.trip.titolo,g.trip.destinazione,g.trip.data_partenza,...g.movements.map(x=>x.cliente+' '+x.booking)].join(' ').toLocaleLowerCase('it').includes(q)));
 body.innerHTML='<div class="dg80-list-head"><strong>'+list.length+' viaggi</strong>'+
  '<small>Apri un viaggio per vedere esattamente chi ha versato a ciascun operatore.</small></div>'+
  (list.map((g,i)=>groupCard(g,!!filters.trip||i===0)).join('')||
   '<div class="dg80-empty">Nessun viaggio corrispondente ai filtri.</div>');
 const tr=result.transfers;
 const cash=$('dg80PhysicalBalance');
 if(cash)cash.innerHTML='<h3>⇄ Passaggi fisici di cassa (non nuovi incassi)</h3>'+
  '<div class="dg80-overview">'+
   metric('Nicola · saldo viaggi dopo passaggi',result.inCaricoViaggi.nicola)+
   metric('Raffaele · saldo viaggi dopo passaggi',result.inCaricoViaggi.raffaele)+
   metric('Non attribuiti / altri',result.inCaricoViaggi.nonAttribuiti)+'</div>'+
  '<p class="dg80-foot">Il passaggio di cassa è generale e non è attribuibile automaticamente a un singolo viaggio. Questi saldi non includono contanti di noleggi o eventuali spese aziendali.</p>'+
  (tr.records.length?'<div class="dg80-scroll"><table class="dg80-table"><thead><tr><th>Data</th><th>Da</th><th>A</th><th>Contanti consegnati</th><th>Nota</th></tr></thead><tbody>'+
   tr.records.map(x=>'<tr><td>'+esc(dateIT(x.date))+'</td><td>'+esc(x.from)+'</td><td>'+esc(x.to)+'</td><td class="dg80-amount">'+e(x.amount)+'</td><td>'+esc(x.note||'—')+'</td></tr>').join('')+'</tbody></table></div>':
   '<p class="dg80-foot">Nessun passaggio fisico confermato registrato.</p>');
 const notes=[];
 if(result.unresolved.length)notes.push(result.unresolved.length+' movimenti contanti non collegabili a un viaggio: inclusi nel totale generale ma non in un singolo viaggio.');
 if(result.excludedMethods)notes.push(result.excludedMethods+' pagamenti con metodo non contanti esclusi dai totali di questa pagina.');
 notes.push(...result.issues);
 warning.innerHTML=notes.length?'<details class="dg80-note"><summary>⚠️ Verifiche e avvertenze ('+notes.length+')</summary><ul>'+
  notes.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'';
 const unmatched=$('dg80Unlinked');
 if(unmatched)unmatched.innerHTML=result.unresolved.length?
  '<h3>Movimenti da verificare: viaggio non identificato</h3>'+rowTable(result.unresolved):'';
}
function csvCell(value){
 let s=str(value);
 if(/^[\s]*[=+@\-]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
window.dg80ExportCashCSV=function(){
 if(!allowed()||!result)return;
 const groups=result.groups.filter(g=>(filters.showEmpty||g.movements.length)&&(!filters.trip||g.id===filters.trip));
 const head=['Viaggio','Data viaggio','Bus','Data incasso','Operatore','Cliente','Codice prenotazione','Tipo','Importo EUR','Numero ricevuta','Stato prenotazione'];
 const records=[head];
 for(const g of groups)for(const x of g.movements){
  records.push([g.trip.titolo||g.trip.destinazione||'Viaggio',dateIT(g.trip.data_partenza),
   'BUS '+x.bus,dateIT(x.date),x.owner==='nicola'?'Nicola':x.owner==='raffaele'?'Raffaele':'Da attribuire',
   x.cliente,x.booking,x.tipo,(x.amount/100).toFixed(2).replace('.',','),x.receipt,x.bookingStatus]);
 }
 const content='\ufeff'+records.map(x=>x.map(csvCell).join(';')).join('\r\n')+'\r\n';
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='DELGROSSO_Contanti_Nicola_Raffaele_'+
  new Date().toISOString().slice(0,10)+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
window.dg80RenderCashTrips=function(){
 const page=$('page-contantiviaggi');
 if(!page)return;
 if(!allowed()){result=null;renderOnly();return;}
 if(!result||Date.now()-lastAt>60000){reload();return;}
 renderOnly();
};
window.dg80RefreshCashTrips=reload;
window.dg80ApplyCashFilters=function(){
 filters={
  trip:$('dg80TripSelect')?.value||'',
  query:$('dg80Search')?.value||'',
  showEmpty:!!$('dg80ShowEmpty')?.checked
 };
 renderOnly();
};
window.dg80ResetCashTrips=function(){
 ++version;busy=false;result=null;lastAt=0;lastUpdated='';error='';
 const body=$('dg80CashResults');if(body)body.textContent='';
 const cash=$('dg80PhysicalBalance');if(cash)cash.textContent='';
};
})();
