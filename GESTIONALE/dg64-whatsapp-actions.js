/* DELGROSSO V64 — invio assistito da WhatsApp Business, senza Cloud API.
   Non invia messaggi automaticamente, non cambia prenotazioni o incassi.
   Solo le pagine del gestionale: prenotazioni, pagamenti, WhatsApp.
*/
(function(){
'use strict';
const $=id=>document.getElementById(id);
const getState=()=>typeof state!=='undefined'?state:null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const d=s=>String(s||'').slice(0,10);
function tel(v){
 let n=String(v||'').replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);
 if(n.length===10 && n.startsWith('3'))n='39'+n;
 return /^39[0-9]{9,12}$/.test(n)?n:'';
}
const getB=id=>(getState()?.prenotazioni||[]).find(b=>b.id===id);
const getP=id=>(getState()?.pagamenti||[]).find(p=>p.id===id);
const getTrip=b=>(getState()?.viaggi||[]).find(t=>t.id===b?.viaggio_id);
const active=b=>b&&!b.riserva_aziendale&&!/annull|cancel|storn|rimbors/i.test(String(b.stato||''));
function tripName(b){const t=getTrip(b);return t?.titolo||t?.destinazione||'viaggio'}
function seats(b){const s=b?.posti_selezionati;return (Array.isArray(s)?s.join(', '):String(s||'')).trim()||'da verificare'}
function reference(b){return b?.confirmation_number||b?.codice||b?.id_prenotazione||String(b?.id||'').slice(0,8)}
function confirmationText(b){
 const t=getTrip(b),confirmed=/conferm/i.test(String(b.stato||'')),date=d(t?.data_partenza);
 return `DELGROSSO VIAGGI & LIMOUSINE BUS\nWhatsApp ufficiale: +39 320 881 5899\n\nGentile ${b.cliente||b.cliente_nome||'Cliente'},\n${confirmed?'ti confermiamo la prenotazione':'la tua richiesta di prenotazione è stata registrata ed è in attesa di conferma'} ${reference(b)} per ${tripName(b)}${date?' del '+date:''}.\nPartecipanti: ${Number(b.posti)||0}\nPosti: ${seats(b)}\nFermata: ${b.fermata_partenza||'da definire'}\nTotale: ${euro(b.totale)}\nPagato: ${euro(b.pagato)}\nResiduo: ${euro(b.saldo)}\n\nIn allegato trovi il documento di prenotazione, se disponibile. Per informazioni rispondi qui.`;
}
function receiptText(p,b){
 const type=String(p.tipo||'pagamento').toLowerCase();return `DELGROSSO VIAGGI & LIMOUSINE BUS\nWhatsApp ufficiale: +39 320 881 5899\n\nGentile ${b.cliente||b.cliente_nome||'Cliente'},\nabbiamo registrato ${type} di ${euro(p.importo)}${p.data_pagamento?' in data '+d(p.data_pagamento):''} per la prenotazione ${reference(b)} relativa a ${tripName(b)}.\nTi inviamo in allegato la relativa ricevuta.\n\nDELGROSSO VIAGGI & LIMOUSINE BUS`;
}
function modal(title,body,footer){
 if(typeof window.openModal!=='function')return alert('Apri la sezione WhatsApp Business nel menu del gestionale.');
 window.openModal(title,body,footer);
}
function msgPreview(id,text){return `<div class="dg64-wa-head"><strong>WhatsApp Business ufficiale</strong><span>320 881 5899</span></div>
 <p class="dg64-wa-step">Il gestionale non invia messaggi automaticamente. Salva il PDF e allegalo nella chat <b>prima di premere Invia</b>.</p>
 <div class="field full"><label for="${id}">Messaggio personalizzato (puoi modificarlo)</label><textarea id="${id}" rows="9" class="dg64-preview">${esc(text)}</textarea></div>
 <p class="dg64-wa-info">Controlla che la chat venga aperta dall'account <b>WhatsApp Business DELGROSSO 320 881 5899</b>, non da un WhatsApp personale.</p>`}
function openChat(to,id){
 const msg=$(id)?.value?.trim()||'';
 if(!tel(to)||!msg)return window.toast?.('Controlla numero e messaggio.',false);
 const url='https://wa.me/'+tel(to)+'?text='+encodeURIComponent(msg);
 // Un clic apre la chat; l'operatore sceglie l'account Business e invia manualmente.
 const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
}
window.dg64OpenBooking=function(id){
 const b=getB(id);if(!active(b))return window.toast?.('Prenotazione non contattabile.',false);
 if(!tel(b.telefono))return window.toast?.('Manca un numero WhatsApp valido per questa prenotazione.',false);
 const confirmed=/conferm/i.test(String(b.stato||''));
 const notice=confirmed?'<div class="statusline info">Prenotazione confermata nel gestionale.</div>':'<div class="statusline warn">La prenotazione non è confermata: il testo indica solo una richiesta registrata.</div>';
 modal('💬 WhatsApp · '+(confirmed?'Conferma prenotazione':'Richiesta prenotazione'),notice+msgPreview('dg64BookingText',confirmationText(b)),
 `<button class="btn btn-secondary" onclick="printConfirmation('${id}')">📄 Apri conferma / Salva PDF</button><button class="btn btn-secondary" onclick="dg64Copy('dg64BookingText')">Copia testo</button><button class="btn btn-green" onclick="dg64ChatBooking('${id}')">💬 Apri chat del cliente</button>`);
};
window.dg64ChatBooking=function(id){const b=getB(id);if(!active(b))return;openChat(b.telefono,'dg64BookingText')};
window.dg64OpenReceipt=function(id){
 const p=getP(id),b=p?.prenotazione_id?getB(p.prenotazione_id):null;
 if(!p||!b||p.prenotazione_id!==b.id)return window.toast?.('Pagamento non associato a una prenotazione: prima verifica i dati.',false);
 if(!active(b)||!/^[0-9a-f-]{36}$/i.test(id))return window.toast?.('Ricevuta non disponibile per la prenotazione selezionata.',false);
 if(!tel(b.telefono))return window.toast?.('Manca il telefono del cliente.',false);
 if(Number(p.importo)<=0 || /rimbors|annull|storn|failed|rifiutat/i.test(String(p.tipo||'')+' '+String(p.stato||'')))return window.toast?.('Non è possibile inviare una ricevuta per un pagamento non valido.',false);
 const label=p.receipt_number||p.ricevuta||'Pagamento '+String(id).slice(0,8);
 modal('🧾 WhatsApp · Ricevuta '+String(label),
 `<div class="statusline info"><b>Pagamento registrato:</b> ${esc(p.tipo||'Pagamento')} · ${euro(p.importo)} · ${esc(tripName(b))}</div>`+
 msgPreview('dg64ReceiptText',receiptText(p,b))+
 '<div class="dg64-wa-info">📎 <b>Passaggio obbligatorio:</b> premi “Apri ricevuta”, salva/condividi il PDF reale e allegalo nella chat del cliente. Il link WhatsApp da solo <b>non allega file</b>.</div>',
 `<button class="btn btn-secondary" onclick="printReceipt('${id}')">📄 Apri ricevuta PDF</button><button class="btn btn-secondary" onclick="dg64Copy('dg64ReceiptText')">Copia testo</button><button class="btn btn-green" onclick="dg64ChatReceipt('${id}')">💬 Apri chat del cliente</button>`);
};
window.dg64ChatReceipt=function(id){const p=getP(id),b=p?.prenotazione_id?getB(p.prenotazione_id):null;if(!p||!active(b))return;openChat(b.telefono,'dg64ReceiptText')};
window.dg64Copy=async function(id){const value=$(id)?.value||'';if(!value)return;try{await navigator.clipboard.writeText(value);window.toast?.('Testo copiato')}catch{window.prompt('Copia il testo',value)}};
function bookingButtons(){const table=$('bookingsTable');if(!table)return;
 for(const tr of table.querySelectorAll('tr')){
  if(tr.querySelector('.dg64-wa-btn'))continue;
  const btn=tr.querySelector('button[onclick^="openBookingModal("]');const id=btn?.getAttribute('onclick')?.match(/openBookingModal\(['"]([^'"]+)['"]\)/)?.[1];
  const b=getB(id);if(!active(b)||!tel(b.telefono))continue;
  const el=document.createElement('button');el.type='button';el.className='btn btn-green btn-sm dg64-wa-btn';el.textContent='💬 WhatsApp';el.setAttribute('aria-label','Prepara conferma WhatsApp per '+(b.cliente||'cliente'));el.addEventListener('click',()=>window.dg64OpenBooking(id));
  tr.lastElementChild?.append(' ',el);
 }
}
function paymentButtons(){const table=$('paymentsTable');if(!table)return;
 for(const tr of table.querySelectorAll('tr')){
  if(tr.querySelector('.dg64-wa-btn'))continue;
  const btn=tr.querySelector('button[onclick^="openEditPaymentModal("]');const id=btn?.getAttribute('onclick')?.match(/openEditPaymentModal\(['"]([^'"]+)['"]\)/)?.[1];
  const p=getP(id),b=p?.prenotazione_id?getB(p.prenotazione_id):null;
  if(!p||!active(b)||!tel(b.telefono)||Number(p.importo)<=0||/rimbors|annull|storn|rifiutat|failed/i.test(String(p.tipo||'')+' '+String(p.stato||'')))continue;
  const el=document.createElement('button');el.type='button';el.className='btn btn-green btn-sm dg64-wa-btn';el.textContent='💬 Invia ricevuta';el.setAttribute('aria-label','Prepara invio ricevuta WhatsApp');el.addEventListener('click',()=>window.dg64OpenReceipt(id));
  tr.lastElementChild?.append(' ',el);
 }
}
function quickAccess(){
 for(const page of ['prenotazioni','pagamenti']){
  const root=$('page-'+page),t=root?.querySelector('.section-title');if(!t||root.querySelector('.dg64-quick'))continue;
  const b=document.createElement('button');b.type='button';b.className='btn btn-green btn-sm dg64-quick';b.textContent='💬 Centro WhatsApp Business';b.addEventListener('click',()=>{if(typeof window.dg44Go==='function')window.dg44Go('whatsapp');else if(typeof window.go==='function')window.go('whatsapp')});t.appendChild(b);
 }
}
function patch(){
 if(window.__dg64Patched)return;window.__dg64Patched=true;
 const oldBookings=window.renderBookings;
 if(typeof oldBookings==='function')window.renderBookings=function(){const r=oldBookings.apply(this,arguments);bookingButtons();return r};
 const oldPayments=window.renderPayments;
 if(typeof oldPayments==='function')window.renderPayments=function(){const r=oldPayments.apply(this,arguments);paymentButtons();return r};
 quickAccess();bookingButtons();paymentButtons();
 // Lightweight: re-check after other modules finish a one-shot render (no polling).
 setTimeout(()=>{quickAccess();bookingButtons();paymentButtons()},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
})();
