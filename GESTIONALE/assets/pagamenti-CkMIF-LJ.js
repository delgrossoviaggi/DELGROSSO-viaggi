import"./settingsService-SYNC153.js";import{t as e}from"./tripService-BzTorehO.js";import{t}from"./bookingService-CitenMQF.js";import{r as n}from"./notificationService-D35-IFKU.js";import{t as r}from"./appRoutes-BbuDm13X.js";/* empty css                      */import"./backButton-BaCuvMXq.js";import{n as i,t as a}from"./messageSystem-jVMshBDs.js";import{a as o,c as s,i as c,o as l,s as ee}from"./notificationCenterService-CaZQlods.js";import"./brandShell-CIWNUkWr.js";import{t as te}from"./xlsxExport-Ci5qKKp3.js";import{issuePaymentReceipt as DGIssuePaymentReceipt}from"./paymentReceiptService-v24.js";import*as DGDocs from"./bookingDocumentsService-v25.js";var u=document.querySelector(`#paymentsTable tbody`),ne=document.getElementById(`searchPayment`),re=document.getElementById(`filterMetodo`),ie=document.getElementById(`filterStato`),ae=document.getElementById(`btnRefresh`),d=document.getElementById(`btnPending`),oe=document.getElementById(`btnQuickExcel`),se=document.getElementById(`btnExportIncassi`),ce=document.getElementById(`btnOpenBookings`),f=document.getElementById(`todayIncome`),p=document.getElementById(`pendingIncome`),m=document.getElementById(`depositIncome`),h=document.getElementById(`balanceIncome`),g=document.getElementById(`refundIncome`),_=document.getElementById(`modal`),v=document.getElementById(`paymentModalTitle`),y=document.getElementById(`paymentBookingMeta`),cl=document.getElementById(`paymentLinkedClient`),tr=document.getElementById(`paymentLinkedTrip`),ci=document.getElementById(`paymentClienteId`),vi=document.getElementById(`paymentViaggioId`),b=document.getElementById(`modalPayTotale`),x=document.getElementById(`modalPayPagato`),S=document.getElementById(`modalPayResiduo`),C=document.getElementById(`modalPayStatus`),w=document.getElementById(`paymentHistoryTbody`),T=document.getElementById(`bookingIdInput`),E=document.getElementById(`movementIdInput`),D=document.getElementById(`importoInput`),O=document.getElementById(`tipoSelect`),k=document.getElementById(`metodoSelect`),A=document.getElementById(`dataInput`),j=document.getElementById(`noteInput`),M=document.getElementById(`savePayment`),le=document.getElementById(`closeModal`),N=document.getElementById(`cancelPaymentEdit`),ue=document.getElementById(`btnQuickAcconto`),de=document.getElementById(`btnQuickSaldo`),fe=document.getElementById(`btnQuickRimborso`),P=[],F=[],I=[],L=[],R=!1,z=``,B=null,V=null,H=null,pe=!1,saveBusy=!1;function U(e,t=`info`){i({type:t===`error`?`error`:`info`,title:t===`error`?`Errore`:`Pagamenti`,message:String(e||``)})}function W(e){let t=Number(e);return Number.isFinite(t)?t:0}function G(e){return new Intl.NumberFormat(`it-IT`,{style:`currency`,currency:`EUR`}).format(W(e))}function K(e){if(!e)return`-`;let t=new Date(e);return Number.isNaN(t.getTime())?`-`:t.toLocaleDateString(`it-IT`)}function q(e=``){return String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function me(e){let t=String(e?.viaggio_id||e?.tratta_id||``),n=F.find(e=>String(e.id)===t);return n?.titolo||n?.destinazione||e?.viaggio_nome||e?.viaggio||e?.viaggio_codice||n?.codice||t||`Viaggio`}function he(e){return e?.data||e?.data_prenotazione||e?.created_at||null}function ge(e){return String(e||``).trim().toLowerCase()===`annullata`}function _e(e){let t=String(e?.message||e||``).toLowerCase();return t.includes(`modulo pagamenti non disponibile`)||t.includes(`public.pagamenti`)}function ve(){let e=new Map;I.forEach(t=>{let n=String(t?.prenotazione_id||``);n&&(e.has(n)||e.set(n,[]),e.get(n).push(t))}),L=P.filter(e=>!ge(e?.stato)).map(t=>{let n=e.get(String(t.id||``))||[];return{booking:t,payments:n,summary:o(t,n),tripLabel:me(t)}}).sort((e,t)=>new Date(he(t.booking)||0).getTime()-new Date(he(e.booking)||0).getTime())}function ye(e){return e===c.paid?`status-paid`:e===c.partial?`status-partial`:e===c.refunded?`status-refunded`:`status-pending`}function be(e){return e===`Saldo`?`movement-badge movement-badge--saldo`:e===`Rimborso`?`movement-badge movement-badge--refund`:e===`Acconto`?`movement-badge movement-badge--deposit`:`movement-badge movement-badge--other`}function J(){let e=String(ne?.value||``).trim().toLowerCase(),t=String(re?.value||``).trim().toLowerCase(),n=String(ie?.value||``).trim();return L.filter(r=>{let i=`${r.booking?.codice||``} ${r.booking?.cliente_nome||r.booking?.cliente||``} ${r.tripLabel} ${r.summary.latestMethod||``}`.toLowerCase();return!(e&&!i.includes(e)||t&&String(r.summary.latestMethod||``).toLowerCase()!==t||n&&r.summary.status!==n||R&&r.summary.residual<=0)})}function xe(e){let{booking:t,summary:n,tripLabel:r}=e,i=n.latestMovement?.tipo||`Nessun movimento`,a=n.lastPaymentAt?K(n.lastPaymentAt):`-`;return`
    <tr data-booking-id="${t.id}" class="dg-payment-row">
      <td data-label="Prenotazione">${q(t.codice||String(t.id||``).slice(0,8))}</td>
      <td data-label="Cliente">
        <strong>${q(t.cliente_nome||t.cliente||`Cliente`)}</strong>
        <small>${q(t.telefono||t.cliente_telefono||``)}</small>
      </td>
      <td data-label="Viaggio">${q(r)}</td>
      <td data-label="Totale">${G(n.totalDue)}</td>
      <td data-label="Incassato">${G(n.paidNet)}</td>
      <td data-label="Residuo" class="dg-residual-cell">${G(n.residual)}</td>
      <td data-label="Stato"><span class="status-badge ${ye(n.status)}">${n.status}</span></td>
      <td data-label="Metodo">${q(n.latestMethod||`-`)}</td>
      <td data-label="Ultimo movimento">${q(i)}</td>
      <td data-label="Aggiornato">${a}</td>
      <td data-label="Azioni">
        <div class="table-actions">
          <button type="button" class="openLedgerBtn">Apri</button>
          <button type="button" class="quickDepositBtn btn-secondary">Acconto</button>
          <button type="button" class="quickBalanceBtn btn-secondary">Saldo</button>
          <button type="button" class="quickRefundBtn btn-secondary">Rimborso</button>
        </div>
      </td>
    </tr>
  `}function Se(){let e=new Date().toISOString().slice(0,10),t=I.filter(t=>String(t.data_pagamento||``).slice(0,10)===e).reduce((e,t)=>e+ee(t),0),n=L.reduce((e,t)=>e+t.summary.residual,0),r=I.filter(e=>e.tipo===`Acconto`).reduce((e,t)=>e+l(t),0),i=I.filter(e=>e.tipo===`Saldo`).reduce((e,t)=>e+l(t),0),a=I.filter(e=>e.tipo===`Rimborso`).reduce((e,t)=>e+l(t),0);f&&(f.textContent=G(t)),p&&(p.textContent=G(n)),m&&(m.textContent=G(r)),h&&(h.textContent=G(i)),g&&(g.textContent=G(a))}function Y(){E&&(E.value=``),D&&(D.value=``),O&&(O.value=`Acconto`),k&&(k.value=`Contanti`),A&&(A.value=new Date().toISOString().slice(0,10)),j&&(j.value=``),M&&(M.textContent=`Salva movimento`),N?.classList.add(`hidden`)}function X(e,t){if(D){if(e===`Saldo`){D.value=t.residual>0?t.residual.toFixed(2):``;return}e===`Rimborso`&&(D.value=t.paidNet>0?t.paidNet.toFixed(2):``)}}function Ce(e){let t=ee(e),n=t<0?`-`:`+`;return`
    <tr data-movement-id="${e.id}">
      <td>${K(e.data_pagamento||e.created_at)}</td>
      <td>${q(e.ricevuta||`-`)}</td>
      <td><span class="${be(e.tipo)}">${q(e.tipo||`Acconto`)}</span></td>
      <td class="${t<0?`amount-negative`:`amount-positive`}">${n}${G(Math.abs(t))}</td>
      <td>${q(e.metodo_pagamento||e.metodo||`-`)}</td>
      <td>${q(e.note||``)}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="editMovementBtn btn-secondary">Modifica</button>${e.receipt_storage_path?`<button type="button" class="btn-secondary" data-dg-receipt-path="${q(e.receipt_storage_path)}">Ricevuta PDF</button><button type="button" class="btn-secondary" data-dg-doc-action="payment-email" data-payment-id="${q(e.id)}">📧</button><button type="button" class="btn-secondary"` : `<button type="button" class="btn-secondary dg-receipt-retry" data-payment-id="${q(e.id)}">📄 Genera ricevuta</button>`} data-dg-doc-action="payment-wa" data-payment-id="${q(e.id)}">🟢</button>`:``}
          <button type="button" class="deleteMovementBtn">Elimina</button>
        </div>
      </td>
    </tr>
  `}async function dgRetryReceipt(paymentId){
  const row=I.find(p=>String(p.id)===String(paymentId));
  if(!row) throw Error(`Pagamento non trovato.`);
  const bk=P.find(b=>String(b.id)===String(row.prenotazione_id));
  if(!bk) throw Error(`Prenotazione collegata non trovata.`);
  const tripId=bk.viaggio_id||bk.tratta_id||row.viaggio_id||null;
  const trip=F.find(t=>String(t.id)===String(tripId))||{id:tripId,titolo:row.viaggio||`Viaggio`,destinazione:row.viaggio||`Viaggio`,data_partenza:bk.data_partenza,prezzo:bk.prezzo};
  const related=I.filter(p=>String(p.prenotazione_id||``)===String(bk.id));
  const paidAfter=related.reduce((sum,p)=>sum+(String(p.tipo||``).toLowerCase().includes(`rimborso`)?-Math.abs(Number(p.importo)||0):Math.abs(Number(p.importo)||0)),0);
  const totalDue=Number(bk.totale||0)>0?Number(bk.totale):Number(trip.prezzo||0)*Math.max(Number(bk.posti||1),1);
  const paymentAmount=Math.abs(Number(row.importo)||0);
  const paidBefore=String(row.tipo||``).toLowerCase().includes(`rimborso`)?paidAfter+paymentAmount:Math.max(paidAfter-paymentAmount,0);
  const result=await DGIssuePaymentReceipt({...row},{...bk,email:bk.email||bk.cliente_email},{...trip},{totalDue,paidBefore,paidAfter,residualAfter:Math.max(totalDue-paidAfter,0)});
  return result;
}

function we(e){w&&(w.innerHTML=e.payments.length?e.payments.map(Ce).join(``):`<tr><td colspan="7" class="empty-state">Nessun movimento registrato</td></tr>`,w.querySelectorAll(`.editMovementBtn`).forEach(t=>{t.addEventListener(`click`,()=>{let n=t.closest(`tr`)?.dataset?.movementId,r=e.payments.find(e=>e.id===n);r&&(E&&(E.value=r.id),D&&(D.value=l(r).toFixed(2)),O&&(O.value=r.tipo||`Acconto`),k&&(k.value=r.metodo_pagamento||r.metodo||`Contanti`),A&&(A.value=String(r.data_pagamento||``).slice(0,10)),j&&(j.value=r.note||``),M&&(M.textContent=`Aggiorna movimento`),N?.classList.remove(`hidden`))})}),w.querySelectorAll(`.deleteMovementBtn`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.closest(`tr`)?.dataset?.movementId;if(t&&await a({title:`Elimina pagamento`,message:`Confermi l'eliminazione del movimento selezionato?`,confirmText:`Elimina`,cancelText:`Annulla`}))try{n(await s.delete(t),null),U(`Movimento eliminato`,`info`),await $(),Z(z)}catch(e){U(e.message||`Errore eliminazione movimento`,`error`)}})}))}document.addEventListener(`click`,async e=>{
  const btn=e.target.closest?.(`.dg-receipt-retry`);
  if(!btn) return;
  btn.disabled=true;
  try{
    const result=await dgRetryReceipt(btn.dataset.paymentId);
    U(result?.emailSent===false?`Ricevuta generata e archiviata. Email non inviata.`:`Ricevuta generata e archiviata correttamente.`,`info`);
    await $();
  }catch(err){
    console.error(`Retry ricevuta`,err);
    U(`Impossibile archiviare la ricevuta: ${err.message||err}`,`error`);
  }finally{btn.disabled=false}
});

function Te(e){if(!e)return;let{booking:t,summary:n,tripLabel:r}=e;v&&(v.textContent=`Pagamenti ${t.codice||String(t.id||``).slice(0,8)}`),y&&(y.textContent=`${t.cliente_nome||t.cliente||`Cliente`} • ${r}`),cl&&(cl.textContent=t.cliente_nome||t.cliente||`Cliente`),tr&&(tr.textContent=r||`Viaggio`),ci&&(ci.value=t.cliente_id||``),vi&&(vi.value=t.viaggio_id||t.tratta_id||``),b&&(b.textContent=G(n.totalDue)),x&&(x.textContent=G(n.paidNet)),S&&(S.textContent=G(n.residual)),C&&(C.innerHTML=`<span class="status-badge ${ye(n.status)}">${n.status}</span><div class="dg-cassa-reconcile">Totale ${G(n.totalDue)} · Incassato ${G(n.paidNet)} · Residuo ${G(n.residual)}</div>`)}function Z(e,t=null){let n=L.find(t=>String(t.booking.id)===String(e));!n||!_||(z=String(n.booking.id),T&&(T.value=z),Y(),Te(n),we(n),_.style.display=`flex`,t&&O&&(O.value=t,X(t,n.summary)))}function Ee(){_&&(_.style.display=`none`,z=``)}function De(){u.querySelectorAll(`.openLedgerBtn`).forEach(e=>{e.addEventListener(`click`,()=>Z(e.closest(`tr`)?.dataset?.bookingId))}),u.querySelectorAll(`.quickDepositBtn`).forEach(e=>{e.addEventListener(`click`,()=>Z(e.closest(`tr`)?.dataset?.bookingId,`Acconto`))}),u.querySelectorAll(`.quickBalanceBtn`).forEach(e=>{e.addEventListener(`click`,()=>Z(e.closest(`tr`)?.dataset?.bookingId,`Saldo`))}),u.querySelectorAll(`.quickRefundBtn`).forEach(e=>{e.addEventListener(`click`,()=>Z(e.closest(`tr`)?.dataset?.bookingId,`Rimborso`))})}function Q(){let e=J();u.innerHTML=e.length?e.map(xe).join(``):`<tr><td colspan="11" class="empty-state">Nessuna prenotazione corrisponde ai filtri selezionati.</td></tr>`,De(e)}async function $(){P=n(await t.getAll(),[]),F=n(await e.getAll(),[]);let r=await s.getAll();if(r?.success===!1){if(!_e(r.error))throw r.error;I=[],pe||=(U(`Modulo pagamenti non ancora disponibile su Supabase live: vista in sola consultazione prenotazioni.`,`info`),!0)}else I=Array.isArray(r?.data)?r.data:[];ve(),Se(),Q(),_?.style.display===`flex`&&z&&Z(z)}function dgCassaReconcile(e){
  const total=Number(e?.totalDue||0)||0, paid=Number(e?.paidNet||0)||0, residual=Math.max(total-paid,0);
  return {totalDue:Math.max(total,0),paidNet:Math.max(paid,0),residual};
}
async function Oe(){
  const bookingId=T?.value||``, movementId=E?.value||``, type=O?.value||`Acconto`;
  const rawAmount=String(D?.value??``).replace(`,`,`.`).trim();
  const amount=Number(rawAmount);
  if(!bookingId)throw Error(`Prenotazione non selezionata.`);
  if(!rawAmount||!Number.isFinite(amount)||amount<=0)throw Error(`Inserisci un importo valido.`);
  if(Math.round(amount*100)!==amount*100)throw Error(`L'importo deve avere al massimo due decimali.`);
  const row=L.find(x=>String(x.booking.id)===String(bookingId));
  if(!row)throw Error(`Prenotazione non trovata.`);
  const tripId=row.booking.viaggio_id||row.booking.tratta_id||null;
  const tripRecord=F.find(x=>String(x.id)===String(tripId))||null;
  const clientName=row.booking.cliente_nome||row.booking.cliente||``;
  const tripName=tripRecord?.titolo||tripRecord?.destinazione||row.tripLabel||`Viaggio`;
  if(!clientName||!tripId||!tripName)throw Error(`Movimento non salvabile: cliente e viaggio sono obbligatori.`);
  let persons=Math.max(Number(row.booking.posti||0),0);
  if(!persons){let sel=row.booking.posti_selezionati;try{sel=Array.isArray(sel)?sel:JSON.parse(sel||`[]`)}catch{}persons=Array.isArray(sel)?sel.length:1}
  const unitPrice=Number(tripRecord?.prezzo??row.booking.prezzo??0)||0;
  const totalDueRaw=Number(row.booking.totale||0)>0?Number(row.booking.totale):unitPrice*persons;
  const cents=v=>Math.round((Number(v)||0)*100);
  const totalDue=cents(totalDueRaw), amountCents=cents(amount);
  if(totalDue<=0)throw Error(`Il totale della prenotazione non è valido.`);
  const related=I.filter(p=>String(p.prenotazione_id||``)===String(bookingId)&&String(p.id||``)!==String(movementId));
  let paidBefore=related.reduce((sum,p)=>{const v=cents(p.importo);return String(p.tipo||``).toLowerCase().includes(`rimborso`)?sum-v:sum+v},0);
  paidBefore=Math.max(paidBefore,0);
  const residualBefore=Math.max(totalDue-paidBefore,0);
  if(type!==`Rimborso`&&amountCents>residualBefore)throw Error(`L'importo supera il residuo disponibile di ${G(residualBefore/100)}.`);
  if(type===`Rimborso`&&amountCents>paidBefore)throw Error(`Il rimborso supera il totale già incassato di ${G(paidBefore/100)}.`);
  const paidAfterCents=type===`Rimborso`?Math.max(paidBefore-amountCents,0):paidBefore+amountCents;
  const residualAfterCents=Math.max(totalDue-paidAfterCents,0);
  const totalDueValue=totalDue/100, paidAfter=paidAfterCents/100, residualAfter=residualAfterCents/100;
  const payload={prenotazione_id:bookingId,viaggio_id:tripId,cliente_id:row.booking.cliente_id||ci?.value||null,cliente:clientName,viaggio:tripName,importo:amountCents/100,tipo:type,metodo_pagamento:k?.value||`Contanti`,data_pagamento:A?.value||new Date().toISOString().slice(0,10),note:j?.value?.trim()||``,totale:totalDueValue,pagato:paidAfter,saldo:residualAfter,persone:persons};
  const result=movementId?await s.update(movementId,payload):await s.aggiungiPagamento(bookingId,payload);
  return{result,created:!movementId,payment:result?.data||result,booking:{...row.booking,cliente_id:row.booking.cliente_id||ci?.value||null},trip:tripRecord||{id:tripId,titolo:tripName,destinazione:tripName,data_partenza:tripRecord?.data_partenza||row.booking.data_partenza,prezzo:unitPrice},summary:{...row.summary,totalDue:totalDueValue,paidNet:paidBefore/100,residual:residualBefore/100,paidBefore:paidBefore/100,paidAfter,residualAfter}}}
}
function ke(e){let t=[[`Prenotazione`,`Cliente`,`Viaggio`,`Totale`,`Incassato`,`Residuo`,`Stato`,`Ultimo metodo`].join(`,`)];e.forEach(({booking:e,summary:n,tripLabel:r})=>{let i=[e.codice||e.id||``,e.cliente_nome||e.cliente||``,r,n.totalDue.toFixed(2),n.paidNet.toFixed(2),n.residual.toFixed(2),n.status,n.latestMethod||``];t.push(i.map(e=>`"${String(e).replace(/"/g,`""`)}"`).join(`,`))});let n=new Blob([t.join(`
`)],{type:`text/csv;charset=utf-8;`}),r=URL.createObjectURL(n),i=document.createElement(`a`);i.href=r,i.download=`pagamenti-prenotazioni.csv`,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(r)}function Ae(){ne?.addEventListener(`input`,Q),re?.addEventListener(`change`,Q),ie?.addEventListener(`change`,Q),ae?.addEventListener(`click`,()=>{$().then(()=>U(`Modulo pagamenti aggiornato`,`info`)).catch(e=>U(e.message||`Errore refresh pagamenti`,`error`))}),d?.addEventListener(`click`,()=>{R=!R,d.classList.toggle(`is-active`,R),Q()}),ce?.addEventListener(`click`,()=>{window.location.href=r.prenotazioni}),oe?.addEventListener(`click`,()=>{te(J().map(({booking:e,summary:t,tripLabel:n})=>({Prenotazione:e.codice||e.id||``,Cliente:e.cliente_nome||e.cliente||``,Viaggio:n,Totale:t.totalDue,Incassato:t.paidNet,Residuo:t.residual,Stato:t.status,Metodo:t.latestMethod||``})),`Pagamenti`,`pagamenti-enterprise.xlsx`),U(`Export Excel completato`,`info`)}),se?.addEventListener(`click`,()=>{ke(J()),U(`Export CSV completato`,`info`)}),le?.addEventListener(`click`,Ee),N?.addEventListener(`click`,Y),O?.addEventListener(`change`,()=>{let e=L.find(e=>String(e.booking.id)===String(T?.value||``));e&&X(O.value,e.summary)}),ue?.addEventListener(`click`,()=>{O.value=`Acconto`,Y()}),de?.addEventListener(`click`,()=>{let e=L.find(e=>String(e.booking.id)===String(T?.value||``));e&&(Y(),O.value=`Saldo`,X(`Saldo`,e.summary))}),fe?.addEventListener(`click`,()=>{let e=L.find(e=>String(e.booking.id)===String(T?.value||``));e&&(Y(),O.value=`Rimborso`,X(`Rimborso`,e.summary))}),M?.addEventListener(`click`,async()=>{if(saveBusy)return;saveBusy=!0;let oldLabel=M?.textContent||`Salva movimento`;M?.setAttribute(`disabled`,`true`);M&&(M.textContent=`Salvataggio…`);try{let e=await Oe(),t=e?.payment||{},r=e?.summary||{},receiptTypes=[`Acconto`,`Saldo`];if(receiptTypes.includes(t.tipo)){try{let n=await DGIssuePaymentReceipt({...t,receipt_number:t.receipt_number},{...e.booking,email:e.booking.email||e.booking.cliente_email},{...e.trip},{totalDue:r.totalDue,paidBefore:Number(r.paidBefore||0),paidAfter:Number(r.paidAfter||0),residualAfter:Number(r.residualAfter||0)});U(n.emailSent===false?`Pagamento registrato. Ricevuta aggiornata nel fascicolo; email non inviata perché l'SMTP non è configurato.`:`Pagamento registrato. Ricevuta aggiornata nel fascicolo del cliente e inviata via email.`,`info`);try{if(!e.booking?.confirmation_storage_path)await DGDocs.issueBookingDocuments({...e.booking,email:e.booking.email||e.booking.cliente_email,telefono:e.booking.telefono||e.booking.cliente_telefono},{...e.trip})}catch(err){console.error(`Conferma prenotazione dopo pagamento non completata:`,err)}}catch(t){console.error(t),U(`Pagamento registrato, ma la ricevuta non è stata archiviata: ${t.message||t}`,`error`)}}else U(E?.value?`Movimento aggiornato`:`Movimento registrato`,`info`);window.dispatchEvent(new CustomEvent(`dg:v156:payment-saved`,{detail:{payment:t,booking:e.booking,trip:e.trip,updated:Boolean(E?.value)}}));await $(),Z(T?.value||z),Y()}catch(e){U(e.message||`Errore salvataggio movimento`,`error`)}finally{saveBusy=!1;M?.removeAttribute(`disabled`);M&&(M.textContent=oldLabel)}}),_?.addEventListener(`click`,e=>{e.target===_&&Ee()})}async function je(){Ae(),await $(),B=s.subscribe(()=>{$().catch(e=>U(e.message||`Errore sync pagamenti`,`error`))}),V=t.subscribe(()=>{$().catch(e=>U(e.message||`Errore sync prenotazioni`,`error`))}),H=e.subscribe(()=>{$().catch(e=>U(e.message||`Errore sync viaggi`,`error`))})}window.addEventListener(`beforeunload`,()=>{typeof B==`function`&&B(),typeof V==`function`&&V(),typeof H==`function`&&H()}),je().catch(e=>{U(e.message||`Errore inizializzazione pagamenti`,`error`)});