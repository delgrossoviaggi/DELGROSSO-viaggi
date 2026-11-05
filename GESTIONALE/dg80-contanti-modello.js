/* DELGROSSO V80 — modello di riconciliazione contanti per singolo viaggio.
 * Pure, read-only, calcoli interi in centesimi. Non confonde trasferimenti di
 * cassa con nuovi incassi e non attribuisce un pagamento a un cliente diverso.
 */
(function(){
'use strict';
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cents=v=>{const x=Number(v);return Number.isFinite(x)?Math.round(x*100):null};
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((n||0)/100);
const recorded=p=>/^(registrato|confermato|pagato)$/i.test(txt(p.stato));
const cashMethod=s=>/^(contanti|contante|cash|denaro contante)$/i.test(norm(s));
const refund=p=>/rimbors/i.test(txt(p.tipo));
const closedBooking=b=>/annull|cancel|storn|rimbors/i.test(txt(b?.stato));
function build(input={}){
 const trips=input.trips||[],bookings=input.bookings||[],payments=input.payments||[],
  operators=input.operators||[],cashTransfers=input.cashTransfers||[];
 const opById=new Map(),idByName=new Map();
 operators.filter(o=>o.attivo!==false).forEach(o=>{
  const name=norm(o.username);
  if(o.user_id){opById.set(txt(o.user_id),name);idByName.set(name,txt(o.user_id));}
 });
 function owner(p){
  const id=txt(p.incassato_da_user_id);
  const byId=id?opById.get(id):null;
  const n=byId||(!id?norm(p.incassato_da):'');
  return n==='nicola'?'nicola':n==='raffaele'?'raffaele':'nonAttribuiti';
 }
 const tripById=new Map(trips.map(t=>[txt(t.id),t]));
 const bookingById=new Map(bookings.map(b=>[txt(b.id),b]));
 const byRoot=new Map();
 function rootId(t){
  if(!t)return '';
  const par=txt(t.bis_parent_id);
  return par&&tripById.has(par)?par:txt(t.id);
 }
 function rootForPayment(p,b){
  const fromPayment=txt(p.viaggio_id),fromBooking=txt(b?.viaggio_id);
  const mismatch=Boolean(fromBooking&&fromPayment&&fromBooking!==fromPayment);
  const id=fromBooking||fromPayment;
  return {id:tripById.has(id)?rootId(tripById.get(id)):'',mismatch,originalId:id};
 }
 for(const t of trips){
  const id=rootId(t),root=tripById.get(id)||t;
  if(!byRoot.has(id))byRoot.set(id,{
   id,trip:root,buses:[],movements:[],nicola:0,raffaele:0,nonAttribuiti:0,netto:0,
   refunds:0,received:0
  });
  byRoot.get(id).buses.push(t);
 }
 const issues=[],all=[],seen=new Set();
 const totals={nicola:0,raffaele:0,nonAttribuiti:0,netto:0,received:0,refunds:0};
 let excludedMethods=0;
 for(const p of payments){
  const paymentId=txt(p.id);
  if(!paymentId||seen.has(paymentId))continue;seen.add(paymentId);
  if(!recorded(p))continue;
  const method1=txt(p.metodo_pagamento),method2=txt(p.metodo);
  if(method1&&method2&&cashMethod(method1)!==cashMethod(method2)){
   issues.push('Metodo di pagamento contrastante per ricevuta '+txt(p.receipt_number||paymentId.slice(0,8))+'.');
   continue;
  }
  if(!cashMethod(method1||method2)){excludedMethods++;continue;}
  const raw=cents(p.importo);
  if(raw===null){issues.push('Importo non valido su movimento '+paymentId.slice(0,8)+'.');continue;}
  if(!refund(p)&&raw<0){issues.push('Importo negativo non classificato come rimborso: '+paymentId.slice(0,8)+'.');continue;}
  const amount=refund(p)?-Math.abs(raw):raw;
  const b=bookingById.get(txt(p.prenotazione_id));
  const ref=rootForPayment(p,b);
  if(ref.mismatch)issues.push('Il movimento '+paymentId.slice(0,8)+' riporta un viaggio diverso dalla prenotazione; controllare.');
  const who=owner(p);
  const rec={
   id:paymentId,amount,owner:who,refund:refund(p),
   date:txt(p.data_pagamento||p.created_at).slice(0,10),
   cliente:txt(p.cliente||b?.cliente||b?.cliente_nome)||'Cliente non identificato',
   clienteOrigine:txt(p.cliente)?'pagamento':b?'prenotazione':'nessuna anagrafica',
   booking:txt(b?.codice||b?.confirmation_number||b?.id_prenotazione||''),
   bookingStatus:closedBooking(b)?'Prenotazione annullata':'',
   tipo:txt(p.tipo)||'Pagamento',receipt:txt(p.receipt_number||p.ricevuta),
   bus:tripById.get(txt(b?.viaggio_id||p.viaggio_id))?.bis_numero||1,
   stop:txt(b?.fermata_partenza),rootId:ref.id,mismatch:ref.mismatch
  };
  if(ref.id&&byRoot.has(ref.id)){
   const g=byRoot.get(ref.id);
   g.movements.push(rec);g[who]+=amount;g.netto+=amount;
   if(amount>=0)g.received+=amount;else g.refunds+=-amount;
  }else{
   rec.rootId='';
   issues.push('Pagamento contante senza viaggio collegabile: '+paymentId.slice(0,8)+'.');
  }
  totals[who]+=amount;totals.netto+=amount;
  if(amount>=0)totals.received+=amount;else totals.refunds+=-amount;
  all.push(rec);
 }
 const unresolved=all.filter(x=>!x.rootId);
 const groupList=[...byRoot.values()].map(g=>{
  g.buses.sort((a,b)=>Number(a.bis_numero||1)-Number(b.bis_numero||1));
  g.movements.sort((a,b)=>a.date.localeCompare(b.date)||a.cliente.localeCompare(b.cliente,'it'));
  return g;
 }).sort((a,b)=>txt(b.trip.data_partenza).localeCompare(txt(a.trip.data_partenza))||
  txt(a.trip.titolo).localeCompare(txt(b.trip.titolo),'it'));
 if(totals.nicola+totals.raffaele+totals.nonAttribuiti!==totals.netto)
  throw Error('Riconciliazione importi non riuscita.');
 const idNicola=idByName.get('nicola'),idRaffaele=idByName.get('raffaele');
 const transferSummary={nicola:0,raffaele:0,unresolved:0,records:[]};
 for(const tr of cashTransfers){
  if(!/^(confermato|eseguito|completato|registrato)$/i.test(txt(tr.stato)))continue;
  const amt=cents(tr.importo);
  if(amt===null||amt<=0){issues.push('Trasferimento cassa con importo non valido.');continue;}
  const from=txt(tr.da_operatore_user_id),to=txt(tr.a_operatore_user_id);
  if(!from||!to||from===to){issues.push('Trasferimento cassa senza operatori validi.');continue;}
  if(from===idNicola)transferSummary.nicola-=amt;
  else if(from===idRaffaele)transferSummary.raffaele-=amt;
  else transferSummary.unresolved-=amt;
  if(to===idNicola)transferSummary.nicola+=amt;
  else if(to===idRaffaele)transferSummary.raffaele+=amt;
  else transferSummary.unresolved+=amt;
  transferSummary.records.push({
   id:txt(tr.id),from:from===idNicola?'Nicola':from===idRaffaele?'Raffaele':'Altro',
   to:to===idNicola?'Nicola':to===idRaffaele?'Raffaele':'Altro',
   amount:amt,date:txt(tr.data_trasferimento||tr.created_at).slice(0,10),note:txt(tr.note)
  });
 }
 if(transferSummary.nicola+transferSummary.raffaele+transferSummary.unresolved!==0)
  throw Error('Trasferimenti cassa non riconciliati.');
 return {groups:groupList,unresolved,totals,transfers:transferSummary,
  inCaricoViaggi:{
   nicola:totals.nicola+transferSummary.nicola,
   raffaele:totals.raffaele+transferSummary.raffaele,
   nonAttribuiti:totals.nonAttribuiti+transferSummary.unresolved
  },
  movements:all,excludedMethods,issues:[...new Set(issues)]};
}
window.DG80CashModel={build,cents,money};
})();
