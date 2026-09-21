import { t as tripService } from './tripService-BzTorehO.js';
import { t as bookingService } from './bookingService-CitenMQF.js';
import { c as paymentService, a as calcPaymentSummary, i as PAYMENT_STATUS } from './notificationCenterService-CaZQlods.js';
import { n as notify } from './messageSystem-jVMshBDs.js';
import { issuePaymentReceipt } from './paymentReceiptService-v24.js';
import * as DGDocs from './bookingDocumentsService-v25.js';

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(value)||0);
const dateIT = value => { if(!value) return '—'; const d=new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('it-IT'); };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const peopleOf = b => { const n=Number(b?.posti||b?.numero_persone||0); if(n>0)return n; try{const x=Array.isArray(b?.posti_selezionati)?b.posti_selezionati:JSON.parse(b?.posti_selezionati||'[]');return x.length||1}catch{return 1} };
const clientName = b => String(b?.cliente_nome||b?.cliente||`${b?.nome||''} ${b?.cognome||''}`.trim()||b?.email||'Cliente').trim();
const tripIdOf = b => b?.viaggio_id||b?.tratta_id||null;
const tripName = (b,t) => t?.titolo||t?.destinazione||b?.viaggio_nome||b?.viaggio||b?.viaggio_codice||'Viaggio';
const cents = v => Math.round((Number(v)||0)*100);

let bookings=[], trips=[], payments=[], rows=[];
let selectedClientKey='', selectedBookingId='', selectedType='Acconto', busy=false;

function toast(message,type='info'){ try{notify({type:type==='error'?'error':'info',title:type==='error'?'Errore':'Pagamenti',message:String(message)});}catch{console[type==='error'?'error':'log'](message);} }
function tripFor(b){return trips.find(t=>String(t.id)===String(tripIdOf(b)))||null;}
function totalFor(b,t){ const stored=Number(b?.totale||0); if(stored>0)return stored; return (Number(t?.prezzo||b?.prezzo||0)||0)*peopleOf(b); }
function paymentRowsFor(id){return payments.filter(p=>String(p?.prenotazione_id||'')===String(id));}
function summaryFor(b){return calcPaymentSummary(b,paymentRowsFor(b.id));}
function statusText(s){return s||PAYMENT_STATUS?.pending||'Da Pagare'}
function makeRows(){rows=bookings.filter(b=>String(b?.stato||'').toLowerCase()!=='annullata').map(b=>({booking:b,trip:tripFor(b),summary:summaryFor(b)}));}

function renderKpis(){
 const today=new Date().toISOString().slice(0,10);
 const todayIncome=payments.filter(p=>String(p?.data_pagamento||'').slice(0,10)===today).reduce((a,p)=>a+(String(p?.tipo||'').toLowerCase()==='rimborso'?-Math.abs(Number(p.importo)||0):Math.abs(Number(p.importo)||0)),0);
 const pending=rows.reduce((a,r)=>a+Math.max(r.summary.residual,0),0);
 const deposits=payments.filter(p=>p.tipo==='Acconto').reduce((a,p)=>a+Math.abs(Number(p.importo)||0),0);
 const balances=payments.filter(p=>p.tipo==='Saldo').reduce((a,p)=>a+Math.abs(Number(p.importo)||0),0);
 const refunds=payments.filter(p=>p.tipo==='Rimborso').reduce((a,p)=>a+Math.abs(Number(p.importo)||0),0);
 $('kpiToday').textContent=money(todayIncome);$('kpiPending').textContent=money(pending);$('kpiDeposits').textContent=money(deposits);$('kpiBalances').textContent=money(balances);$('kpiRefunds').textContent=money(refunds);
}

function clientKey(b){return String(b?.cliente_id||`${clientName(b).toLowerCase()}|${b?.telefono||b?.cliente_telefono||''}`).trim();}
function renderClients(){
 const q=String($('payClientSearch')?.value||'').trim().toLowerCase();
 const map=new Map();
 rows.forEach(r=>{const b=r.booking,k=clientKey(b),text=`${clientName(b)} ${b?.telefono||b?.cliente_telefono||''} ${b?.codice||''} ${tripName(b,r.trip)}`.toLowerCase();if(q&&!text.includes(q))return;if(!map.has(k))map.set(k,[]);map.get(k).push(r)});
 const list=[...map.entries()].sort((a,b)=>clientName(a[1][0].booking).localeCompare(clientName(b[1][0].booking),'it'));
 $('payClientList').innerHTML=list.length?list.map(([k,rs])=>{const b=rs[0].booking;return `<button class="dg-pay-client ${k===selectedClientKey?'is-selected':''}" data-client-key="${esc(k)}"><span><strong>${esc(clientName(b))}</strong><small>📞 ${esc(b?.telefono||b?.cliente_telefono||'Nessun telefono')}</small></span><span class="dg-pay-count">${rs.length} ${rs.length===1?'prenotazione':'prenotazioni'}</span></button>`}).join(''):'<div class="dg-pay-empty">Nessun prenotato trovato.</div>';
}
function renderTrips(){
 const list=rows.filter(r=>clientKey(r.booking)===selectedClientKey);
 $('payTripList').innerHTML=list.length?list.map(r=>{const b=r.booking,s=r.summary,t=r.trip,total=totalFor(b,t),res=Math.max(s.residual,0),date=t?.data_partenza||t?.data||b?.data_partenza||b?.data_viaggio;return `<button class="dg-pay-trip ${String(b.id)===String(selectedBookingId)?'is-selected':''}" data-booking-id="${esc(b.id)}"><div class="dg-pay-trip-top"><span class="dg-pay-trip-title">🚌 ${esc(tripName(b,t))}</span><span class="dg-pay-trip-code">${esc(b.codice||String(b.id).slice(0,8))}</span></div><div class="dg-pay-trip-meta">${dateIT(date)} · ${peopleOf(b)} posti · ${esc(b?.stato||'In attesa')}</div><div class="dg-pay-trip-money"><span class="dg-chip">Totale ${money(total)}</span><span class="dg-chip paid">Incassato ${money(s.paidNet)}</span><span class="dg-chip ${res>0?'residual':'paid'}">${res>0?'Residuo '+money(res):'Pagato'}</span></div></button>`}).join(''):'<div class="dg-pay-empty">Seleziona un prenotato per vedere i suoi viaggi.</div>';
}
function selectedRow(){return rows.find(r=>String(r.booking.id)===String(selectedBookingId))||null;}
function setStep(step){document.querySelectorAll('.dg-pay-step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.step)<=step));}
function renderSelected(){
 const r=selectedRow();
 if(!r){$('selectedClientName').textContent='Nessun prenotato';$('selectedTripName').textContent='Seleziona un viaggio';$('selectedBookingMeta').textContent='—';$('payTotal').textContent='€ 0,00';$('payPaid').textContent='€ 0,00';$('payResidual').textContent='€ 0,00';$('payStatus').textContent='Da Pagare';$('payAmount').value='';$('payHistory').innerHTML='<div class="dg-pay-empty">Seleziona un viaggio per visualizzare lo storico.</div>';setStep(selectedClientKey?2:1);return;}
 const b=r.booking,s=r.summary,t=r.trip,total=totalFor(b,t),res=Math.max(total-s.paidNet,0);selectedBookingId=b.id;
 $('selectedClientName').textContent=clientName(b);$('selectedTripName').textContent=tripName(b,t);$('selectedBookingMeta').textContent=`${b.codice||String(b.id).slice(0,8)} · ${dateIT(t?.data_partenza||b?.data_partenza)} · ${peopleOf(b)} posti`;
 $('payTotal').textContent=money(total);$('payPaid').textContent=money(s.paidNet);$('payResidual').textContent=money(res);$('payStatus').textContent=statusText(s.status);
 $('hiddenBookingId').value=b.id;$('hiddenClientId').value=b.cliente_id||'';$('hiddenTripId').value=tripIdOf(b)||'';
 if(selectedType==='Saldo')$('payAmount').value=res>0?res.toFixed(2):''; else if(selectedType==='Rimborso')$('payAmount').value=s.paidNet>0?s.paidNet.toFixed(2):''; else $('payAmount').value='';
 $('payType').value=selectedType; setTypeButtons(); renderHistory(r); setStep(3);
}
function renderHistory(r){const list=paymentRowsFor(r.booking.id).slice().sort((a,b)=>new Date(b.data_pagamento||b.created_at||0)-new Date(a.data_pagamento||a.created_at||0));$('payHistory').innerHTML=list.length?`<table><thead><tr><th>Data</th><th>Tipo</th><th>Importo</th><th>Metodo</th><th>Ricevuta</th></tr></thead><tbody>${list.map(p=>`<tr><td>${dateIT(p.data_pagamento||p.created_at)}</td><td>${esc(p.tipo||'Acconto')}</td><td>${money(Math.abs(Number(p.importo)||0))}</td><td>${esc(p.metodo_pagamento||p.metodo||'—')}</td><td>${esc(p.receipt_number||p.ricevuta||'—')}</td></tr>`).join('')}</tbody></table>`:'<div class="dg-pay-empty">Nessun pagamento registrato per questo viaggio.</div>';}
function setTypeButtons(){document.querySelectorAll('[data-pay-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.payType===selectedType));}
function setType(type){selectedType=type;$('payType').value=type;setTypeButtons();const r=selectedRow();if(r){const s=r.summary,total=totalFor(r.booking,r.trip),res=Math.max(total-s.paidNet,0);$('payAmount').value=type==='Saldo'&&res>0?res.toFixed(2):type==='Rimborso'&&s.paidNet>0?s.paidNet.toFixed(2):'';}}

async function load(){
 try{
  const [b,t,p]=await Promise.all([bookingService.getAll(),tripService.getAll(),paymentService.getAll()]);
  if(b?.success===false)throw b.error||new Error('Prenotazioni non disponibili');
  if(t?.success===false)throw t.error||new Error('Viaggi non disponibili');
  if(p?.success===false)throw p.error||new Error('Pagamenti non disponibili');
  bookings=Array.isArray(b?.data)?b.data:[];trips=Array.isArray(t?.data)?t.data:[];payments=Array.isArray(p?.data)?p.data:[];makeRows();renderKpis();renderClients();renderTrips();renderSelected();
  $('payStatusBar').className='dg-pay-status';$('payStatusBar').innerHTML='<span>● Sistema operativo</span><span>Supabase sincronizzato</span>';
 }catch(err){console.error(err);$('payStatusBar').className='dg-pay-status error';$('payStatusBar').innerHTML=`<span>⚠ ${esc(err.message||'Errore caricamento pagamenti')}</span>`;toast(err.message||'Errore caricamento pagamenti','error');}
}
async function save(){
 if(busy)return; const r=selectedRow();if(!r)return toast('Seleziona prima prenotato e viaggio.','error');
 const type=$('payType').value,amount=Number(String($('payAmount').value||'').replace(',','.'));if(!Number.isFinite(amount)||amount<=0)return toast('Inserisci un importo valido.','error');if(Math.round(amount*100)!==amount*100)return toast('L’importo può avere al massimo due decimali.','error');
 const total=totalFor(r.booking,r.trip),summary=r.summary,paid=cents(summary.paidNet),totalC=cents(total),amountC=cents(amount);if(type!=='Rimborso'&&amountC>Math.max(totalC-paid,0))return toast(`L'importo supera il residuo di ${money(Math.max(totalC-paid,0)/100)}.`,'error');if(type==='Rimborso'&&amountC>paid)return toast(`Il rimborso supera l'incassato di ${money(paid/100)}.`,'error');
 busy=true;$('paySave').disabled=true;$('paySave').textContent='Salvataggio…';
 try{
  const payload={prenotazione_id:r.booking.id,viaggio_id:tripIdOf(r.booking),cliente_id:r.booking.cliente_id||null,cliente:clientName(r.booking),viaggio:tripName(r.booking,r.trip),importo:amount,tipo:type,metodo_pagamento:$('payMethod').value,data_pagamento:$('payDate').value||new Date().toISOString().slice(0,10),note:$('payNote').value.trim(),totale:total,pagato:(type==='Rimborso'?Math.max(paid-amountC,0):paid+amountC)/100,saldo:Math.max(totalC-(type==='Rimborso'?Math.max(paid-amountC,0):paid+amountC),0)/100,persone:peopleOf(r.booking)};
  const result=await paymentService.create(payload);if(result?.success===false)throw result.error||new Error('Pagamento non registrato');
  const payment=result.data||result;
  try{if(type==='Acconto'||type==='Saldo')await issuePaymentReceipt(payment,{...r.booking,email:r.booking.email||r.booking.cliente_email},{...r.trip},{totalDue:total,paidBefore:summary.paidNet,paidAfter:payload.pagato,residualAfter:payload.saldo});}catch(e){console.warn('Ricevuta non archiviata:',e)}
  if((type==='Acconto'||type==='Saldo')&&!r.booking.confirmation_storage_path){try{await DGDocs.issueBookingDocuments({...r.booking,email:r.booking.email||r.booking.cliente_email,telefono:r.booking.telefono||r.booking.cliente_telefono},{...r.trip})}catch(e){console.warn('Conferma non archiviata:',e)}}
  toast(`${type} registrato per ${clientName(r.booking)} · ${tripName(r.booking,r.trip)}`,'info');$('payNote').value='';await load();renderSelected();
 }catch(err){console.error(err);toast(err.message||'Errore durante il salvataggio','error');}finally{busy=false;$('paySave').disabled=false;$('paySave').textContent='✓ Registra pagamento';}
}
function bind(){
 $('payClientSearch').addEventListener('input',renderClients);$('payClientList').addEventListener('click',e=>{const btn=e.target.closest('[data-client-key]');if(!btn)return;selectedClientKey=btn.dataset.clientKey;selectedBookingId='';renderClients();renderTrips();renderSelected();});$('payTripList').addEventListener('click',e=>{const btn=e.target.closest('[data-booking-id]');if(!btn)return;selectedBookingId=btn.dataset.bookingId;renderTrips();renderSelected();});
 document.querySelectorAll('[data-pay-type]').forEach(btn=>btn.addEventListener('click',()=>setType(btn.dataset.payType)));$('paySave').addEventListener('click',save);$('payRefresh').addEventListener('click',load);$('payOpenBookings').addEventListener('click',()=>location.href='./prenotazioni.html');$('payBack').addEventListener('click',()=>history.back());
 $('payAmount').addEventListener('input',()=>{});$('payStatusBar').addEventListener('click',()=>{});
}

if ($('payDate')) $('payDate').value=new Date().toISOString().slice(0,10);
window.addEventListener('dg:v156:payment-saved',()=>load().catch(()=>{}));
bind();load();
