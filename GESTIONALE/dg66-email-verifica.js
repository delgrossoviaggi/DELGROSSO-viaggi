/* DELGROSSO V66 - Ripristino verifica email e reinvio controllato.
 * L'invio email AUTOMATICO richiede worker server + pianificazione.
 * Questo pannello non invia mai senza un clic dell'operatore e non espone password SMTP.
 */
(function(){ 'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const email=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||''));
function mount(){
 const parent=$('dg65CommsPanel')||$('dg61WaInbox')?.parentElement;
 if(!parent||$('dg66EmailPanel'))return;
 const div=document.createElement('div');div.id='dg66EmailPanel';div.className='card';div.style.cssText='margin:12px 0;padding:15px';
 div.innerHTML='<h3 style="margin:0 0 8px">✉️ Conferme e ricevute email</h3>'+
 '<p style="margin:0 0 9px;font-size:13px">Il server può inviare automaticamente quando il servizio email è attivo. Da qui puoi <b>verificare l’esito</b> e richiedere il reinvio di un documento già archiviato, senza WhatsApp API.</p>'+
 '<div class="form-grid"><div class="field"><label>Tipo documento</label><select id="dg66Kind"><option value="booking">Conferma prenotazione</option><option value="payment">Ricevuta acconto / saldo</option></select></div>'+
 '<div class="field"><label>Riferimento</label><select id="dg66Target"><option value="">— Scegli una prenotazione —</option></select></div></div>'+
 '<label id="dg66MissingOnlyWrap" style="display:flex;align-items:center;gap:8px;margin:9px 0"><input type="checkbox" id="dg66MissingOnly"> <span id="dg66MissingLabel">Mostra solo conferme senza percorso PDF</span> <strong id="dg66MissingCount" style="font-size:12px"></strong></label>'+ 
 '<div id="dg66EmailState" class="statusline info" style="margin:10px 0">Seleziona una prenotazione per verificare email e PDF.</div>'+
 '<button type="button" class="btn btn-secondary" onclick="dg66RefreshEmail()">↻ Controlla email</button> '+
 '<button type="button" id="dg66SmtpCheck" class="btn btn-secondary" onclick="dg66CheckSmtp()">🔒 Verifica connessione SMTP</button> '+
 '<button type="button" id="dg66ResendBtn" class="btn btn-primary" onclick="dg66ResendEmail()">✉️ Reinvia documento già archiviato</button> '+
 '<button type="button" id="dg66GenerateMissing" class="btn btn-secondary" onclick="dg66GenerateMissing()" style="display:none">📄 Archivia conferma non ancora generata</button> '+
 '<button type="button" id="dg66OpenDocument" class="btn btn-secondary" onclick="dg66OpenDocument()" style="display:none">👁 Apri e verifica PDF</button>';
 parent.after(div);
 $('dg66Kind')?.addEventListener('change',window.dg66RefreshEmail);
 $('dg66Target')?.addEventListener('change',window.dg66RefreshEmail);
 $('dg66MissingOnly')?.addEventListener('change',window.dg66RefreshEmail);
 fill();
}
function bookList(){return (typeof state==='undefined'?[]:state.prenotazioni||[]).filter(b=>!b.riserva_aziendale).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
function payList(){return (typeof state==='undefined'?[]:state.pagamenti||[]).filter(p=>/^(acconto|saldo|rimborso)$/i.test(String(p.tipo||''))&&/^registrato$/i.test(String(p.stato||''))).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,150)}
function findBooking(id){return (typeof state==='undefined'?[]:state.prenotazioni||[]).find(b=>b.id===id)}
function fill(){const type=$('dg66Kind')?.value||'booking',target=$('dg66Target');if(!target)return;const val=target.value;
 const allBookings=bookList(),allPayments=payList(),showMissing=!!$('dg66MissingOnly')?.checked;
 const rows=type==='booking'?(showMissing?allBookings.filter(x=>!x.confirmation_storage_path):allBookings)
    :(showMissing?allPayments.filter(x=>!(x.receipt_professional_path||x.receipt_storage_path)):allPayments);
 const missingCount=type==='booking'
  ?allBookings.filter(x=>!x.confirmation_storage_path).length
  :allPayments.filter(x=>!(x.receipt_professional_path||x.receipt_storage_path)).length;
 const badge=$('dg66MissingCount');if(badge)badge.textContent='('+missingCount+' da verificare)';
 const label=$('dg66MissingLabel');if(label)label.textContent=type==='booking'?'Mostra solo conferme senza percorso PDF':'Mostra solo pagamenti senza percorso PDF';
 const wrap=$('dg66MissingOnlyWrap');if(wrap)wrap.style.display='flex';
 target.innerHTML='<option value="">— Scegli un documento —</option>'+rows.map(x=>{
 const b=type==='booking'?x:findBooking(x.prenotazione_id);return '<option value="'+esc(x.id)+'">'+esc((b?.cliente||b?.cliente_nome||x.cliente||'Cliente')+' · '+(type==='payment'?String(x.tipo||'')+' '+String(x.receipt_number||''):(x.codice||x.confirmation_number||'Prenotazione'))).slice(0,105)+'</option>'}).join('');
 if(rows.some(x=>x.id===val))target.value=val;
}
window.dg66RefreshEmail=function(){fill();const type=$('dg66Kind')?.value||'booking',id=$('dg66Target')?.value,box=$('dg66EmailState');if(!box)return;
 const row=type==='booking'?bookList().find(x=>x.id===id):payList().find(x=>x.id===id);
 if(!row){box.textContent='Seleziona prima un documento.';const button=$('dg66GenerateMissing');if(button)button.style.display='none';const open=$('dg66OpenDocument');if(open)open.style.display='none';const resend=$('dg66ResendBtn');if(resend)resend.disabled=true;return}
 const b=type==='booking'?row:findBooking(row.prenotazione_id);
 const hasPdf=!!(type==='booking'?row.confirmation_storage_path:(row.receipt_professional_path||row.receipt_storage_path));
 const previouslyGenerated=type==='booking'&&!!row.confirmation_generated_at;
 const button=$('dg66GenerateMissing');
 if(button){
  button.style.display=type==='booking'&&!hasPdf?'inline-flex':'none';
  button.disabled=!!previouslyGenerated;
  button.title=previouslyGenerated?'La generazione è già registrata: verifica prima l’archivio per evitare documenti duplicati.':
   'Crea un documento soltanto se non risulta alcuna generazione precedente.';
 }
 const open=$('dg66OpenDocument');if(open)open.style.display=hasPdf?'inline-flex':'none';
 const refund=type==='payment'&&/^rimborso$/i.test(String(row.tipo||''));
 const resend=$('dg66ResendBtn');if(resend){
  resend.disabled=!hasPdf||refund;resend.title=refund?'Rimborso: verifica l’archivio e contatta il cliente; reinvio non previsto.':(!hasPdf?'Nessun documento PDF registrato.':'Reinvio manuale del documento esistente');
 }
 const sent=(type==='booking'?row.confirmation_email_sent:row.receipt_email_sent)===true;
 const err=type==='booking'?row.confirmation_email_error:row.receipt_email_error;
 box.innerHTML='<b>Destinatario:</b> '+esc(b?.email||'mancante')+
  ' · <b>PDF:</b> '+(hasPdf?'percorso archiviato; apri per verificare':(previouslyGenerated?'GENERATO in precedenza, ma SENZA percorso archiviato: verifica prima di emettere nuovamente':'Non risulta generato né archiviato'))+
  ' · <b>Tipo:</b> '+esc(type==='booking'?'Conferma':row.tipo||'Pagamento')+
  ' · <b>Invio:</b> '+(sent?'segnato come inviato':'non verificato')+
  (err?'<div style="color:#a12">Errore: '+esc(err).slice(0,200)+'</div>':'')+
  (refund?'<p style="font-size:12px">I rimborsi richiedono una verifica contabile distinta. Nessun reinvio email automatico è previsto per questa voce.</p>':
   '<p style="font-size:12px">Il percorso PDF non dimostra l’avvenuta consegna. Controlla il file prima dell’eventuale reinvio manuale; non creare duplicati.</p>');
};
// Opens a read-only review list from the V76 integrity panel.
window.dg66OpenMissing=function(kind='booking'){
 mount();
 const panel=$('dg66EmailPanel');
 if(!panel)return false;
 const type=$('dg66Kind');if(type)type.value=kind==='payment'?'payment':'booking';
 const only=$('dg66MissingOnly');if(only)only.checked=true;
 window.dg66RefreshEmail();
 panel.scrollIntoView?.({behavior:'smooth',block:'start'});
 return true;
};
let viewingDocument=false;
window.dg66OpenDocument=async function(){
 if(viewingDocument)return;
 const kind=$('dg66Kind')?.value||'booking',id=$('dg66Target')?.value;
 const row=(kind==='booking'?bookList():payList()).find(x=>x.id===id);
 if(!row)return alert('Seleziona una prenotazione o un pagamento.');
 const path=kind==='booking'?row.confirmation_storage_path:(row.receipt_professional_path||row.receipt_storage_path);
 if(!path)return alert('Nessun PDF archiviato per questo documento.');
 if(typeof SUPA_URL==='undefined'||typeof accessHeaders!=='function')return alert('Sessione gestionale non disponibile.');
 // Open the blank tab synchronously, within the user's click, to avoid iOS/Safari pop-up blocking.
 const tab=window.open('about:blank','_blank');
 const btn=$('dg66OpenDocument'),box=$('dg66EmailState');
 viewingDocument=true;if(btn)btn.disabled=true;
 if(tab){tab.document.title='Verifica PDF DELGROSSO';tab.document.body.textContent='Preparazione del documento PDF...';}
 try{
  // Read an existing archived PDF through operator-only Supabase Storage.
  // This avoids an extra Edge Function request which can fail on iPhone.
  const clean=String(path).trim();
  if(!clean||clean.startsWith('/')||clean.includes('\\')||clean.split('/').some(x=>!x||x==='..'||x==='.'))
    throw Error('Percorso del documento non valido.');
  const objectPath=clean.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(SUPA_URL+'/storage/v1/object/sign/ricevute-prenotazioni/'+objectPath,{
   method:'POST',headers:{...accessHeaders(),'Content-Type':'application/json'},
   body:JSON.stringify({expiresIn:600}),cache:'no-store'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||data.message||'Servizio archivio non disponibile: HTTP '+response.status);
  let signed=String(data.signedURL||data.signedUrl||'');
  if(signed.startsWith('/object/sign/'))signed=SUPA_URL+'/storage/v1'+signed;
  else if(signed.startsWith('/storage/v1/'))signed=SUPA_URL+signed;
  const url=new URL(signed, SUPA_URL);
  if(url.protocol!=='https:'||url.origin!==new URL(SUPA_URL).origin||!url.pathname.startsWith('/storage/v1/object/sign/ricevute-prenotazioni/')||!url.searchParams.has('token'))
   throw Error('Collegamento PDF non valido.');
  if(tab)tab.location.replace(url.href);else window.location.assign(url.href);
  if(box)box.textContent='PDF aperto per il controllo. Verifica contenuto e importi prima di reinviare.';
 }catch(e){
  if(tab)tab.close();
  if(box)box.textContent='⚠ Apertura del PDF non riuscita: '+(e.message||String(e));
 }finally{viewingDocument=false;if(btn)btn.disabled=false;}
};
let smtpCheckRunning=false;
window.dg66CheckSmtp=async function(){
 if(smtpCheckRunning)return;
 const box=$('dg66EmailState'),btn=$('dg66SmtpCheck');
 smtpCheckRunning=true;if(btn)btn.disabled=true;
 if(box)box.textContent='Verifica connessione SMTP in corso: non viene inviata alcuna email...';
 try{
  if(typeof SUPA_URL==='undefined'||typeof accessHeaders!=='function')throw Error('Sessione operatore non disponibile.');
  const response=await fetch(SUPA_URL+'/functions/v1/send-booking-confirmation',{
   method:'POST',headers:{...accessHeaders(),'Content-Type':'application/json'},
   body:JSON.stringify({action:'smtp_check'}),cache:'no-store'
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.success)throw Error(result.error||'Il server SMTP non risponde.');
  if(box)box.textContent='✅ Connessione e autenticazione SMTP verificate. Nessuna email è stata inviata. La consegna delle email reali resta da collaudare.';
 }catch(error){
  if(box)box.textContent='⚠ Verifica SMTP non superata: '+(error.message||String(error));
 }finally{smtpCheckRunning=false;if(btn)btn.disabled=false;}
};
let emailSending=false;
window.dg66ResendEmail=async function(){
 if(emailSending)return;
 const kind=$('dg66Kind')?.value||'booking',id=$('dg66Target')?.value;
 const p=payList().find(x=>x.id===id),b=kind==='booking'?findBooking(id):findBooking(p?.prenotazione_id),r=kind==='booking'?b:p;
 if(!r||!b)return alert('Seleziona un documento.');
 if(kind==='payment'&&/^rimborso$/i.test(String(r.tipo||'')))return alert('Il reinvio automatico non è previsto per i rimborsi. Verifica prima la documentazione contabile.');
 if(!email(b.email))return alert('Il cliente non ha un indirizzo email valido.');
 const path=kind==='booking'?r.confirmation_storage_path:(r.receipt_professional_path||r.receipt_storage_path);
 if(!path)return alert('PDF non archiviato: genera prima la conferma o la ricevuta reale dal gestionale.');
 if(!confirm('Inviare nuovamente il documento già archiviato a '+b.email+'?'))return;
 const box=$('dg66EmailState');if(box)box.textContent='Invio in corso...';
 emailSending=true;
 const resendButton=$('dg66ResendBtn');
 if(resendButton)resendButton.disabled=true;
 try{
  if(typeof SUPA_URL==='undefined'||typeof accessHeaders!=='function')throw Error('Sessione gestionale non disponibile');
  const endpoint=kind==='booking'?'send-booking-confirmation':'send-payment-receipt';
  const resp=await fetch(SUPA_URL+'/functions/v1/'+endpoint,{method:'POST',headers:accessHeaders(),body:JSON.stringify(kind==='booking'?{action:'resend_email',bookingId:id}:{action:'resend_email',paymentId:id})});
  const out=await resp.json().catch(()=>({}));if(!resp.ok||!out.success||!out.emailSent)throw Error(out.error||'Invio non confermato');
  if(box)box.textContent='✅ Il server SMTP ha accettato l’email; controlla la casella del cliente per la consegna effettiva.';
  // Refresh underlying data only on explicit action.
  if(typeof loadAll==='function')await loadAll(true);
 }catch(e){if(box)box.textContent='⚠ Invio non riuscito: '+(e.message||String(e));}
 finally{emailSending=false;if(resendButton)resendButton.disabled=false;}
};

let creatingConfirmation=false;
function bookingReceiptData(b,tr){
 const name=String(b.cliente_nome||b.cliente||'Cliente').trim();
 const seats=String(b.posti_selezionati||'').split(',').map(x=>Number(x.trim())).filter(n=>Number.isSafeInteger(n)&&n>0);
 const count=Math.max(seats.length,Number(b.posti||0),1);
 const total=Number(b.totale||0);
 let date='';
 try{if(tr.data_partenza)date=new Date(String(tr.data_partenza).slice(0,10)+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});}catch{}
 return {
  riferimento:String(b.confirmation_number||b.id_prenotazione||b.codice||''),
  viaggio:String(tr.titolo||tr.destinazione||b.viaggio_codice||'Viaggio DELGROSSO'),
  data:date,ora:String(tr.ora_partenza||'').slice(0,5),
  nome:name,cognome:'',telefono:String(b.telefono||''),
  fermataPartenza:String(b.fermata_partenza||'Da verificare'),
  numeroPosti:count,posti:seats,
  prezzo:count?total/count:0,totale:total
 };
}
async function ensureReceiptGenerator(){
 if(window.DGReceipt?.generate)return window.DGReceipt;
 const sources=['/js/ricevuta.js?v=70','https://www.delgrossoviaggi.it/js/ricevuta.js?v=70'];
 for(const source of sources){
  try{
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=source;
    script.onload=resolve;
    script.onerror=()=>reject(new Error('Script PDF non disponibile.'));
    document.head.appendChild(script);
   });
   if(window.DGReceipt?.generate)return window.DGReceipt;
  }catch(e){console.warn('Generatore PDF: fonte non raggiungibile',e)}
 }
 throw new Error('Generatore PDF non inizializzato.');
 return window.DGReceipt;
}
window.dg66GenerateMissing=async function(){
 if(creatingConfirmation)return;
 if($('dg66Kind')?.value!=='booking')return alert('Scegli una conferma di prenotazione.');
 const bookingId=$('dg66Target')?.value;
 const local=bookList().find(b=>b.id===bookingId);
 if(!local)return alert('Seleziona una prenotazione.');
 if(local.confirmation_storage_path)return alert('La conferma risulta già archiviata: usa il reinvio.');
 if(local.confirmation_generated_at)return alert('La conferma risulta già generata, ma manca il percorso archiviato. Non creare un duplicato: controlla prima l’archivio storico e gli invii.');
 const destination=String(local.email||'').trim();
 if(!confirm('Rigenerare e archiviare la conferma della prenotazione '+(local.codice||local.confirmation_number||'')+'?'+(email(destination)?'\nIl server tenterà anche l’invio a '+destination+'.':'\nSenza email valida, il documento sarà soltanto archiviato.')+'\nQuesta operazione NON crea una nuova prenotazione e NON cambia i posti.'))return;
 const box=$('dg66EmailState'),button=$('dg66GenerateMissing');
 creatingConfirmation=true;if(button)button.disabled=true;
 if(box)box.textContent='Rigenerazione PDF in corso, senza modificare i posti...';
 try{
  if(typeof SUPA_URL==='undefined'||typeof accessHeaders!=='function')throw new Error('Sessione gestionale non disponibile.');
  const endpoint=SUPA_URL+'/functions/v1/send-booking-confirmation';
  const headers=()=>({...accessHeaders(),'Content-Type':'application/json'});
  const context=await fetch(endpoint,{method:'POST',headers:headers(),body:JSON.stringify({action:'context',bookingId})});
  const info=await context.json().catch(()=>({}));
  if(!context.ok||!info.success)throw new Error(info.error||'Impossibile verificare la prenotazione.');
  if(info.booking?.confirmation_storage_path)throw new Error('Una conferma è già archiviata. Controlla il documento prima di procedere.');
  if(info.booking?.confirmation_generated_at)throw new Error('Generazione precedente rilevata dal server: emissione bloccata per evitare duplicati.');
  const generator=await ensureReceiptGenerator();
  const pdf=await generator.generate(bookingReceiptData(info.booking||{},info.trip||{}));
  const raw=new Uint8Array(await pdf.arrayBuffer());
  let binary='';for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));
  const issued=await fetch(endpoint,{method:'POST',headers:headers(),body:JSON.stringify({action:'issue',bookingId,pdfBase64:btoa(binary)})});
  const out=await issued.json().catch(()=>({}));
  if(!issued.ok||!out.success)throw new Error(out.error||'Archiviazione PDF non riuscita.');
  if(box)box.textContent=out.emailSent?'✅ Conferma PDF rigenerata e archiviata. Invio accettato dal server SMTP (consegna da verificare).':'✅ Conferma PDF rigenerata e archiviata. Email non confermata: controlla gli indirizzi e lo stato invio.';
  if(typeof loadAll==='function')await loadAll(true);
 }catch(e){if(box)box.textContent='⚠ Recupero conferma non riuscito: '+(e.message||String(e));}
 finally{creatingConfirmation=false;if(button)button.disabled=false;}
};
const original=window.dg61RenderWhatsApp;
if(typeof original==='function')window.dg61RenderWhatsApp=function(){original.apply(this,arguments);mount()};
function initializeEmailPanel(){
 mount();
 if($('dg66EmailPanel'))return;
 // Observe lazy-loaded WhatsApp panel without polling on mobile devices.
 const observer=new MutationObserver(()=>{
  mount();
  if($('dg66EmailPanel'))observer.disconnect();
 });
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeEmailPanel,{once:true});
else initializeEmailPanel();
})();
