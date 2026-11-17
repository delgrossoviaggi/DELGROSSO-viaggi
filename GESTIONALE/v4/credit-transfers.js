/**
 * DELGROSSO 4.0 — giroconto acconti/saldi TRA due prenotazioni dello stesso cliente.
 * Read-only preflight. Funds already in cash are NEVER added to pagamenti again.
 * SQL RPC must enforce identical rules, row locks and request-id idempotence.
 */
export const centesimi=value=>{
 const x=Number(value);
 if(!Number.isFinite(x)||Math.abs(x)>1_000_000)throw new Error('Importo non valido.');
 return Math.round(x*100);
};
export const normalizeCustomerName=value=>String(value||'').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it')
 .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export const normalizeCustomerPhone=value=>{
 let x=String(value||'').replace(/\D/g,'');
 if(x.startsWith('0039')&&x.length>=12)x=x.slice(4);
 else if(x.startsWith('39')&&x.length>=12&&x.length<=13)x=x.slice(2);
 return x.length>=8&&x.length<=11?x:'';
};
export function identityKey(booking){
 const full=normalizeCustomerName(booking?.cliente_nome||booking?.cliente);
 const phone=normalizeCustomerPhone(booking?.telefono);
 return full.split(' ').filter(Boolean).length>=2&&phone?full+'|'+phone:'';
}
export const validBooking=b=>!!b?.id&&!b?.riserva_aziendale;
export const canceled=b=>/annull|cancel|cancell|eliminat/i.test(String(b?.stato||''));
export function existingCashNet(booking,payments){
 const rows=(payments||[]).filter(x=>x.prenotazione_id===booking.id&&!/annull|cancel|cancell|storn/i.test(String(x.stato||'')));
 // A booking with a payment balance must have traceable original transactions.
 const net=rows.reduce((n,p)=>n+centesimi(p.importo),0);
 const stored=centesimi(booking.pagato||0);
 const mismatch=rows.length===0&&stored!==0 || rows.length>0&&Math.abs(stored-net)>1;
 return {net,declared:stored,rows:rows.length,mismatch};
}
export function bookingCreditBalance(booking,payments,transfers){
 const original=existingCashNet(booking,payments);
 const incoming=(transfers||[]).filter(t=>t.target_booking_id===booking.id&&t.stato==='Confermato')
  .reduce((n,t)=>n+centesimi(t.importo),0);
 const outgoing=(transfers||[]).filter(t=>t.source_booking_id===booking.id&&t.stato==='Confermato')
  .reduce((n,t)=>n+centesimi(t.importo),0);
 const effective=original.net+incoming-outgoing;
 return {...original,incoming,outgoing,effective,
  remaining:Math.max(0,centesimi(booking.totale||0)-effective),
  availableCredit:Math.max(0,effective)};
}
export function destinationsForCredit(source,bookings,trips,today){
 const who=identityKey(source);
 if(!validBooking(source)||!who)return [];
 const byTrip=new Map((trips||[]).map(t=>[t.id,t]));
 return (bookings||[]).filter(b=>{
  const t=byTrip.get(b.viaggio_id);
  return validBooking(b)&&!canceled(b)&&b.id!==source.id&&
   b.viaggio_id!==source.viaggio_id&&identityKey(b)===who&&
   t && t.data_partenza>=today&&!t.archiviato_at&&!/annull|cancel|rinviat/i.test(String(t.stato||''));
 }).sort((a,b)=>String(byTrip.get(a.viaggio_id)?.data_partenza).localeCompare(String(byTrip.get(b.viaggio_id)?.data_partenza)));
}
export function reviewCreditTransfer({source,target,trips,bookings,payments,transfers,amount,reason,today,allowIncomplete=false}){
 if(!validBooking(source)||!validBooking(target))throw new Error('Prenotazioni non valide.');
 const id1=identityKey(source),id2=identityKey(target);
 if(!id1||id1!==id2)throw new Error('Nome e cognome e telefono devono corrispondere fra le due prenotazioni.');
 if(!destinationsForCredit(source,bookings,trips,today).some(x=>x.id===target.id))
  throw new Error('Il cliente deve avere un’altra prenotazione attiva su un viaggio futuro diverso.');
 const s=bookingCreditBalance(source,payments,transfers),d=bookingCreditBalance(target,payments,transfers);
 if(s.mismatch||d.mismatch)throw new Error('Quote non riconciliate: controllare prima registro incassi e prenotazione.');
 if(s.effective<0||d.effective<0)throw new Error('Credito negativo da riconciliare.');
 const available=s.availableCredit,due=d.remaining,amt=centesimi(amount);
 if(amt<=0)throw new Error('La quota da trasferire deve essere positiva.');
 if(amt>available)throw new Error('La quota supera il credito disponibile nel viaggio di origine.');
 if(amt>due)throw new Error('La quota supera il saldo da pagare della prenotazione di destinazione.');
 const note=String(reason||'').trim();
 if(note.length<8||note.length>800)throw new Error('Indica una motivazione dettagliata (8–800 caratteri).');
 const origin=(trips||[]).find(t=>t.id===source.viaggio_id);
 const isFailed=/non\s?format|annull|cancel|rinviat|soppres/i.test(String(origin?.stato||''))||
   canceled(source);
 if(!isFailed&&!allowIncomplete)
  throw new Error('Prima di trasferire la quota, il viaggio di origine deve risultare non formato/annullato oppure la prenotazione deve essere annullata.');
 return {sourceId:source.id,targetId:target.id,originTripId:source.viaggio_id,
  targetTripId:target.viaggio_id,sourcePaidCents:s.effective,targetPaidCents:d.effective,
  availableCents:available,dueCents:due,transferCents:amt,afterSourceCents:s.effective-amt,
  afterTargetCents:d.effective+amt,newTargetDueCents:due-amt,
  amountEUR:amt/100,reason:note,sourceUpdatedAt:source.updated_at,
  targetUpdatedAt:target.updated_at,requiresCancellation:!isFailed,
  customer:source.cliente_nome||source.cliente,phone:source.telefono};
}
