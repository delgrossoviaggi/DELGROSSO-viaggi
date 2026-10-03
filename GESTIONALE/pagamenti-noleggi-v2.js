/* DELGROSSO — Pagamenti unificati Viaggi + Noleggi V2 */
(function(){
'use strict';
const $g=id=>document.getElementById(id);
const rentalLabel=r=>`${r.id_noleggio||'Noleggio'} · ${r.referente||r.azienda||'Cliente'} · ${r.tratta_partenza||'—'} → ${r.tratta_destinazione||'—'} · residuo ${money(r.saldo||0)}`;
function rentalOptions(selected=''){
  return `<option value="">— Seleziona noleggio —</option>`+(state.noleggi||[]).map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(rentalLabel(r))}</option>`).join('');
}
function paymentRows(){
  const tripRows=(state.pagamenti||[]).map(p=>({kind:'trip',date:p.data_pagamento||p.created_at||'',p}));
  const rentalRows=(state.noleggiPagamenti||[]).map(p=>({kind:'rental',date:p.data_pagamento||p.created_at||'',p}));
  return [...tripRows,...rentalRows].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
window.renderPayments=function(){
  const tripPositive=(state.pagamenti||[]).filter(p=>String(p.tipo||'').toLowerCase()!=='rimborso').reduce((s,p)=>s+Number(p.importo||0),0);
  const rentalPositive=(state.noleggiPagamenti||[]).filter(p=>String(p.tipo||'').toLowerCase()!=='rimborso').reduce((s,p)=>s+Number(p.importo||0),0);
  const tripRefund=(state.pagamenti||[]).filter(p=>String(p.tipo||'').toLowerCase()==='rimborso').reduce((s,p)=>s+Number(p.importo||0),0);
  const rentalRefund=(state.noleggiPagamenti||[]).filter(p=>String(p.tipo||'').toLowerCase()==='rimborso').reduce((s,p)=>s+Number(p.importo||0),0);
  const day=new Date().toISOString().slice(0,10);
  const today=paymentRows().filter(x=>String(x.p.data_pagamento||'').slice(0,10)===day).reduce((s,x)=>s+(String(x.p.tipo||'').toLowerCase()==='rimborso'?-Number(x.p.importo||0):Number(x.p.importo||0)),0);
  if($g('paymentSummary')) $g('paymentSummary').innerHTML=[['💶','Incassato totale',money(tripPositive+rentalPositive)],['🚌','Incassi noleggi',money(rentalPositive)],['🔴','Rimborsi',money(tripRefund+rentalRefund)],['📅','Oggi',money(today)]].map(x=>`<div class="module-card"><h3>${x[0]} ${x[1]}</h3><b style="font-size:25px">${x[2]}</b></div>`).join('');
  if(!$g('paymentsTable'))return;
  $g('paymentsTable').innerHTML=paymentRows().map(x=>{
    const p=x.p;
    if(x.kind==='trip'){
      const b=(state.prenotazioni||[]).find(z=>z.id===p.prenotazione_id),trip=tripName(p.viaggio_id||b?.viaggio_id);
      return `<tr><td>${dateIT(p.data_pagamento)}</td><td><span class="pill info">VIAGGIO</span><br><small>${esc(p.receipt_number||p.ricevuta||'—')}</small></td><td>${esc(p.cliente||b?.cliente||'—')}</td><td>${esc(p.viaggio||trip)}</td><td><span class="pill ${p.tipo==='Rimborso'?'danger':'info'}">${esc(p.tipo||'Pagamento')}</span></td><td>${money(p.importo)}</td><td>${esc(p.metodo_pagamento||p.metodo||'—')}</td><td>${esc(p.stato||'Registrato')} <button class="btn btn-secondary btn-sm" onclick="openEditPaymentModal('${p.id}')">✏️</button> <button class="btn btn-ghost btn-sm" onclick="printReceipt('${p.id}')">🧾</button></td></tr>`;
    }
    const r=(state.noleggi||[]).find(z=>z.id===p.noleggio_id);
    const servizio=r?`${r.tratta_partenza||'—'} → ${r.tratta_destinazione||'—'}`:'Noleggio';
    return `<tr><td>${dateIT(p.data_pagamento)}</td><td><span class="pill ok">NOLEGGIO</span><br><small>${esc(p.receipt_number||'—')}</small></td><td>${esc(r?.referente||r?.azienda||'—')}</td><td>${esc(servizio)}<br><small>${esc(r?.id_noleggio||'')}</small></td><td><span class="pill ${p.tipo==='Rimborso'?'danger':'ok'}">${esc(p.tipo||'Pagamento')}</span></td><td>${money(p.importo)}</td><td>${esc(p.metodo||'—')}</td><td>Registrato <button class="btn btn-ghost btn-sm" onclick="printRentalPaymentReceipt('${p.id}')">🧾</button></td></tr>`;
  }).join('')||'<tr><td colspan="8" class="empty">Nessun pagamento.</td></tr>';
};
function modeChange(){
  const mode=$g('p_scope')?.value||'booking',booking=$g('p_booking_block'),rental=$g('p_rental_block');
  if(booking)booking.style.display=mode==='booking'?'contents':'none';
  if(rental)rental.style.display=mode==='rental'?'contents':'none';
  updatePaySummary();
}
window.openPaymentModal=function(pre=''){
  const isRental=String(pre).startsWith('rental:'),rentalId=isRental?String(pre).slice(7):'';
  const b=!isRental?((state.prenotazioni||[]).find(x=>x.id===pre)||(state.prenotazioni||[])[0]||{}):{};
  const client=String(b.cliente||'').trim(),trip=b.viaggio_id||'';
  openModal('Registra pagamento / acconto / saldo',`<div class="form-grid">
    <div class="field full"><label>Pagamento riferito a</label><select id="p_scope"><option value="booking" ${!isRental?'selected':''}>🎫 Viaggio / prenotazione</option><option value="rental" ${isRental?'selected':''}>🚌 Noleggio bus / NCC / Limousine</option></select></div>
    <div id="p_booking_block" style="display:contents"><div class="field"><label>Cliente</label><select id="p_client">${paymentClientOptions(client)}</select></div><div class="field"><label>Viaggio</label><select id="p_trip">${paymentTripOptions(trip)}</select></div><div class="field full"><label>Prenotazione del cliente per questo viaggio</label><select id="p_booking">${paymentBookingOptions(client,trip,pre)}</select></div></div>
    <div id="p_rental_block" style="display:contents"><div class="field full"><label>Noleggio *</label><select id="p_rental">${rentalOptions(rentalId)}</select></div></div>
    <div class="field"><label>Tipo movimento</label><select id="p_type"><option>Acconto</option><option>Saldo</option><option>Rimborso</option></select></div>
    <div class="field"><label>Importo €</label><input id="p_amount" type="number" min="0" step=".01"></div>
    <div class="field"><label>Metodo</label><select id="p_method"><option>Contanti</option><option>Bonifico</option><option>POS</option><option>PayPal</option><option>Altro</option></select></div>
    <div class="field"><label>Data pagamento</label><input id="p_date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="field full"><label>Note</label><textarea id="p_note"></textarea></div>
  </div><div class="statusline" style="margin-top:8px" id="p_summary"></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-green" onclick="savePayment()">✓ Registra pagamento</button>`);
  $g('p_scope')?.addEventListener('change',modeChange);$g('p_client')?.addEventListener('change',syncPaymentBookings);$g('p_trip')?.addEventListener('change',syncPaymentBookings);$g('p_booking')?.addEventListener('change',updatePaySummary);$g('p_rental')?.addEventListener('change',updatePaySummary);modeChange();
};
window.updatePaySummary=function(){
  const mode=$g('p_scope')?.value||'booking';
  if(mode==='rental'){
    const r=(state.noleggi||[]).find(x=>x.id===$g('p_rental')?.value);
    if(!$g('p_summary'))return;
    $g('p_summary').textContent=r?`${r.id_noleggio||'Noleggio'} · ${r.referente||r.azienda||'Cliente'} · Prezzo ${money(r.prezzo_concordato)} · Pagato ${money(r.acconto)} · Residuo ${money(r.saldo)} · ${r.stato_pagamento||'Da pagare'}`:'Seleziona il noleggio a cui associare il pagamento.';
    return;
  }
  const b=(state.prenotazioni||[]).find(x=>x.id===$g('p_booking')?.value);if(!b){if($g('p_summary'))$g('p_summary').textContent="Seleziona cliente e viaggio per associare correttamente il pagamento.";return}if($g('p_client'))$g('p_client').value=String(b.cliente||'').trim();if($g('p_trip'))$g('p_trip').value=b.viaggio_id||'';$g('p_summary').textContent=`${tripName(b.viaggio_id)} · Totale ${money(b.totale)} · Già pagato ${money(b.pagato)} · Residuo ${money(b.saldo)}`;
};
window.savePayment=async function(){
  const mode=$g('p_scope')?.value||'booking',amount=Math.round((Number($g('p_amount')?.value)||0)*100)/100;if(amount<=0)return toast('Inserisci un importo valido',false);
  const type=$g('p_type')?.value||'Acconto',method=$g('p_method')?.value||'Contanti',date=$g('p_date')?.value||new Date().toISOString().slice(0,10),note=$g('p_note')?.value||null;
  if(mode==='rental'){
    const r=(state.noleggi||[]).find(x=>x.id===$g('p_rental')?.value);if(!r)return toast('Seleziona il noleggio',false);
    if(type!=='Rimborso'&&Number(r.saldo||0)>0&&amount>Number(r.saldo||0))return toast('L’importo supera il residuo del noleggio',false);
    if(!confirm(`Confermi il pagamento del noleggio?\n${r.referente||r.azienda||r.id_noleggio}\n${r.tratta_partenza||'—'} → ${r.tratta_destinazione||'—'}\n${type}: ${money(amount)} · ${method}`))return;
    try{const result=await rpc('dg_register_rental_payment',{p_noleggio_id:r.id,p_tipo:type,p_importo:amount,p_metodo:method,p_data:date,p_note:note});closeModal();toast('Pagamento noleggio registrato · '+(r.id_noleggio||''));await loadAll();if(result?.payment_id)setTimeout(()=>printRentalPaymentReceipt(result.payment_id),250)}catch(e){toast('Pagamento noleggio non registrato: '+e.message,false)}return;
  }
  const b=(state.prenotazioni||[]).find(x=>x.id===$g('p_booking')?.value),selectedClient=String($g('p_client')?.value||'').trim(),selectedTrip=$g('p_trip')?.value||'';if(!selectedClient)return toast('Seleziona il cliente',false);if(!selectedTrip)return toast('Seleziona il viaggio',false);if(!b)return toast('Non esiste una prenotazione per il cliente e il viaggio selezionati',false);if(String(b.cliente||'').trim()!==selectedClient||b.viaggio_id!==selectedTrip)return toast('Cliente, viaggio e prenotazione non corrispondono',false);
  try{const result=await rpc('dg_register_payment',{p_booking_id:b.id,p_tipo:type,p_importo:amount,p_metodo:method,p_data:date,p_note:note});await rpc('sync_prenotazione_pagamenti',{p_prenotazione_id:b.id});closeModal();toast('Pagamento registrato sul viaggio · '+tripName(b.viaggio_id));await loadAll();if(result?.payment_id)setTimeout(()=>printReceipt(result.payment_id),250)}catch(e){toast(e.message,false)}
};
window.printRentalPaymentReceipt=function(id){
  const p=(state.noleggiPagamenti||[]).find(x=>x.id===id);if(!p)return toast('Pagamento noleggio non trovato',false);const r=(state.noleggi||[]).find(x=>x.id===p.noleggio_id);if(!r)return toast('Noleggio non trovato',false);
  printWindow('Ricevuta noleggio '+(p.receipt_number||''),`<img class="logo" src="assets/delgrosso-logo-black-transparent.png"><h1>Ricevuta pagamento noleggio</h1><p>Ricevuta: <b>${esc(p.receipt_number||'—')}</b></p><div class="box"><div class="row"><span>Noleggio</span><b>${esc(r.id_noleggio||'—')}</b></div><div class="row"><span>Cliente / Referente</span><b>${esc(r.referente||r.azienda||'—')}</b></div><div class="row"><span>Servizio</span><b>${esc((r.tratta_partenza||'—')+' → '+(r.tratta_destinazione||'—'))}</b></div><div class="row"><span>Data servizio</span><b>${dateIT(r.data_partenza)}</b></div><div class="row"><span>Tipo</span><b>${esc(p.tipo||'Pagamento')}</b></div><div class="row"><span>Importo</span><b>${money(p.importo)}</b></div><div class="row"><span>Metodo</span><b>${esc(p.metodo||'—')}</b></div><div class="row"><span>Data pagamento</span><b>${dateIT(p.data_pagamento)}</b></div><div class="row"><span>Residuo noleggio</span><b>${money(r.saldo)}</b></div></div><p>DELGROSSO VIAGGI & LIMOUSINE BUS</p>`);
};
})();
