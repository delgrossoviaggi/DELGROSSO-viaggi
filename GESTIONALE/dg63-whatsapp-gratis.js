/* DELGROSSO V63 — Centro WhatsApp Business gratuito. Nessun invio API e nessun invio automatico.
   Richieste dal sito = sincronizzazione gestionale esistente; chat WhatsApp in arrivo = manuale.
*/
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
function phone(value){
 let n=String(value||'').replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);
 if(n.length===10&&n.startsWith('3'))n='39'+n;
 if(!/^\d{10,15}$/.test(n))return '';
 return n;
}
const trip=b=>(state.viaggi||[]).find(v=>v.id===b?.viaggio_id)||null;
const booking=id=>(state.prenotazioni||[]).find(b=>b.id===id)||null;
const isoRome=date=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`};
const today=()=>isoRome(new Date());
const dateValue=x=>String(x||'').slice(0,10);
const upcoming=v=>{if(!v||v.archiviato_at)return false;const d=dateValue(v.data_partenza);return !!d && d>=today()};
const canceled=b=>!!b.riserva_aziendale||/annull|cancel|storn/i.test(String(b.stato||''));
function bookings(){return (state.prenotazioni||[]).filter(b=>!canceled(b)&&phone(b.telefono)&&upcoming(trip(b)));}
function optedIn(b){return (state.whatsappOptins||[]).some(o=>!o.revoked_at&&phone(o.phone)===phone(b.telefono))}
function payments(b){return (state.pagamenti||[]).filter(p=>p.prenotazione_id===b.id&&Number(p.importo)>0&&!/annull|rimbors|storn|failed|rifiutat/i.test(String(p.stato||'')+' '+String(p.tipo||''))).sort((a,b)=>String(b.data_pagamento||b.created_at||'').localeCompare(String(a.data_pagamento||a.created_at||'')))}
function nameTrip(b){const v=trip(b);return String(v?.titolo||v?.destinazione||'Viaggio')}
function item(b,label){return `<div class="dg63-item"><div class="dg63-item-title"><b>${esc(b.cliente||b.cliente_nome||'Cliente')}</b><small>${esc(nameTrip(b))} · ${esc(b.fermata_partenza||'Fermata da verificare')}</small><small>${label}</small></div><div class="dg63-item-buttons"><button class="btn btn-primary btn-sm" type="button" onclick="dg63SelectBooking('${b.id}','${label.includes('Acconto')?'deposit':label.includes('Saldo')?'balance':'confirmation'}')">Prepara</button></div></div>`}
function renderQueue(){
 const box=$('dg63Queue'),stats=$('dg63Stats');if(!box||!stats)return;
 const list=bookings(),week=new Date();week.setDate(week.getDate()+7);const next=isoRome(week);
 const due=list.filter(b=>dateValue(b.scadenza_acconto)&&dateValue(b.scadenza_acconto)<=next&&Number(b.pagato||0)<=0&&payments(b).length===0);
 const balances=list.filter(b=>Number(b.saldo||0)>0&&Number(b.pagato||0)>0&&dateValue(trip(b)?.data_partenza)<=next);
 const filter=$('dg63QueueFilter')?.value||'deposit';let selected=filter==='balance'?balances:filter==='confirmation'?list.filter(b=>/conferm|registrat|prenot/i.test(String(b.stato||''))).slice(0,100):due;
 selected=selected.slice(0,80);
 stats.innerHTML=`<div class="dg63-stat"><small>Acconti da verificare entro 7 giorni</small><strong>${due.length}</strong></div><div class="dg63-stat"><small>Saldi da verificare entro 7 giorni</small><strong>${balances.length}</strong></div><div class="dg63-stat"><small>Prenotazioni future con telefono</small><strong>${list.length}</strong></div>`;
 box.innerHTML=selected.length?selected.map(b=>item(b,filter==='balance'?'Saldo residuo '+euro(b.saldo||0):filter==='deposit'?'Acconto · scadenza '+esc(dateValue(b.scadenza_acconto)):'Conferma da verificare nel gestionale')).join(''):'<div class="empty">Nessun cliente da contattare per questo filtro.</div>';
 const help=$('dg63QueueHelp');if(help)help.textContent=filter==='deposit'?'Solo prenotazioni future senza pagamenti/acconti registrati e con scadenza entro sette giorni. Verifica sempre il pagamento prima di scrivere.':filter==='balance'?'Solo prenotazioni future con residuo e almeno un importo già pagato; verifica sempre la situazione contabile.':'Elenco prenotazioni future, non equivale a un elenco di messaggi non inviati.';
}
function renderReceipts(){
 const box=$('dg63ReceiptBox');if(!box)return;
 const b=booking($('dg61WaBooking')?.value),pay=b?payments(b):[],select=$('dg63ReceiptPayment'),previous=select?.value||'';
 if(select){select.innerHTML='<option value="">— Scegli un pagamento realmente registrato —</option>'+pay.map(p=>`<option value="${esc(p.id)}">${esc(p.tipo||'Pagamento')} · ${euro(p.importo)} · ${esc(dateValue(p.data_pagamento||p.created_at))} ${p.receipt_number?' · '+esc(p.receipt_number):''}</option>`).join('');if(pay.some(p=>p.id===previous))select.value=previous;}
 box.hidden=!pay.length;
 const no=$('dg63NoReceipt');if(no)no.hidden=!!pay.length;
}
function renderInviteRoster(){
 const box=$('dg63Roster');if(!box)return;
 const id=$('dg61GroupTrip')?.value;
 const t=(state.viaggi||[]).find(v=>v.id===id);
 const persons=bookings().filter(b=>b.viaggio_id===id).sort((a,b)=>String(a.cliente||'').localeCompare(String(b.cliente||'')));
 const invite=(state.whatsappInvites||[]).find(i=>i.trip_id===id)?.invite_url||'';
 box.innerHTML='<div class="dg63-info">'+(t?'Prenotati con telefono per '+esc(t.titolo||t.destinazione||'il viaggio')+': <b>'+persons.length+'</b>':'Seleziona un viaggio.')+(invite?' · <b>Invito salvato</b>':' · <b>Prima crea il gruppo dall’app WhatsApp Business e salva il link.</b>')+'</div>'+
 (persons.length?persons.map(b=>`<div class="dg63-item"><div class="dg63-item-title"><b>${esc(b.cliente||b.cliente_nome||'Cliente')}</b><small>${Number(b.posti)||0} pax · ${esc(b.fermata_partenza||'Fermata da verificare')}</small><small>${optedIn(b)?'Consenso contatto registrato':'Consenso WhatsApp da verificare'}</small></div><button type="button" class="btn btn-secondary btn-sm" ${!invite||!optedIn(b)?'disabled title="Serve un link invito e il consenso registrato"':''} onclick="dg63InviteBooking('${b.id}')">Invita</button></div>`).join(''):'<div class="empty">Nessuna prenotazione attiva con telefono per questo viaggio.</div>');
}
function defaultPreview(b,kind){
 if(!b)return '';
 const v=trip(b),n=String(b.cliente||b.cliente_nome||'Cliente'),tripTitle=nameTrip(b),d=dateValue(v?.data_partenza),ref=b.codice||b.id_prenotazione||String(b.id||'').slice(0,8).toUpperCase();
 const text=`DELGROSSO VIAGGI & LIMOUSINE BUS\nWhatsApp ufficiale: +39 320 881 5899\n\nGentile ${n},\n`;
 if(kind==='confirmation'){
  const confirmed=/conferm/i.test(String(b.stato||''));
  return text+(confirmed?`ti confermiamo la prenotazione ${ref}`:`la tua richiesta di prenotazione ${ref} è stata registrata ed è in attesa di conferma`)+` per ${tripTitle}${d?' del '+d:''}.\nPartecipanti: ${Number(b.posti)||0}; posti: ${b.posti_selezionati||'da verificare'}; partenza: ${b.fermata_partenza||'da definire'}.\nTotale: ${euro(b.totale||0)}; già versato: ${euro(b.pagato||0)}; residuo: ${euro(b.saldo||0)}.\nPer qualsiasi dubbio rispondi qui.`;
 }
 if(kind==='deposit')return text+`per la prenotazione ${ref} relativa a ${tripTitle}${d?' del '+d:''}, ti ricordiamo di verificare il versamento dell’acconto${b.scadenza_acconto?' entro il '+dateValue(b.scadenza_acconto):''}.\nSe hai già pagato, rispondi qui indicando il riferimento del pagamento, così possiamo controllarlo. I posti non vengono cancellati automaticamente da questo messaggio.`;
 if(kind==='balance')return text+`per la prenotazione ${ref} relativa a ${tripTitle}${d?' del '+d:''}, risulta un residuo da verificare di ${euro(b.saldo||0)}.\nSe hai già effettuato il saldo, rispondi qui e provvederemo al controllo.`;
 if(kind==='receipt'){
  const p=payments(b).find(p=>p.id===$('dg63ReceiptPayment')?.value);
  return p?text+`per la prenotazione ${ref} relativa a ${tripTitle}, abbiamo registrato ${String(p.tipo||'un pagamento').toLowerCase()} di ${euro(p.importo)}${p.data_pagamento?' in data '+dateValue(p.data_pagamento):''}.\nTi allego la ricevuta del pagamento.\n\n[ATTENZIONE OPERATORE: allega realmente il PDF prima di inviare questo messaggio.]`:'';
 }
 if(kind==='invitation'){
  const url=(state.whatsappInvites||[]).find(t=>t.trip_id===b.viaggio_id)?.invite_url;
  return url?text+`per gli aggiornamenti del viaggio ${tripTitle} puoi scegliere liberamente di unirti al gruppo WhatsApp:\n${url}\n\nLa partecipazione è facoltativa. Gli altri partecipanti potranno vedere il tuo numero di telefono.`:'';
 }
 return '';
}
function updatePreview(){
 const b=booking($('dg61WaBooking')?.value),k=$('dg61WaKind')?.value||'confirmation',ta=$('dg61WaPreview');if(!ta)return;
 ta.value=defaultPreview(b,k);
 const send=$('dg63ManualSend'),receipt=k==='receipt',invite=k==='invitation',due=k==='deposit'||k==='balance';
 const moneyBlock=(k==='deposit'&&Number(b?.pagato||0)>0)||(k==='balance'&&Number(b?.saldo||0)<=0);
 const withoutConsent=(due||invite)&&b&&!optedIn(b);
 const canSend=!!b&&!!phone(b.telefono)&&!!ta.value&&!moneyBlock&&!withoutConsent;
 if(send)send.disabled=!canSend;
 const info=$('dg63PreviewInfo');if(info){info.textContent=!b?'Seleziona una prenotazione.':withoutConsent?'Registra prima il consenso al contatto WhatsApp verificato.':moneyBlock?'La situazione contabile non giustifica questo promemoria. Verifica prima il pagamento.':receipt&&!ta.value?'Seleziona una ricevuta registrata, quindi apri e salva il PDF da allegare in WhatsApp.':invite&&!ta.value?'Nessun link d’invito salvato per questo viaggio.':k==='confirmation'&&!/conferm/i.test(String(b.stato||''))?'La prenotazione non risulta confermata: verrà indicata soltanto come richiesta registrata.':'Anteprima pronta: controlla i dati, poi premi Apri chat. Nessun messaggio viene inviato automaticamente.';info.className='statusline '+(canSend?'info':'warn')}
}
function afterRender(){renderQueue();renderReceipts();renderInviteRoster();updatePreview();renderRental();}
window.dg63SelectBooking=(id,kind)=>{
 const s=$('dg61WaBooking'),k=$('dg61WaKind');if(!s||!k)return;
 const b=booking(id);if(!b)return;
 if(![...s.options].some(o=>o.value===id))return window.toast?.('La prenotazione non è disponibile nella lista.',false);
 s.value=id;k.value=kind;
 // Do not rerender the legacy selector here: that can reset a selection during a user click.
 renderReceipts();updatePreview();$('dg61WaPreview')?.scrollIntoView?.({behavior:'smooth',block:'center'});
};
window.dg63BookingWhatsApp=id=>{if(typeof window.go==='function')window.go('whatsapp');window.dg63SelectBooking(id,'confirmation')};
window.dg63Render=afterRender;
window.dg63OpenChat=()=>{
 const b=booking($('dg61WaBooking')?.value),k=$('dg61WaKind')?.value||'confirmation';updatePreview();
 const t=$('dg61WaPreview')?.value||'';
 if(!b||!phone(b.telefono)||!t)return window.toast?.('Messaggio non pronto. Verifica il cliente e i dati.',false);
 if($('dg63ManualSend')?.disabled)return window.toast?.('Prima risolvi il controllo indicato nell’anteprima.',false);
 if(k==='receipt'&&!window.confirm('Hai già aperto la ricevuta reale e sei pronto ad allegare il PDF nella chat? Il collegamento NON allega file automaticamente.'))return;
 const url='https://wa.me/'+phone(b.telefono)+'?text='+encodeURIComponent(t.replace(/\n\[ATTENZIONE OPERATORE:[^\n]*\]$/,''));
 // Direct user click; no network requests or automatic send.
 const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
};
window.dg63OpenReceipt=()=>{
 const p=(state.pagamenti||[]).find(p=>p.id===$('dg63ReceiptPayment')?.value);
 const b=booking($('dg61WaBooking')?.value);
 if(!p||!b||p.prenotazione_id!==b.id)return window.toast?.('Seleziona un pagamento realmente collegato a questa prenotazione.',false);
 if(typeof window.printReceipt==='function')return window.printReceipt(p.id);
 if(typeof window.openReceipt74==='function')return window.openReceipt74('trip',p.id,false);
 window.toast?.('Apri Pagamenti per generare la ricevuta.',false);
 if(typeof window.go==='function')window.go('pagamenti');
};
window.dg63InviteBooking=id=>{
 const b=booking(id);if(!b||!optedIn(b))return window.toast?.('Consenso WhatsApp da verificare.',false);
 const link=(state.whatsappInvites||[]).find(t=>t.trip_id===b.viaggio_id)?.invite_url;
 if(!link)return window.toast?.('Inserisci prima il link del gruppo.',false);
 window.dg63SelectBooking(id,'invitation');window.dg63OpenChat();
};
window.dg63CopyGroupTitle=async()=>{
 const v=(state.viaggi||[]).find(x=>x.id===$('dg61GroupTrip')?.value);if(!v)return window.toast?.('Seleziona un viaggio.',false);
 const text='DELGROSSO | '+(v.titolo||v.destinazione||'Viaggio')+' | '+dateValue(v.data_partenza);
 try{await navigator.clipboard.writeText(text);window.toast?.('Nome suggerito copiato: crea il gruppo nell’app WhatsApp Business.')}catch{window.prompt('Copia il nome suggerito per il gruppo',text)};
};
function rentalPayments(n){return (state.noleggiPagamenti||[]).filter(p=>p.noleggio_id===n.id&&Number(p.importo)>0&&!/rimbors|annull|storn/i.test(String(p.tipo||''))).sort((a,b)=>String(b.data_pagamento||b.created_at||'').localeCompare(String(a.data_pagamento||a.created_at||'')))}
function selectedRental(){return (state.noleggi||[]).find(n=>n.id===$('dg63Rental')?.value)}
function renderRental(){
 const selector=$('dg63Rental');if(!selector)return;
 const rentals=(state.noleggi||[]).filter(n=>!n.archiviato_at&&phone(n.telefono)&&!/annull|storn/i.test(String(n.stato_noleggio||'')));
 const old=selector.value;
 selector.innerHTML='<option value="">— Seleziona un noleggio —</option>'+rentals.map(n=>`<option value="${esc(n.id)}">${esc(n.referente||n.azienda||'Cliente')} · ${esc(n.tratta_partenza||'Partenza')} → ${esc(n.tratta_destinazione||'Destinazione')} · ${esc(dateValue(n.data_partenza))}</option>`).join('');if(rentals.some(n=>n.id===old))selector.value=old;
 const n=selectedRental(),k=$('dg63RentalKind')?.value||'confirmation';const ps=n?rentalPayments(n):[];
 const pSelect=$('dg63RentalPayment'),payOld=pSelect?.value;
 if(pSelect){pSelect.innerHTML='<option value="">— Scegli un pagamento registrato —</option>'+ps.map(p=>`<option value="${esc(p.id)}">${esc(p.tipo||'Pagamento')} · ${euro(p.importo)} · ${esc(dateValue(p.data_pagamento||p.created_at))}</option>`).join('');if(ps.some(p=>p.id===payOld))pSelect.value=payOld;}
 const selected=ps.find(p=>p.id===$('dg63RentalPayment')?.value);
 const total=Number(n?.prezzo_concordato||0),paid=ps.reduce((sum,p)=>sum+Number(p.importo||0),0),balance=Math.max(0,total-paid);
 let message='';if(n){
   const header=`DELGROSSO VIAGGI & LIMOUSINE BUS\nWhatsApp ufficiale: +39 320 881 5899\n\nGentile ${n.referente||n.azienda||'Cliente'},\n`;
   const route=`${n.tratta_partenza||'partenza da definire'} → ${n.tratta_destinazione||'destinazione da definire'}`;
   if(k==='confirmation')message=header+(/conferm/i.test(String(n.stato_noleggio||''))?'ti confermiamo il servizio':'la tua richiesta di noleggio è stata registrata, in attesa di conferma del servizio')+` per ${route} del ${dateValue(n.data_partenza)||'giorno da definire'}. Per informazioni puoi rispondere qui.`;
   else if(k==='balance'&&total>0&&balance>0)message=header+`per il servizio di noleggio ${route} del ${dateValue(n.data_partenza)}, risulta un importo residuo da verificare di ${euro(balance)}. Se hai già pagato, rispondi qui così controlliamo l'accredito.`;
   else if(k==='receipt'&&selected)message=header+`abbiamo registrato ${String(selected.tipo||'un pagamento').toLowerCase()} di ${euro(selected.importo)} per il noleggio ${route}. Ti allego la relativa ricevuta.\n\n[ATTENZIONE OPERATORE: allega realmente il PDF prima di inviare questo messaggio.]`;
 }
 if($('dg63RentalPreview'))$('dg63RentalPreview').value=message;
 const box=$('dg63RentalPaymentBox');if(box)box.hidden=k!=='receipt';
 const send=$('dg63RentalSend');if(send)send.disabled=!message||((k==='balance')&&!(state.whatsappOptins||[]).some(o=>!o.revoked_at&&phone(o.phone)===phone(n.telefono)));
 const warning=$('dg63RentalHelp');if(warning)warning.textContent=!n?'Seleziona un noleggio.':k==='receipt'&&!selected?'Seleziona un pagamento registrato e salva la ricevuta PDF reale.':k==='balance'&&balance<=0?'Nessun residuo calcolabile dai pagamenti registrati.':k==='balance'&&send?.disabled?'Registra prima il consenso verificato al contatto WhatsApp.':'Controlla i dati prima di inviare manualmente dall’app.';
}
window.dg63RenderRental=renderRental;
window.dg63OpenRentalReceipt=()=>{
 const n=selectedRental(),p=(state.noleggiPagamenti||[]).find(p=>p.id===$('dg63RentalPayment')?.value);
 if(!n||!p||p.noleggio_id!==n.id)return window.toast?.('Seleziona un pagamento relativo al noleggio.',false);
 if(typeof window.printRentalPaymentReceipt==='function')return window.printRentalPaymentReceipt(p.id);
 if(typeof window.openReceipt74==='function')return window.openReceipt74('rental',p.id,false);
 window.toast?.('Ricevuta non disponibile, consulta Noleggi/Pagamenti.',false);
};
window.dg63OpenRentalChat=()=>{
 const n=selectedRental(),k=$('dg63RentalKind')?.value||'confirmation';renderRental();
 const message=$('dg63RentalPreview')?.value||'';
 if(!n||!phone(n.telefono)||!message||$('dg63RentalSend')?.disabled)return window.toast?.('Verifica contatto, importi, consenso e messaggio.',false);
 if(k==='receipt'&&!window.confirm('Hai salvato la ricevuta del noleggio come PDF e sei pronto ad allegarla manualmente?'))return;
 const a=document.createElement('a');a.href='https://wa.me/'+phone(n.telefono)+'?text='+encodeURIComponent(message.replace(/\n\[ATTENZIONE OPERATORE:[^\n]*\]$/,''));a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
};
function enhance(){
 const page=$('page-whatsapp');if(!page||page.dataset.dg63==='yes')return;
 page.dataset.dg63='yes';
 const sectionTitle=page.querySelector('.section-title');if(sectionTitle){sectionTitle.insertAdjacentHTML('afterend',`<div class="dg63-banner"><div><b>✅ Modalità gratuita attiva</b><p>Il gestionale prepara messaggi e ricevute. Apri la chat del cliente e conferma manualmente l’invio da WhatsApp Business. <strong>Nessuna Cloud API, nessun costo WhatsApp aggiuntivo.</strong></p></div><span>+39 320 881 5899</span></div>
 <div class="card dg63-queue"><div class="card-head"><h3>📋 Clienti da contattare</h3></div><div class="card-body"><div id="dg63Stats" class="dg63-stats"></div><div class="field" style="margin:12px 0"><label>Operazione</label><select id="dg63QueueFilter" onchange="dg63Render()"><option value="deposit">Acconti in scadenza</option><option value="balance">Saldi da verificare</option><option value="confirmation">Conferme / richieste</option></select></div><p class="dg63-help" id="dg63QueueHelp"></p><div id="dg63Queue"></div></div></div>`);}
 const connection=$('dg62WaStatus')?.closest('.card');if(connection){const details=document.createElement('details');details.className='dg63-advanced';const head=document.createElement('summary');head.textContent='Opzioni future: integrazione Meta Cloud API (facoltativa e a consumo)';details.appendChild(head);connection.parentNode.insertBefore(details,connection);details.appendChild(connection)}
 const groupHost=$('dg61GroupTrip')?.closest('.card');
 if(groupHost){groupHost.insertAdjacentHTML('afterend',`<div class="card" style="margin-top:12px"><div class="card-head"><h3>🚍 WhatsApp · Noleggi GT e Limousine Bus</h3></div><div class="card-body"><p class="dg63-help">Conferme, saldi e ricevute per i noleggi. Anche qui l’invio è manuale.</p><div class="form-grid"><div class="field full"><label>Noleggio</label><select id="dg63Rental" onchange="dg63RenderRental()"></select></div><div class="field full"><label>Comunicazione</label><select id="dg63RentalKind" onchange="dg63RenderRental()"><option value="confirmation">Conferma / richiesta noleggio</option><option value="balance">Saldo da verificare</option><option value="receipt">Ricevuta pagamento registrato</option></select></div><div id="dg63RentalPaymentBox" class="field full" hidden><label>Pagamento reale</label><select id="dg63RentalPayment" onchange="dg63RenderRental()"></select><button type="button" class="btn btn-secondary" style="margin-top:9px" onclick="dg63OpenRentalReceipt()">📄 Apri ricevuta noleggio / Salva PDF</button></div><div class="field full"><label>Anteprima</label><textarea id="dg63RentalPreview" readonly rows="7"></textarea></div></div><p id="dg63RentalHelp" class="dg63-help"></p><button id="dg63RentalSend" type="button" class="btn btn-primary" onclick="dg63OpenRentalChat()">💬 Apri WhatsApp col messaggio</button></div></div>`)}
 const preview=$('dg61WaPreview');if(preview){preview.readOnly=true;preview.insertAdjacentHTML('afterend','<div id="dg63PreviewInfo" class="statusline info" style="margin-top:8px"></div>')}
 const btn=page.querySelector('button[onclick="dg61SendManualMessage()"]');if(btn){btn.id='dg63ManualSend';btn.textContent='💬 Apri WhatsApp col messaggio';btn.setAttribute('onclick','dg63OpenChat()')}
 const apiBtn=$('dg62ApiSend');if(apiBtn)apiBtn.hidden=true;
 const quick=btn?.closest('.quick-actions');if(quick){quick.insertAdjacentHTML('afterend',`<div class="dg63-receipts" style="margin-top:14px"><b>📄 Ricevuta reale da allegare</b><p class="dg63-help">Dopo aver registrato l'acconto o il saldo, apri la ricevuta, salvala come PDF e allegala manualmente nella chat. Non viene inventato alcun pagamento.</p><div class="field"><label>Pagamento registrato</label><select id="dg63ReceiptPayment" onchange="dg63Render()"></select></div><div id="dg63ReceiptBox"><button type="button" class="btn btn-secondary" onclick="dg63OpenReceipt()">📄 Apri ricevuta / Salva PDF</button></div><p id="dg63NoReceipt" class="dg63-help" hidden>Nessun pagamento collegato a questa prenotazione: prima registra il pagamento in Cassa/Pagamenti.</p></div>`)}
 const group=$('dg61GroupTrip')?.closest('.card');if(group){const area=group.querySelector('.quick-actions');if(area)area.insertAdjacentHTML('beforeend','<button type="button" class="btn btn-secondary" onclick="dg63CopyGroupTitle()">📋 Copia nome del gruppo</button>');group.querySelector('.card-body')?.insertAdjacentHTML('beforeend','<p class="dg63-help" style="margin-top:12px">Gruppo: apri WhatsApp Business → Nuovo gruppo → crea e copia il link d’invito. L’inserimento è volontario; qui puoi aprire la chat di ogni prenotato con consenso registrato.</p><div id="dg63Roster"></div>')}
 // Existing control still prepares its text; override the displayed preview only.
 const orig=window.dg61RenderWhatsApp;
 if(typeof orig==='function')window.dg61RenderWhatsApp=function(){const r=orig.apply(this,arguments);afterRender();return r};
 const originalGroup=window.dg61RenderGroupLink;
 if(typeof originalGroup==='function')window.dg61RenderGroupLink=function(){const r=originalGroup.apply(this,arguments);renderInviteRoster();return r};
 ['dg61WaBooking','dg61WaKind'].forEach(id=>$(id)?.addEventListener('change',()=>{renderReceipts();updatePreview()}));
 afterRender();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
