/* DELGROSSO V79: report partenza scaricabile, dati riletti in sola lettura.
 * Nessun invio email, nessuna modifica contabile, nessun PDF archiviato automaticamente.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isUUID=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const isCanceled=x=>/annull|cancel|storn/i.test(String(x?.stato||''));
let busy=false,alertMounted=false;
async function read(table,params){
 if(typeof api!=='function')throw Error('La connessione al database del gestionale non e disponibile.');
 const data=await api(table,params,{noCache:true});
 if(!Array.isArray(data))throw Error('Risposta non valida dal database: '+table);
 return data;
}
async function chunks(table,field,ids,columns='*'){
 const out=[],valid=[...new Set(ids.map(String).filter(isUUID))];
 for(let i=0;i<valid.length;i+=40){
  const list=valid.slice(i,i+40);
  const rows=await read(table,'select='+columns+'&'+field+'=in.('+list.join(',')+')');
  out.push(...rows);
 }
 return out;
}
async function loadSnapshot(selectedId){
 if(!isUUID(selectedId))throw Error('Identificativo viaggio non valido.');
 if(typeof state==='undefined'||!Array.isArray(state.viaggi))throw Error('Carica prima i viaggi nel gestionale.');
 const chosen=state.viaggi.find(v=>String(v.id)===String(selectedId));
 if(!chosen)throw Error('Viaggio non trovato: aggiorna la pagina e riprova.');
 const rootId=chosen.bis_parent_id||chosen.id;
 if(!isUUID(rootId))throw Error('Identificativo del viaggio principale non valido.');
 const [rootRows,children,operators]=await Promise.all([
  read('viaggi','select=*&id=eq.'+rootId),
  read('viaggi','select=*&bis_parent_id=eq.'+rootId),
  read('operatori_gestionale','select=user_id,username,nome,attivo')
 ]);
 if(rootRows.length!==1)throw Error('Impossibile rileggere il viaggio principale.');
 const trips=[rootRows[0],...children].filter(v=>!isCanceled(v));
 if(!trips.some(x=>x.id===chosen.id)&&!isCanceled(chosen))
  throw Error('La composizione degli autobus e cambiata: aggiorna la pagina.');
 const ids=trips.map(v=>String(v.id));
 const [bookings,seats,byTrip]=await Promise.all([
  chunks('prenotazioni','viaggio_id',ids),
  chunks('prenotazione_posti','viaggio_id',ids,'prenotazione_id,viaggio_id,posto'),
  chunks('pagamenti','viaggio_id',ids)
 ]);
 const byBooking=await chunks('pagamenti','prenotazione_id',bookings.map(b=>b.id));
 const payments=[...new Map([...byTrip,...byBooking].map(p=>[String(p.id),p])).values()];
 const transfers=await chunks('dg_quote_transfers_v61','pagamento_id',payments.map(p=>p.id));
 const model=window.DG79Model;
 if(!model?.build)throw Error('Modulo di calcolo quote non disponibile.');
 return model.build({root:rootRows[0],trips,bookings,seats,payments,transfers,operators});
}
function shortFilename(report){
 const txt=String(report.trip.titolo||report.trip.destinazione||'viaggio').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-+$/g,'').slice(0,46);
 return 'DELGROSSO_Riepilogo_Partenza_'+String(report.trip.data_partenza||'data')+'_'+(txt||'viaggio')+'.pdf';
}
function info(message,error=false){
 if(typeof toast==='function')toast(message,!error);
 else if(error)window.alert?.(message);
}
window.dg79DownloadTripReport=async function(tripId){
 if(busy)return info('Generazione del riepilogo gia in corso.',true);
 if(typeof can==='function'&&!can('cassa','read'))return info('Occorre il permesso di lettura Cassa.',true);
 if(!window.DG79PDF?.make||!window.DG79Model?.build)
  return info('Modulo PDF non disponibile. Ricarica il gestionale.',true);
 busy=true;
 const safari=/iPhone|iPad|iPod/i.test(navigator?.userAgent||'')||
  (navigator?.platform==='MacIntel'&&navigator?.maxTouchPoints>1);
 // A blank tab must be opened while the user is still tapping on Safari.
 const tab=safari?window.open('about:blank','_blank'):null;
 if(tab){tab.document.title='DELGROSSO - riepilogo partenza';tab.document.body.textContent='Preparazione del PDF con i dati aggiornati...';}
 try{
  info('Verifica di prenotazioni, pagamenti e quote in corso...');
  const snapshot=await loadSnapshot(tripId);
  if(!snapshot.rows.length)throw Error('Questo viaggio non ha quote di partecipanti attivi.');
  const bytes=window.DG79PDF.make(snapshot);
  const blob=new Blob([bytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  if(tab)tab.location.replace(url);
  else{
   const link=document.createElement('a');link.href=url;link.download=shortFilename(snapshot);
   document.body.appendChild(link);link.click();link.remove();
  }
  setTimeout(()=>URL.revokeObjectURL(url),120000);
  info('PDF riepilogo partenza pronto: quote Nicola, Raffaele e totale viaggio riconciliati.');
 }catch(err){
  if(tab)tab.close();
  info('PDF non generato: '+String(err?.message||err),true);
  console.warn('Riepilogo partenza DELGROSSO: '+String(err?.message||err));
 }finally{busy=false;}
};
function todayTrips(trips,iso){
 const all=(trips||[]).filter(v=>!v.archiviato_at&&v.data_partenza===iso&&!isCanceled(v));
 const eligible=all.filter(v=>!v.bis_parent_id);
 return eligible.sort((a,b)=>String(a.ora_partenza||'').localeCompare(String(b.ora_partenza||'')));
}
window.dg79RenderToday=function(){
 const parent=$('page-dashboard');if(!parent)return;
 let panel=$('dg79TodayReports');
 if(!panel){
  panel=document.createElement('section');panel.id='dg79TodayReports';
  panel.className='card';panel.style.cssText='margin:8px 0 14px;padding:13px;border:1px solid #b8d4e8;border-radius:13px';
  const title=parent.querySelector('.section-title')||parent.querySelector('.dg-r35-head');
  if(title?.nextSibling)parent.insertBefore(panel,title.nextSibling);
  else parent.prepend(panel);
 }
 const date=window.DG79Model?.today?.();
 const all=todayTrips(typeof state!=='undefined'?state.viaggi:[],date);
 if(!all.length){panel.style.display='none';return}
 panel.style.display='';
 panel.innerHTML='<div style="display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap">'+
  '<div><b>📋 Riepiloghi economici delle partenze di oggi</b>'+
  '<div style="font-size:12px;color:#536a80">PDF pronto da calcolare con gli incassi aggiornati. Non viene inviato ai clienti.</div></div></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px">'+
  all.map(v=>'<button type="button" class="btn btn-primary btn-sm" onclick="dg79DownloadTripReport(\''+
  esc(v.id)+'\')">📄 '+esc(v.titolo||v.destinazione||'Viaggio')+' - Scarica PDF</button>').join('')+'</div>';
};
window.dg79BuildForTest=loadSnapshot;
window.dg79TodayTrips=todayTrips;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',window.dg79RenderToday,{once:true});
else window.dg79RenderToday();
})();
