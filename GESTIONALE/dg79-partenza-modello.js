/* DELGROSSO V79: modello contabile del riepilogo partenza.
 * Tutti gli importi sono elaborati in CENTESIMI, senza numeri inventati.
 * Nessuna lettura della rete e nessuna modifica al database in questo modulo.
 */
(function(){
'use strict';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const cents=v=>Math.round(n(v)*100);
const sum=a=>(a||[]).reduce((v,x)=>v+x,0);
const key=v=>String(v||'');
const lower=v=>key(v).trim().toLowerCase();
const canceled=b=>/annull|cancel|storn|rimbors/i.test(key(b?.stato));
const refunded=p=>/rimbors/i.test(key(p?.tipo));
const paidStatus=p=>/^(registrato|confermato|pagato)$/i.test(key(p?.stato).trim());
const splits=(amount,count)=>{
 const howMany=Math.max(1,Math.floor(n(count)));
 const sign=amount<0?-1:1,abs=Math.abs(Math.round(amount)),each=Math.floor(abs/howMany),rest=abs%howMany;
 return Array.from({length:howMany},(_,i)=>sign*(each+(i<rest?1:0)));
};
function romanToday(){
 const parts=new Intl.DateTimeFormat('it-IT',{
  timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date());
 const d=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return d.year+'-'+d.month+'-'+d.day;
}
function makeModel(input){
 const root=input.root||{},allTrips=(input.trips||[]).slice();
 const tripIds=new Set(allTrips.map(t=>key(t.id)));
 if(!root.id||!tripIds.has(key(root.id)))throw Error('Viaggio di riferimento non presente.');
 const active=(input.bookings||[]).filter(b=>tripIds.has(key(b.viaggio_id))&&!canceled(b)&&!b.riserva_aziendale);
 const company=(input.bookings||[]).filter(b=>tripIds.has(key(b.viaggio_id))&&!canceled(b)&&!!b.riserva_aziendale);
 const allBookings=(input.bookings||[]).filter(b=>tripIds.has(key(b.viaggio_id)));
 const byId=new Map(allBookings.map(b=>[key(b.id),b]));
 const operators=(input.operators||[]).filter(o=>o.attivo!==false);
 const nicola=operators.find(o=>lower(o.username)==='nicola');
 const raffaele=operators.find(o=>lower(o.username)==='raffaele');
 if(!nicola||!raffaele||!nicola.user_id||!raffaele.user_id)
  throw Error('Anagrafica Nicola e Raffaele incompleta. Aggiorna gli operatori prima di creare il PDF.');
 const names=new Map();
 for(const o of operators){
  names.set(lower(o.username),key(o.user_id));
  names.set(lower(o.nome),key(o.user_id));
 }
 const nc=key(nicola.user_id),rc=key(raffaele.user_id);
 const allPayments=(input.payments||[]).filter(p=>paidStatus(p)&&(
  tripIds.has(key(p.viaggio_id))||byId.has(key(p.prenotazione_id))
 ));
 const uniquePay=[...new Map(allPayments.map(p=>[key(p.id),p])).values()];
 const byPayment=new Map(uniquePay.map(p=>[key(p.id),p]));
 const transferMap=new Map();
 for(const t of input.transfers||[]){
  if(lower(t.tipo_origine)!=='viaggio'||!byPayment.has(key(t.pagamento_id)))continue;
  if(cents(t.importo)<=0)continue;
  const id=key(t.pagamento_id);
  if(!transferMap.has(id))transferMap.set(id,[]);
  transferMap.get(id).push(t);
 }
 const perBooking=new Map(),warnings=[],entries=[];
 const cashByOwner={nicola:0,raffaele:0,altro:0};
 let refundTotal=0,depositTotal=0,balanceTotal=0,otherTypes=0,netAll=0;
 for(const p of uniquePay){
  const type=lower(p.tipo),raw=cents(p.importo);
  const amount=refunded(p)?-Math.abs(raw):raw;
  if(!Number.isFinite(amount))throw Error('Importo pagamento non valido.');
  const ownerId=key(p.incassato_da_user_id||names.get(lower(p.incassato_da))||'');
  const parts=new Map();
  if(ownerId)parts.set(ownerId,amount);
  else parts.set('_unattributed',amount);
  for(const t of transferMap.get(key(p.id))||[]){
   const from=key(t.da_operatore_user_id),to=key(t.a_operatore_user_id),move=cents(t.importo);
   if(!from||!to||from===to)continue;
   parts.set(from,(parts.get(from)||0)-move);
   parts.set(to,(parts.get(to)||0)+move);
  }
  const assigned={
   nicola:parts.get(nc)||0,
   raffaele:parts.get(rc)||0,
   altro:sum([...parts].filter(([id])=>id!==nc&&id!==rc).map(([,v])=>v))
  };
  if(assigned.nicola+assigned.raffaele+assigned.altro!==amount)
   throw Error('Quote pagamento non riconciliate. Rapporto non generato.');
  cashByOwner.nicola+=assigned.nicola;
  cashByOwner.raffaele+=assigned.raffaele;
  cashByOwner.altro+=assigned.altro;
  netAll+=amount;
  if(refunded(p))refundTotal+=Math.abs(amount);
  else if(type==='acconto')depositTotal+=amount;
  else if(type==='saldo')balanceTotal+=amount;
  else otherTypes+=amount;
  const linked=byId.get(key(p.prenotazione_id));
  const bucket=linked&&!canceled(linked)&&!linked.riserva_aziendale?'attiva':
    linked&&canceled(linked)?'annullata':
    linked?.riserva_aziendale?'riserva':'senza_prenotazione';
  const record={id:key(p.id),bookingId:key(p.prenotazione_id),amount,type,
    category:bucket,parts:assigned,receipt:key(p.receipt_number)};
  entries.push(record);
  if(bucket==='attiva'){
   if(!perBooking.has(record.bookingId))perBooking.set(record.bookingId,[]);
   perBooking.get(record.bookingId).push(record);
  }
 }
 if(cashByOwner.nicola+cashByOwner.raffaele+cashByOwner.altro!==netAll)
  throw Error('Quote Nicola/Raffaele non riconciliate.');
 if(cashByOwner.altro)warnings.push('Sono presenti incassi o quote attribuite ad altri/operatori non riconosciuti.');
 const seatsByBooking=new Map();
 for(const s of input.seats||[]){
  const id=key(s.prenotazione_id);
  if(!seatsByBooking.has(id))seatsByBooking.set(id,[]);
  seatsByBooking.get(id).push(key(s.posto));
 }
 const sortedTrips=allTrips.slice().sort((a,b)=>n(a.bis_numero||1)-n(b.bis_numero||1));
 const busNames=new Map(sortedTrips.map((t,i)=>[key(t.id),'BUS '+String(n(t.bis_numero)||i+1)]));
 const rows=[],busSummaries=new Map(),bookingSummaries=[];
 for(const b of active.slice().sort((a,b)=>{
  const an=n((allTrips.find(t=>t.id===a.viaggio_id)||{}).bis_numero||1);
  const bn=n((allTrips.find(t=>t.id===b.viaggio_id)||{}).bis_numero||1);
  return an-bn||key(a.cliente||a.cliente_nome).localeCompare(key(b.cliente||b.cliente_nome),'it');
 })){
  const howMany=Math.max(1,Math.floor(n(b.posti)));
  const price=cents(b.totale);
  const payments=perBooking.get(key(b.id))||[];
  const pSum=k=>sum(payments.map(x=>k==='amount'?x.amount:(x.parts[k]||0)));
  const totalPaid=pSum('amount');
  const breakdown={
   acconto:sum(payments.filter(x=>x.type==='acconto').map(x=>Math.max(0,x.amount))),
   saldo:sum(payments.filter(x=>x.type==='saldo').map(x=>Math.max(0,x.amount))),
   rimborso:sum(payments.filter(x=>x.type.includes('rimbors')).map(x=>Math.abs(x.amount))),
   nicola:pSum('nicola'),raffaele:pSum('raffaele'),altro:pSum('altro')
  };
  const fieldSplit=Object.fromEntries(['acconto','saldo','rimborso','nicola','raffaele','altro']
   .map(k=>[k,splits(breakdown[k],howMany)]));
  const priceSplit=splits(price,howMany);
  const rawSeats=key(b.posti_selezionati).split(',').map(x=>x.trim()).filter(Boolean);
  const seatList=rawSeats.length===howMany?rawSeats:
    (seatsByBooking.get(key(b.id))||[]).slice().sort((a,b)=>n(a)-n(b));
  if(seatList.length!==howMany)warnings.push('Posti incompleti per prenotazione '+key(b.codice||b.confirmation_number||key(b.id).slice(0,8)));
  const bus=busNames.get(key(b.viaggio_id))||'BUS';
  const subtotal={bus,people:howMany,quota:price,paid:totalPaid};
  bookingSummaries.push(subtotal);
  if(!busSummaries.has(bus))busSummaries.set(bus,{bus,people:0,quota:0,paid:0});
  const busRec=busSummaries.get(bus);
  busRec.people+=howMany;busRec.quota+=price;busRec.paid+=totalPaid;
  for(let i=0;i<howMany;i++){
   const owned={
    nicola:fieldSplit.nicola[i],
    raffaele:fieldSplit.raffaele[i],
    altro:fieldSplit.altro[i]
   };
   const paid=owned.nicola+owned.raffaele+owned.altro;
   const priceP=priceSplit[i];
   rows.push({
    bookingId:key(b.id),bus,seat:seatList[i]||'NON ASS.',
    holder:key(b.cliente||b.cliente_nome||'Intestatario non indicato'),
    reference:key(b.codice||b.confirmation_number||''),
    person:i+1,persons:howMany,stop:key(b.fermata_partenza||'Da verificare'),
    quota:priceP,acconto:fieldSplit.acconto[i],saldo:fieldSplit.saldo[i],
    rimborso:fieldSplit.rimborso[i],
    nicola:owned.nicola,raffaele:owned.raffaele,altro:owned.altro,
    incassato:paid,residuo:Math.max(0,priceP-paid),eccedenza:Math.max(0,paid-priceP)
   });
  }
 }
 const quotaTotal=sum(rows.map(r=>r.quota)),activePaid=sum(rows.map(r=>r.incassato));
 const activeResidual=sum(rows.map(r=>r.residuo)),activeExcess=sum(rows.map(r=>r.eccedenza));
 const cancelledCash=sum(entries.filter(e=>e.category==='annullata').map(e=>e.amount));
 const reservedCash=sum(entries.filter(e=>e.category==='riserva').map(e=>e.amount));
 const unlinkedCash=sum(entries.filter(e=>e.category==='senza_prenotazione').map(e=>e.amount));
 if(activePaid+cancelledCash+reservedCash+unlinkedCash!==netAll)
  throw Error('Incassi non riconciliati fra prenotazioni e movimenti extra.');
 if(netAll!==cashByOwner.nicola+cashByOwner.raffaele+cashByOwner.altro)
  throw Error('Totali degli operatori non riconciliati.');
 if(cancelledCash||reservedCash||unlinkedCash)
  warnings.push('Movimenti relativi a prenotazioni annullate, riserve o non collegate: dettagli nel totale.');
 if(activeExcess)warnings.push('Sono presenti importi incassati superiori alle quote prenotate.');
 if(rows.length===0)warnings.push('Non risultano partecipanti attivi con quota.');
 return {
  trip:root,trips:sortedTrips,
  createdAt:new Date().toISOString(),today:romanToday(),
  rows,bookingCount:active.length,
  companySeats:sum(company.map(x=>Math.max(0,n(x.posti)))),
  busSummaries:[...busSummaries.values()],
  payments:entries.length,
  totals:{
   pax:rows.length,quota:quotaTotal,activePaid,activeResidual,activeExcess,
   nicola:cashByOwner.nicola,raffaele:cashByOwner.raffaele,altro:cashByOwner.altro,
   cashNet:netAll,refunds:refundTotal,acconti:depositTotal,saldi:balanceTotal,
   altriTipi:otherTypes,cancelledCash,reservedCash,unlinkedCash
  },warnings:[...new Set(warnings)]
 };
}
window.DG79Model={build:makeModel,cents,splits,today:romanToday};
})();
