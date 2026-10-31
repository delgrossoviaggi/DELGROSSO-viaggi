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
 '<div id="dg66EmailState" class="statusline info" style="margin:10px 0">Seleziona una prenotazione per verificare email e PDF.</div>'+
 '<button type="button" class="btn btn-secondary" onclick="dg66RefreshEmail()">↻ Controlla email</button> '+
 '<button type="button" class="btn btn-primary" onclick="dg66ResendEmail()">✉️ Reinvia documento già archiviato</button> '+
 '<button type="button" id="dg66GenerateMissing" class="btn btn-secondary" onclick="dg66GenerateMissing()" style="display:none">📄 Rigenera conferma PDF mancante</button>';
 parent.after(div);
 $('dg66Kind')?.addEventListener('change',window.dg66RefreshEmail);
 $('dg66Target')?.addEventListener('change',window.dg66RefreshEmail);
 fill();
}
function bookList(){return (typeof state==='undefined'?[]:state.prenotazioni||[]).filter(b=>!b.riserva_aziendale).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,100)}
function payList(){return (typeof state==='undefined'?[]:state.pagamenti||[]).filter(p=>/^(acconto|saldo)$/i.test(String(p.tipo||''))&&/^registrato$/i.test(String(p.stato||''))).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,150)}
function findBooking(id){return (typeof state==='undefined'?[]:state.prenotazioni||[]).find(b=>b.id===id)}
function fill(){const type=$('dg66Kind')?.value||'booking',target=$('dg66Target');if(!target)return;const val=target.value;
 const rows=type==='booking'?bookList():payList();
 target.innerHTML='<option value="">— Scegli un documento —</option>'+rows.map(x=>{
 const b=type==='booking'?x:findBooking(x.prenotazione_id);return '<option value="'+esc(x.id)+'">'+esc((b?.cliente||b?.cliente_nome||x.cliente||'Cliente')+' · '+(type==='payment'?String(x.tipo||'')+' '+String(x.receipt_number||''):(x.codice||x.confirmation_number||'Prenotazione'))).slice(0,105)+'</option>'}).join('');
 if(rows.some(x=>x.id===val))target.value=val;
}
window.dg66RefreshEmail=function(){fill();const type=$('dg66Kind')?.value||'booking',id=$('dg66Target')?.value,box=$('dg66EmailState');if(!box)return;
 const row=type==='booking'?bookList().find(x=>x.id===id):payList().find(x=>x.id===id);
 if(!row){box.textContent='Seleziona prima un documento.';const button=$('dg66GenerateMissing');if(button)button.style.display='none';return}
 const b=type==='booking'?row:findBooking(row.prenotazione_id);
 const hasPdf=!!(type==='booking'?row.confirmation_storage_path:row.receipt_storage_path);
 const button=$('dg66GenerateMissing');if(button)button.style.display=type==='booking'&&!hasPdf?'inline-flex':'none';
 const sent=(type==='booking'?row.confirmation_email_sent:row.receipt_email_sent)===true;
 const err=type==='booking'?row.confirmation_email_error:row.receipt_email_error;
 box.innerHTML='<b>Destinatario:</b> '+esc(b?.email||'mancante')+' · <b>PDF:</b> '+(hasPdf?'archiviato':'da generare')+' · <b>Invio:</b> '+(sent?'segnato come inviato':'non verificato')+(err?'<div style="color:#a12">Errore: '+esc(err).slice(0,200)+'</div>':'')+'<p style="font-size:12px">Un invio già tentato non viene ripetuto automaticamente; il reinvio richiede un clic e un PDF esistente.</p>';
};
let emailSending=false;
window.dg66ResendEmail=async function(){
 if(emailSending)return;
 const kind=$('dg66Kind')?.value||'booking',id=$('dg66Target')?.value;
 const p=payList().find(x=>x.id===id),b=kind==='booking'?findBooking(id):findBooking(p?.prenotazione_id),r=kind==='booking'?b:p;
 if(!r||!b)return alert('Seleziona un documento.');
 if(!email(b.email))return alert('Il cliente non ha un indirizzo email valido.');
 const path=kind==='booking'?r.confirmation_storage_path:r.receipt_storage_path;
 if(!path)return alert('PDF non archiviato: genera prima la conferma o la ricevuta reale dal gestionale.');
 if(!confirm('Inviare nuovamente il documento già archiviato a '+b.email+'?'))return;
 const box=$('dg66EmailState');if(box)box.textContent='Invio in corso...';
 emailSending=true;
 const resendButton=$('dg66EmailPanel')?.querySelector('button[onclick="dg66ResendEmail()"]');
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
 await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='/js/ricevuta.js?v=69';
  script.onload=resolve;
  script.onerror=()=>reject(new Error('Generatore PDF non disponibile sul sito.'));
  document.head.appendChild(script);
 });
 if(!window.DGReceipt?.generate)throw new Error('Generatore PDF non inizializzato.');
 return window.DGReceipt;
}
window.dg66GenerateMissing=async function(){
 if(creatingConfirmation)return;
 if($('dg66Kind')?.value!=='booking')return alert('Scegli una conferma di prenotazione.');
 const bookingId=$('dg66Target')?.value;
 const local=bookList().find(b=>b.id===bookingId);
 if(!local)return alert('Seleziona una prenotazione.');
 if(local.confirmation_storage_path)return alert('La conferma risulta già archiviata: usa il reinvio.');
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
