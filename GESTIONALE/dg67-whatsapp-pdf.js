/* DELGROSSO V67 — PDF WhatsApp assistito, destinazione WhatsApp precompilata.
 * Nessun invio automatico. Gli allegati NON possono essere inseriti via wa.me.
 * Telefono: condivisione nativa PDF, scelta destinatario manuale.
 * PC: chat con destinatario/testo precompilati + download PDF per allegato manuale.
 */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const st=()=>typeof state==='undefined'?null:state;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phone=v=>{let x=String(v||'').replace(/\D/g,'');if(x.startsWith('00'))x=x.slice(2);if(x.length===10&&x.startsWith('3'))x='39'+x;return /^39\d{9,12}$/.test(x)?x:''};
const booking=id=>(st()?.prenotazioni||[]).find(x=>x.id===id);
const payment=id=>(st()?.pagamenti||[]).find(x=>x.id===id);
const modalActive=()=>el('modal')?.classList.contains('on') && el('dg67Panel');
let requestSerial=0;
let selected=null;
let file=null;
let fileName='';
let storedPdfUrl='';
const notice=(message,success)=>{const box=el('dg67State');if(box)box.textContent=message;if(success!=null&&typeof window.toast==='function')window.toast(message,success)};
const fname=s=>String(s||'DELGROSSO_Documento.pdf').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
function msg(){return el(selected?.kind==='booking'?'dg64BookingText':'dg64ReceiptText')?.value?.trim()||''}
// Storage links are temporary and may open in Safari even when a browser fetch fails.
// Only allow our own private receipts bucket, never arbitrary destinations.
function trustedSignedUrl(raw){
 try{
  if(typeof SUPA_URL!=='string'||!SUPA_URL)return '';
  const base=new URL(SUPA_URL),url=new URL(String(raw||''),base);
  return url.protocol==='https:'&&url.origin===base.origin&&
   url.pathname.startsWith('/storage/v1/object/sign/ricevute-prenotazioni/')&&
   url.searchParams.has('token')?url.href:'';
 }catch{return ''}
}
function openStoredPdf(){
 if(!storedPdfUrl){notice('Collegamento PDF non disponibile. Riapri il documento dal gestionale.',false);return}
 const a=document.createElement('a');a.href=storedPdfUrl;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
 notice('Documento archiviato aperto. Da Safari puoi salvarlo o condividerlo su WhatsApp Business; controlla il PDF prima dell’invio.');
}
function chat(){
 if(!selected)return;
 const tel=phone(selected.tel),message=msg();
 if(!tel||!message){notice('Numero o messaggio non valido.',false);return}
 // Per WhatsApp Web si possono precompilare testo e numero; allegati non supportati.
 const a=document.createElement('a');a.href='https://wa.me/'+tel+'?text='+encodeURIComponent(message);a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
}
// Read-only signed URLs from Supabase Storage. Access is checked by
// storage.objects RLS (active operators only); no public bucket or new receipt.
async function existingPdfUrl(path){
 const valid=String(path||'').trim();
 if(!valid||valid.startsWith('/')||valid.includes('\\')||valid.split('/').some(x=>!x||x==='.'||x==='..'))
  throw Error('Percorso PDF archiviato non valido');
 if(typeof SUPA_URL!=='string'||typeof accessHeaders!=='function')
  throw Error('Sessione gestionale non disponibile');
 const objectPath=valid.split('/').map(encodeURIComponent).join('/');
 const endpoint=SUPA_URL+'/storage/v1/object/sign/ricevute-prenotazioni/'+objectPath;
 const response=await fetch(endpoint,{
  method:'POST',
  headers:{...accessHeaders(),'Content-Type':'application/json'},
  body:JSON.stringify({expiresIn:600}),
  cache:'no-store'
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.message||body.error||'Accesso al PDF non autorizzato (HTTP '+response.status+')');
 let raw=String(body.signedURL||body.signedUrl||'');
 if(raw.startsWith('/object/sign/'))raw=SUPA_URL+'/storage/v1'+raw;
 else if(raw.startsWith('/storage/v1/'))raw=SUPA_URL+raw;
 const signedUrl=trustedSignedUrl(raw);
 if(!signedUrl)throw Error('Collegamento temporaneo al PDF non valido');
 return {success:true,signedUrl};
}
async function fetchSigned(kind,id){
 if(typeof SUPA_URL==='undefined'||typeof accessHeaders!=='function')
  throw Error('Sessione gestionale non disponibile');
 if(kind==='booking'){
  const b=booking(id);
  // Existing archived booking confirmations always win; never reissue.
  if(b?.confirmation_storage_path)return existingPdfUrl(b.confirmation_storage_path);
  const resp=await fetch(SUPA_URL+'/functions/v1/dg67-booking-pdf',{
   method:'POST',headers:{...accessHeaders(),'Content-Type':'application/json'},
   body:JSON.stringify({bookingId:id}),cache:'no-store'
  });
  const out=await resp.json().catch(()=>({}));
  if(!resp.ok||!out.success||!out.signedUrl)throw Error(out.error||'Impossibile ottenere la conferma (HTTP '+resp.status+')');
  return out;
 }
 const p=payment(id);
 if(!p)throw Error('Pagamento non trovato');
 // Read the authoritative path so another operator cannot accidentally issue
 // a duplicate receipt after an out-of-date browser session.
 if(typeof api==='function'){
  const latest=await api('pagamenti','id=eq.'+encodeURIComponent(id)+'&select=id,receipt_professional_path,receipt_storage_path,receipt_number',{noCache:true});
  if(Array.isArray(latest)&&latest[0]){
   p.receipt_professional_path=latest[0].receipt_professional_path||null;
   p.receipt_storage_path=latest[0].receipt_storage_path||null;
   p.receipt_number=latest[0].receipt_number||p.receipt_number;
  }
 }
 const existing=p.receipt_professional_path||p.receipt_storage_path;
 if(!existing)throw Error('Ricevuta non archiviata: verifica il documento in Pagamenti. Non viene generata una nuova copia.');
 return existingPdfUrl(existing);
}
async function prepare(kind,id,key){
 storedPdfUrl='';
 const original=el('dg67OpenStored');if(original)original.disabled=true;
 notice('Preparazione del documento PDF in corso…');
 try{
  const response=await fetchSigned(kind,id);
  if(key!==requestSerial||!modalActive())return;
  storedPdfUrl=trustedSignedUrl(response.signedUrl);
  if(!storedPdfUrl)throw Error('Collegamento archiviato non valido: verifica il server');
  if(original)original.disabled=false;
  // Signed URL is reusable for direct opening if iOS Safari blocks cross-origin fetch.
  const r=await fetch(storedPdfUrl,{cache:'no-store'});
  if(!r.ok)throw Error('Documento non scaricabile (HTTP '+r.status+')');
  const blob=await r.blob();
  if(blob.size<600||blob.size>15*1024*1024)throw Error('Dimensione del documento non valida');
  const first=new Uint8Array(await blob.slice(0,5).arrayBuffer());
  const header=String.fromCharCode(...first);
  const tail=await blob.slice(Math.max(0,blob.size-256)).text();
  if(header!=='%PDF-'||!tail.includes('%%EOF'))throw Error('Il documento PDF è incompleto o danneggiato: invio bloccato');
  const type='application/pdf';
  if(key!==requestSerial||!modalActive())return;
  fileName=fname(response.filename||(kind==='booking'?'DELGROSSO_Conferma_'+id.slice(0,8)+'.pdf':'DELGROSSO_Ricevuta_'+id.slice(0,8)+'.pdf'));
  file=new File([blob],fileName,{type:'application/pdf'});
  const down=el('dg67Download'),share=el('dg67Share'),pc=el('dg67Desktop');
  if(down)down.disabled=false;
  const inspect=el('dg67Preview');if(inspect)inspect.disabled=false;
  if(share){
    const supported=typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[file]});
    share.disabled=!supported;
    share.style.display=supported?'':'none';
  }
  if(pc)pc.disabled=false;
  notice('✅ PDF pronto: '+fileName+'. Nessun messaggio è stato inviato.');
 }catch(error){
  if(key!==requestSerial||!modalActive())return;
  file=null;fileName='';
  const reason=String(error?.message||error);
  const detail=/load failed|failed to fetch|networkerror|network request failed/i.test(reason)
   ?'Connessione al servizio documenti non riuscita.':reason;
  notice(storedPdfUrl
   ?'⚠️ Caricamento automatico non riuscito: '+detail+' Il documento è archiviato: premi “Apri PDF originale” per visualizzarlo e condividerlo da Safari.'
   :'⚠️ PDF non caricato: '+detail+' Usa “Apri ricevuta PDF” o riaccedi al gestionale e riprova.',false);
 }
}
function preview(){
 if(!file){notice('Prepara prima il documento PDF.',false);return}
 const url=URL.createObjectURL(file),tab=window.open(url,'_blank');
 if(!tab){URL.revokeObjectURL(url);notice('Il browser ha bloccato l’anteprima. Usa “Scarica solo PDF” per controllarlo.',false);return}
 tab.opener=null;
 setTimeout(()=>URL.revokeObjectURL(url),120000);
 notice('Controlla testo, date e importi nel PDF prima di inviarlo al cliente.');
}
function download(){
 if(!file){notice('Il documento PDF non è ancora pronto.',false);return}
 const u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=fileName||file.name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
// navigator.share deve essere invocato direttamente dal clic, senza fetch/await preliminari.
function nativeShare(){
 if(!file||!selected){notice('Prepara prima il documento PDF.',false);return}
 if(typeof navigator.canShare!=='function'||!navigator.canShare({files:[file]})){notice('Il tuo dispositivo non supporta la condivisione PDF diretta.',false);return}
 try{
  const p=navigator.share({files:[file],title:'DELGROSSO · '+fileName,text:msg()});
  Promise.resolve(p).catch(e=>{if(e?.name!=='AbortError')notice('Condivisione non completata: '+(e.message||String(e)),false)});
 }catch(e){notice('Condivisione non disponibile: '+(e.message||String(e)),false)}
}
function desktop(){
 if(!file){notice('Attendi che il PDF sia pronto.',false);return}
 download();chat();
 notice('Chat del destinatario aperta e PDF scaricato. Su PC allega il file alla chat prima di premere Invia.');
}
function panel(kind,id){
 requestSerial++;const serial=requestSerial;
 const b=kind==='booking'?booking(id):booking(payment(id)?.prenotazione_id);
 selected={kind,id,tel:b?.telefono};file=null;fileName='';storedPdfUrl='';
 const body=el('modalBody'),foot=el('modalFoot');
 if(!body||!foot||!selected.tel)return;
 const old=el('dg67Panel');if(old)old.remove();
 const block=document.createElement('div');block.id='dg67Panel';block.className='statusline info';block.style.cssText='margin:12px 0;padding:14px;border:1px solid #bcd8ed;border-radius:12px;background:#f5faff;line-height:1.5';
 block.innerHTML='<b>📎 Documento e destinatario</b><p style="margin:6px 0">Destinatario: <b>'+esc(b?.cliente||b?.cliente_nome||'Cliente')+'</b> · WhatsApp <b>+'+esc(phone(b?.telefono))+'</b></p>'+
 '<p style="font-size:12px;margin:5px 0">Su telefono usa «Condividi PDF»: scegli WhatsApp Business e seleziona il cliente. Su PC il gestionale apre la chat con testo pronto e scarica il PDF, ma devi allegarlo manualmente. Nessun invio parte da solo.</p>'+
 '<div id="dg67State" role="status" aria-live="polite" style="font-size:12px;margin:7px 0">PDF in preparazione…</div>';
 body.appendChild(block);
 const share=document.createElement('button');share.type='button';share.id='dg67Share';share.className='btn btn-green';share.disabled=true;share.textContent='📲 Condividi PDF (telefono)';share.addEventListener('click',nativeShare);
 const pc=document.createElement('button');pc.type='button';pc.id='dg67Desktop';pc.className='btn btn-primary';pc.disabled=true;pc.textContent='💻 Apri chat + scarica PDF';pc.addEventListener('click',desktop);
 const down=document.createElement('button');down.type='button';down.id='dg67Download';down.className='btn btn-secondary';down.disabled=true;down.textContent='📄 Scarica solo PDF';down.addEventListener('click',download);
 const inspect=document.createElement('button');inspect.type='button';inspect.id='dg67Preview';inspect.className='btn btn-secondary';inspect.disabled=true;inspect.textContent='👁 Controlla PDF';inspect.addEventListener('click',preview);
 const stored=document.createElement('button');stored.type='button';stored.id='dg67OpenStored';stored.className='btn btn-secondary';stored.disabled=true;stored.textContent='📄 Apri PDF originale';stored.addEventListener('click',openStoredPdf);
 const retry=document.createElement('button');retry.type='button';retry.className='btn btn-secondary';retry.textContent='↻ Riprova caricamento';retry.addEventListener('click',()=>{file=null;storedPdfUrl='';stored.disabled=true;down.disabled=pc.disabled=share.disabled=true;const inspect=el('dg67Preview');if(inspect)inspect.disabled=true;prepare(kind,id,serial)});
 foot.prepend(share,pc,down,inspect,stored,retry);
 prepare(kind,id,serial);
}
function patch(){
 if(typeof window.dg64OpenBooking!=='function'||typeof window.dg64OpenReceipt!=='function')return false;
 if(window.__dg67Patched)return true;
 window.__dg67Patched=true;
 const oldBooking=window.dg64OpenBooking,oldReceipt=window.dg64OpenReceipt;
 window.dg64OpenBooking=function(id){oldBooking.apply(this,arguments);if(el('dg64BookingText'))panel('booking',id)};
 window.dg64OpenReceipt=function(id){oldReceipt.apply(this,arguments);if(el('dg64ReceiptText'))panel('payment',id)};
 return true;
}
if(!patch())document.addEventListener('DOMContentLoaded',()=>{if(!patch())console.warn('DELGROSSO V67: pannello WhatsApp V64 non disponibile')},{once:true});
})();
