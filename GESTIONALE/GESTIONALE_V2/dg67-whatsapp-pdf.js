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
const notice=(message,success)=>{const box=el('dg67State');if(box)box.textContent=message;if(success!=null&&typeof window.toast==='function')window.toast(message,success)};
const fname=s=>String(s||'DELGROSSO_Documento.pdf').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
function msg(){return el(selected?.kind==='booking'?'dg64BookingText':'dg64ReceiptText')?.value?.trim()||''}
function chat(){
 if(!selected)return;
 const tel=phone(selected.tel),message=msg();
 if(!tel||!message){notice('Numero o messaggio non valido.',false);return}
 // Per WhatsApp Web si possono precompilare testo e numero; allegati non supportati.
 const a=document.createElement('a');a.href='https://wa.me/'+tel+'?text='+encodeURIComponent(message);a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
}
async function fetchSigned(kind,id){
 if(typeof SUPA_URL==='undefined'||typeof accessHeaders!=='function')throw Error('Sessione gestionale non disponibile');
 let endpoint,payload;
 if(kind==='booking'){
   endpoint='dg67-booking-pdf';payload={bookingId:id};
 }else{
   const p=payment(id);
   if(!p)throw Error('Pagamento non trovato');
   // Evita doppie emissioni se un altro operatore ha gia generato la ricevuta.
   if(typeof api==='function'){
     const latest=await api('pagamenti','id=eq.'+encodeURIComponent(id)+'&select=id,receipt_professional_path,receipt_number',{noCache:true});
     if(Array.isArray(latest)&&latest[0]){
       p.receipt_professional_path=latest[0].receipt_professional_path||null;
       p.receipt_number=latest[0].receipt_number||p.receipt_number;
     }
   }
   if(p.receipt_professional_path){
     // Documento professionale gia archiviato: NON rigenerare e NON creare una nuova versione.
     endpoint='send-payment-receipt';payload={action:'signed_url',path:p.receipt_professional_path};
   }else{
     // Prima emissione PDF professionale, solo se non esiste.
     endpoint='professional-receipts';payload={action:'generate',kind:'trip',id,reissue:false};
   }
 }
 const resp=await fetch(`${SUPA_URL}/functions/v1/${endpoint}`,{method:'POST',headers:accessHeaders(),body:JSON.stringify(payload),cache:'no-store'});
 const out=await resp.json().catch(()=>({}));
 if(!resp.ok||!out.success||!out.signedUrl)throw Error(out.error||`Impossibile ottenere il PDF (HTTP ${resp.status})`);
 if(kind==='payment'&&out.path){const p=payment(id);if(p)p.receipt_professional_path=out.path;}
 return out;
}
async function prepare(kind,id,key){
 notice('Preparazione del documento PDF in corso…');
 try{
  const response=await fetchSigned(kind,id);
  const r=await fetch(response.signedUrl,{cache:'no-store'});
  if(!r.ok)throw Error('Documento non scaricabile (HTTP '+r.status+')');
  const blob=await r.blob();
  if(blob.size<150||blob.size>15*1024*1024)throw Error('Dimensione del documento non valida');
  const type=blob.type||'application/pdf';
  if(!/pdf/i.test(type))throw Error('Il documento restituito non è un PDF');
  if(key!==requestSerial||!modalActive())return;
  fileName=fname(response.filename||(kind==='booking'?'DELGROSSO_Conferma_'+id.slice(0,8)+'.pdf':'DELGROSSO_Ricevuta_'+id.slice(0,8)+'.pdf'));
  file=new File([blob],fileName,{type:'application/pdf'});
  const down=el('dg67Download'),share=el('dg67Share'),pc=el('dg67Desktop');
  if(down)down.disabled=false;
  if(share){
    const supported=typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[file]});
    share.disabled=!supported;
    share.style.display=supported?'':'none';
  }
  if(pc)pc.disabled=false;
  notice('✅ PDF pronto: '+fileName+'. Nessun messaggio è stato inviato.');
 }catch(error){
  if(key!==requestSerial||!modalActive())return;
  file=null;fileName='';notice('⚠️ PDF non disponibile: '+String(error.message||error)+'. Usa il pulsante originale “Apri PDF” o verifica il server.',false);
 }
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
 selected={kind,id,tel:b?.telefono};file=null;fileName='';
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
 const retry=document.createElement('button');retry.type='button';retry.className='btn btn-secondary';retry.textContent='↻ Rigenera PDF';retry.addEventListener('click',()=>{file=null;down.disabled=pc.disabled=share.disabled=true;prepare(kind,id,serial)});
 foot.prepend(share,pc,down,retry);
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
