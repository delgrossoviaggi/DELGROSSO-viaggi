/* DELGROSSO V78 - Only authenticated, on-demand review of historical confirmations.
 * Never links, deletes, regenerates or sends any customer document.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let files=null,loading=false,error='',lastCheck='',hasMore=false;
const bucket='ricevute-prenotazioni',folder='conferme';
function fullPath(raw){
 const name=String(raw||'').trim();
 if(!name||name.startsWith('/')||name.includes('\\'))return '';
 const path=name.startsWith(folder+'/')?name:folder+'/'+name;
 if(!path.toLowerCase().endsWith('.pdf')||path.split('/').some(x=>!x||x==='.'||x==='..'))return '';
 return path;
}
function classify(items,bookings){
 const paths=new Map(),refs=new Map();
 (bookings||[]).forEach(b=>{
  if(b.confirmation_storage_path)paths.set(String(b.confirmation_storage_path),b);
  if(b.confirmation_number)refs.set(String(b.confirmation_number).trim().toUpperCase(),b);
 });
 return items.map(f=>{
  const path=fullPath(f.name);
  const base=path.slice(folder.length+1).replace(/\.pdf$/i,'').toUpperCase();
  const referenced=paths.get(path),matched=referenced||refs.get(base);
  return {
   path,created_at:f.created_at||'',
   mode:referenced?'linked':matched?'review':'unlinked',
   bookingId:matched?String(matched.id):''
  };
 }).filter(x=>x.path);
}
function trustedUrl(raw){
 try{
  if(typeof SUPA_URL!=='string'||!SUPA_URL)return '';
  const base=new URL(SUPA_URL);
  const candidate=String(raw||'');
  const full=candidate.startsWith('/object/sign/')?SUPA_URL+'/storage/v1'+candidate:
    candidate.startsWith('/storage/v1/')?SUPA_URL+candidate:candidate;
  const u=new URL(full,base);
  return u.origin===base.origin&&u.protocol==='https:'&&
   u.pathname.startsWith('/storage/v1/object/sign/'+bucket+'/'+folder+'/')&&
   u.searchParams.has('token')?u.href:'';
 }catch{return ''}
}
async function getArchive(){
 if(typeof SUPA_URL!=='string'||typeof accessHeaders!=='function')
  throw Error('Sessione gestionale non disponibile. Rientra con il tuo account operatore.');
 const items=[];
 for(let offset=0;offset<500;offset+=100){
  const response=await fetch(SUPA_URL+'/storage/v1/object/list/'+bucket,{
   method:'POST',headers:{...accessHeaders(),'Content-Type':'application/json'},
   body:JSON.stringify({prefix:folder,limit:100,offset,sortBy:{column:'name',order:'asc'}}),
   cache:'no-store'
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!Array.isArray(data))
   throw Error(data?.message||data?.error||'Lettura dell’archivio non autorizzata (HTTP '+response.status+').');
  items.push(...data);
  if(data.length<100){hasMore=false;break}
  if(offset===400)hasMore=true;
 }
 return items;
}
function container(){
 const parent=$('dg75IntegrityPanel');
 if(!parent)return null;
 let box=$('dg78Historical');
 if(box)return box;
 box=document.createElement('section');
 box.id='dg78Historical';
 box.style.cssText='padding:10px 0 0;margin-top:10px;border-top:1px solid #e2e8f0';
 parent.appendChild(box);
 box.addEventListener('click',e=>{
  const refresh=e.target.closest?.('[data-dg78-refresh]');
  if(refresh){window.dg78LoadArchive();return}
  const open=e.target.closest?.('[data-dg78-open]');
  if(open){const n=Number(open.getAttribute('data-dg78-open'));window.dg78OpenArchive(n);return}
  const booking=e.target.closest?.('[data-dg78-booking]');
  if(booking){
   const id=booking.getAttribute('data-dg78-booking');
   if(id&&(typeof state!=='undefined')&&(state.prenotazioni||[]).some(b=>String(b.id)===id))
    window.openBookingModal?.(id);
  }
 });
 return box;
}
function render(){
 const box=container();if(!box)return;
 const records=files?classify(files,typeof state!=='undefined'?state.prenotazioni:[]):null;
 const linked=records?records.filter(x=>x.mode==='linked').length:0;
 const review=records?records.filter(x=>x.mode==='review').length:0;
 const orphan=records?records.filter(x=>x.mode==='unlinked').length:0;
 box.innerHTML=
  '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;justify-content:space-between">'+
   '<div><strong style="font-size:14px">📁 Archivio conferme storiche</strong>'+
   '<div style="font-size:12px;color:#64748b">Solo lettura: nessuna modifica alle prenotazioni o ai file originali.</div></div>'+
   '<button type="button" class="btn btn-secondary btn-sm" data-dg78-refresh="1" '+(loading?'disabled':'')+'>'+
    (loading?'Controllo in corso…':files?'↻ Ricontrolla archivio':'Verifica archivio privato')+'</button></div>'+
   (error?'<p role="alert" style="color:#b91c1c;font-size:12px">'+esc(error)+'</p>':'')+
   (records?
    '<p style="font-size:12px;margin:8px 0"><b>'+records.length+'</b> PDF esaminati · <b>'+
      linked+'</b> già collegati · <b>'+review+'</b> riferimento presente ma da verificare · <b>'+
      orphan+'</b> senza corrispondenza esatta'+(hasMore?' · elenco parziale':'')+'</p>'+
    (records.filter(x=>x.mode!=='linked').length?
     '<div style="max-height:280px;overflow:auto;display:grid;gap:6px">'+records.filter(x=>x.mode!=='linked').map(x=>{
       const i=records.indexOf(x);
       return '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:9px;padding:8px">'+
         '<div style="min-width:0;overflow-wrap:anywhere"><b style="font-size:12px">'+esc(x.path.split('/').pop())+'</b>'+
         '<div style="font-size:11px;color:#64748b">'+
          (x.mode==='review'?'Riferimento prenotazione presente: controlla il PDF':'Nessuna prenotazione attuale con riferimento esatto')+
         '</div></div><div style="display:flex;gap:5px;flex-wrap:wrap">'+
         (x.bookingId?'<button type="button" class="btn btn-secondary btn-sm" data-dg78-booking="'+esc(x.bookingId)+'">Prenotazione</button>':'')+
         '<button type="button" class="btn btn-secondary btn-sm" data-dg78-open="'+i+'">Apri PDF</button></div></div>';
     }).join('')+'</div>':'<p style="font-size:12px;color:#166534">Nessun PDF non collegato rilevato.</p>')+
    '<p style="font-size:11px;color:#64748b;margin-top:8px">Il confronto è basato su riferimenti e percorsi esatti; non attribuisce automaticamente file a clienti. Un file non abbinato non è necessariamente inutilizzato.</p>'
    :'<p style="font-size:12px;color:#64748b;margin:8px 0">Premi “Verifica archivio privato” per confrontare i PDF con le prenotazioni attuali. Nessuna ricerca viene eseguita in automatico.</p>');
}
window.dg78RenderArchive=render;
window.dg78LoadArchive=async function(){
 if(loading)return;
 loading=true;error='';render();
 try{
  files=await getArchive();
  lastCheck=new Date().toISOString();
 }catch(e){error=String(e?.message||e||'Errore caricamento archivio');files=null;}
 finally{loading=false;render()}
};
window.dg78OpenArchive=async function(index){
 const records=classify(files||[],typeof state!=='undefined'?state.prenotazioni:[]);
 const record=records[index];
 if(!record||record.mode==='linked')return;
 if(typeof accessHeaders!=='function'||typeof SUPA_URL!=='string')return;
 // Open a blank tab from the explicit tap so Safari does not block the document.
 const tab=window.open('about:blank','_blank');
 if(tab){tab.document.title='Verifica conferma DELGROSSO';tab.document.body.textContent='Apertura PDF privato...';}
 try{
  const name=record.path.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(SUPA_URL+'/storage/v1/object/sign/'+bucket+'/'+name,{
   method:'POST',headers:{...accessHeaders(),'Content-Type':'application/json'},
   body:JSON.stringify({expiresIn:300}),cache:'no-store'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.message||data.error||'Autorizzazione al file non riuscita');
  const url=trustedUrl(data.signedURL||data.signedUrl);
  if(!url)throw Error('Collegamento temporaneo non valido.');
  if(tab)tab.location.replace(url);else window.location.assign(url);
 }catch(e){
  if(tab)tab.close();
  error='Apertura PDF non riuscita: '+String(e?.message||e);
  render();
 }
};
window.dg78ClassifyArchive=classify;
window.dg78TrustedSignedUrl=trustedUrl;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
else render();
})();
