/* UI for WhatsApp Cloud API: manual approval only, no automated booking. */
(function(){'use strict';
const $=id=>document.getElementById(id);
let outboundReady=false;
let pendingRequest=null;
let busy=false;
function setStatus(msg,ready){const el=$('dg62WaStatus');if(el){el.textContent=msg;el.className='statusline '+(ready?'live':'warn')};
 const btn=$('dg62ApiSend');if(btn)btn.disabled=!ready;}
window.dg62CheckConnection=async function(){
 try{
  const r=await fetch('/api/whatsapp/status',{cache:'no-store'});
  const data=await r.json();if(!r.ok)throw Error('HTTP '+r.status);
  outboundReady=Boolean(data.outboundReady);
  setStatus(outboundReady?'Cloud API configurata. Invio soltanto con tua conferma.':data.inboundReady?'Ricezione predisposta; invio API in attesa di autorizzazione e modelli Meta.':'Non collegato: completare Meta Coexistence e credenziali Vercel.',outboundReady);
 }catch(e){outboundReady=false;setStatus('Connessione non ancora attiva oppure endpoint da pubblicare.',false)}
};
window.dg62SendTemplate=async function(){
 if(busy||!outboundReady)return;
 const bookingId=$('dg61WaBooking')?.value,kind=$('dg61WaKind')?.value;
 if(!bookingId||!['confirmation','deposit','balance'].includes(kind)){alert('Per l’invio via API seleziona conferma, acconto o saldo. Le ricevute PDF e i gruppi restano gestiti manualmente.');return;}
 const confirmation='Inviare tramite WhatsApp Cloud API un messaggio al cliente selezionato? Sarà usato un modello già approvato su Meta. Non modifica prenotazioni, posti o pagamenti.';
 if(!window.confirm(confirmation))return;
 const auth=(typeof authSession!=='undefined'&&authSession?.access_token)||(typeof supaSession!=='undefined'&&supaSession?.access_token);
 if(!auth){alert('Sessione scaduta: accedi nuovamente al gestionale.');return;}
 if(!pendingRequest||pendingRequest.bookingId!==bookingId||pendingRequest.kind!==kind)pendingRequest={bookingId,kind,id:crypto.randomUUID()};
 const btn=$('dg62ApiSend');if(btn){btn.disabled=true;btn.textContent='Invio in verifica…'}busy=true;
 try{
  const res=await fetch('/api/whatsapp/send-template',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({booking_id:bookingId,kind,request_id:pendingRequest.id}),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Errore Cloud API '+res.status);
  pendingRequest=null;
  alert('Invio richiesto a Meta. Verifica la consegna dalla pagina WhatsApp e dal tuo account Meta.');
 }catch(e){alert('Messaggio non inviato: '+String(e.message||e))}
 finally{busy=false;if(btn){btn.disabled=!outboundReady;btn.textContent='Invia modello approvato (Cloud API)'}}
};
// Never attempt to send on page load; only check readiness once.
/* V63 gratuita: non interrogare Cloud API a ogni apertura. Verifica solo su richiesta. */
})();
