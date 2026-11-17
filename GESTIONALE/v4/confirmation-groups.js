/**
 * DELGROSSO VIAGGI 4.0 — conferma cumulativa per referente.
 * Modello puro: non accorpa prenotazioni, non registra quote né scrive su Supabase.
 * Raggruppa soltanto nome e cognome completi + telefono, stesso viaggio logico,
 * stessa data anche quando prenotazioni sono sul BUS principale e BUS BIS.
 * Mantiene le sezioni separate per fermata di partenza.
 */
const txt=x=>String(x??'').trim();
export function normalizeFullName(name){
 return txt(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('it').replace(/[^a-z0-9 ]/g,' ')
 .replace(/\s+/g,' ').trim();
}
export function normalizeTelephone(phone){
 let digits=txt(phone).replace(/[^0-9]/g,'');
 if(digits.startsWith('0039')&&digits.length>=12)digits=digits.slice(4);
 else if(digits.startsWith('39')&&digits.length>=11&&digits.length<=13)digits=digits.slice(2);
 return digits.length>=8&&digits.length<=11?digits:'';
}
export function fullIdentity(booking){
 const name=normalizeFullName(booking?.cliente_nome||booking?.cliente);
 const phone=normalizeTelephone(booking?.telefono);
 // Niente aggregazione con soli nomi propri o numeri incompleti.
 return name.split(' ').filter(Boolean).length>=2&&phone?name+'|'+phone:'';
}
export function eventKey(trip){
 if(!trip?.id||!trip?.data_partenza)return '';
 return String(trip.bis_parent_id||trip.id)+'|'+String(trip.data_partenza).slice(0,10);
}
export function stopKey(stop){
 return txt(stop).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('it').replace(/\s+/g,' ').replace(/[.,;]/g,'').trim()||'__FERMATA_DA_VERIFICARE__';
}
const cents=value=>{
 const v=Number(value);
 if(!Number.isFinite(v)||Math.abs(v)>1000000)throw new Error('Importo non valido nel riepilogo.');
 return Math.round(v*100);
};
const active=booking=>!(/annull|cancel|cancell|eliminat/i.test(txt(booking?.stato)))&&!booking?.riserva_aziendale;
const dateTime=value=>String(value||'');
const busLabel=trip=>Number(trip?.bis_numero||1)>1?'BUS BIS '+trip.bis_numero:(trip?.autobus||'BUS principale');
/**
 * @param {{id:string,cliente?:string,cliente_nome?:string,telefono?:string,viaggio_id:string}} selected
 * @returns {object} Summary amounts are in INTEGER CENTS, no rounding drift.
 */
export function collectCombinedConfirmation(selected,bookings,trips,payments){
 if(!selected?.id||!selected.viaggio_id)throw new Error('Seleziona una prenotazione valida.');
 const byTrip=new Map((trips||[]).map(t=>[t.id,t]));
 const origin=byTrip.get(selected.viaggio_id);
 if(!origin)throw new Error('Viaggio della prenotazione non trovato.');
 if(!active(selected))throw new Error('Prenotazione annullata o riservata.');
 const identity=fullIdentity(selected),key=eventKey(origin);
 const matches=identity?(bookings||[]).filter(b=>
  active(b)&&fullIdentity(b)===identity&&eventKey(byTrip.get(b.viaggio_id))===key
 ):[selected];
 if(!matches.find(b=>b.id===selected.id))matches.push(selected);
 const unique=new Map(matches.map(b=>[b.id,b]));
 const source=[...unique.values()].sort((a,b)=>
  dateTime(a.created_at).localeCompare(dateTime(b.created_at))||String(a.id).localeCompare(String(b.id)));
 const grouped=new Map();
 const allPay=new Map((payments||[]).filter(p=>p?.id).map(p=>[p.id,p]));
 const warnings=[];
 let totalCents=0,paidCents=0,passengers=0, paymentCount=0;
 for(const b of source){
  const trip=byTrip.get(b.viaggio_id);
  if(!trip)throw new Error('Viaggio di una prenotazione mancante.');
  const count=Number(b.posti);
  if(!Number.isSafeInteger(count)||count<1)throw new Error('Numero partecipanti non valido.');
  const amount=cents(b.totale);
  const claimed=cents(b.pagato);
  const ledger=[...allPay.values()].filter(p=>
    p.prenotazione_id===b.id&&!/annull|storn|cancel/i.test(txt(p.stato)));
  const ledgerNet=ledger.reduce((sum,p)=>sum+cents(p.importo),0);
  const effective=ledger.length?ledgerNet:claimed;
  if(ledger.length&&Math.abs(ledgerNet-claimed)>1){
   warnings.push('Controllare il pagato della prenotazione '+txt(b.codice||b.id)+
    ': riepilogo '+(claimed/100).toFixed(2)+' EUR, movimenti '+(ledgerNet/100).toFixed(2)+' EUR');
  }
  const keyStop=stopKey(b.fermata_partenza),label=txt(b.fermata_partenza)||'Fermata non specificata';
  if(!grouped.has(keyStop))grouped.set(keyStop,{
   stop:label,bookings:[],passengers:0,totalCents:0,paidCents:0
  });
  const g=grouped.get(keyStop);
  g.bookings.push({
   id:b.id,code:b.confirmation_number||b.codice||b.id_prenotazione||b.id,
   bus:busLabel(trip),busId:trip.id,passengers:count,
   seats:txt(b.posti_selezionati)||'Da assegnare',
   totalCents:amount,paidCents:effective,claimedPaidCents:claimed,
   paymentCount:ledger.length
  });
  g.passengers+=count;g.totalCents+=amount;g.paidCents+=effective;
  totalCents+=amount;paidCents+=effective;passengers+=count;paymentCount+=ledger.length;
 }
 const sections=[...grouped.values()].sort((a,b)=>a.stop.localeCompare(b.stop,'it'));
 return {
  title:txt(origin.titolo||origin.destinazione||'Viaggio'),
  date:String(origin.data_partenza).slice(0,10),
  reference:txt(selected.cliente_nome||selected.cliente),
  phone:txt(selected.telefono),
  eventRoot:String(origin.bis_parent_id||origin.id),
  selectedId:selected.id,
  bookings:source.map(b=>b.id),sections,
  passengers,bookingCount:source.length,paymentCount,
  totalCents,paidCents,dueCents:Math.max(0,totalCents-paidCents),
  surplusCents:Math.max(0,paidCents-totalCents),
  warnings
 };
}
