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
 '<button type="button" class="btn btn-primary" onclick="dg66ResendEmail()">✉️ Reinvia documento già archiviato</button>';
 parent.after(div);
 $('dg66Kind')?.addEventListener('change',window.dg66RefreshEmail);
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
 if(!row){box.textContent='Seleziona prima un documento.';return}
 const b=type==='booking'?row:findBooking(row.prenotazione_id);
 const hasPdf=!!(type==='booking'?row.confirmation_storage_path:row.receipt_storage_path);
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
const original=window.dg61RenderWhatsApp;
if(typeof original==='function')window.dg61RenderWhatsApp=function(){original.apply(this,arguments);mount()};
let count=0;const timer=setInterval(()=>{mount();if(++count>12)clearInterval(timer)},500);
})();
