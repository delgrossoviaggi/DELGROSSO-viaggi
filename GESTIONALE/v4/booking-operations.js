/* DELGROSSO VIAGGI 4.0 — verifiche pure per gestione partecipanti e posti.
 * Nessuna funzione modifica il database. La conferma vera è una RPC transazionale Supabase.
 */
export function activeBooking(b){
 return b && !/annull|cancel|cancell|eliminat/i.test(String(b.stato||''));
}
export function busRoot(t){return String(t?.bis_parent_id||t?.id||'');}
export function normalizeDestination(value){
 return String(value||'').toLocaleLowerCase('it').replace(/[^a-z0-9]/g,'');
}
export function eligibleBusTargets(origin,trips){
 if(!origin?.id)return [];
 const root=busRoot(origin);
 return (trips||[]).filter(t=>
  t.id && !t.archiviato_at && t.data_partenza===origin.data_partenza &&
  busRoot(t)===root && !/annull|cancel|chius/i.test(String(t.stato||'')))
  .sort((a,b)=>Number(a.bis_numero||1)-Number(b.bis_numero||1));
}
export function eligibleDateTargets(origin,trips,today){
 if(!origin?.id)return [];
 const dest=normalizeDestination(origin.destinazione);
 return (trips||[]).filter(t=>
  t.id!==origin.id && t.data_partenza>origin.data_partenza &&
  t.data_partenza>=today && !t.archiviato_at &&
  dest && normalizeDestination(t.destinazione)===dest &&
  !/annull|cancel|chius|sold\s*out/i.test(String(t.stato||'')))
  .sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)) || Number(a.bis_numero||1)-Number(b.bis_numero||1));
}
export function seatNumbers(raw){
 const list=(Array.isArray(raw)?raw:String(raw||'').trim().split(/[;,\s]+/)).map(s=>String(s).trim()).filter(Boolean);
 if(list.some(s=>!(/^\d{1,4}$/.test(s))||Number(s)<1||Number(s)>999))throw new Error('Posti non validi: usare numeri da 1 a 999 separati da virgola.');
 const numbers=list.map(s=>String(Number(s)));
 if(new Set(numbers).size!==numbers.length)throw new Error('Non scegliere due volte lo stesso sedile.');
 return numbers.sort((a,b)=>Number(a)-Number(b));
}
export function seatInventory(trip,bookings,seatRows,{ignoreBookingId=null}={}){
 if(!trip?.id)throw new Error('Seleziona il viaggio.');
 const booked=(bookings||[]).filter(b=>b.viaggio_id===trip.id && activeBooking(b) && b.id!==ignoreBookingId);
 const owner=new Map(),problems=[];
 const seatSources=[];
 for(const b of booked){
  for(const s of String(b.posti_selezionati||'').split(/[,;\s]+/).filter(Boolean)){
    seatSources.push({s,b,source:'booking'});
  }
 }
 for(const seat of seatRows||[]){
  if(seat.viaggio_id!==trip.id || seat.prenotazione_id===ignoreBookingId)continue;
  const b=booked.find(b=>b.id===seat.prenotazione_id);
  if(!b)continue;
  seatSources.push({s:String(seat.posto),b,source:'registro'});
 }
 for(const x of seatSources){
  const key=String(x.s).trim();
  if(!/^[1-9]\d{0,2}$/.test(key) || Number(key)>Number(trip.posti_totali)) {
   problems.push('Posto storico non valido: '+key);continue;
  }
  const prior=owner.get(String(Number(key)));
  if(prior && prior.id!==x.b.id)problems.push('Posto '+key+' assegnato a più prenotazioni');
  owner.set(String(Number(key)),x.b);
 }
 const passengers=booked.reduce((n,b)=>n+Number(b.posti||0),0);
 if(passengers>Number(trip.posti_totali||0))problems.push('Capienza del viaggio superata');
 if(owner.size!==passengers)problems.push('Il numero di posti assegnati non coincide con i passeggeri ('+owner.size+' / '+passengers+')');
 const free=[];
 for(let n=1;n<=Number(trip.posti_totali||0);n++)if(!owner.has(String(n)))free.push(String(n));
 return {taken:owner,free,passengers,problems:[...new Set(problems)],capacity:Number(trip.posti_totali||0)};
}
export function reviewBusTransfer({booking,origin,target,bookings,seatRows,chosen,layout=null}){
 if(!booking||!origin||!target)throw new Error('Prenotazione e autobus obbligatori.');
 if(!activeBooking(booking)||booking.riserva_aziendale)throw new Error('Non si possono spostare prenotazioni annullate o riserve.');
 if(booking.checkin_effettuato)throw new Error('Check-in già registrato: controllare prima le presenze.');
 const buses=eligibleBusTargets(origin,[target]);
 if(!buses.length)throw new Error('Il bus di destinazione non appartiene alla stessa partenza.');
 const seats=seatNumbers(chosen);
 const expected=Number(booking.posti);
 if(seats.length!==expected)throw new Error('Occorrono '+expected+' sedili, selezionati '+seats.length+'.');
 if(!seats.length)throw new Error('Seleziona i sedili.');
 const inventory=seatInventory(target,bookings,seatRows,{ignoreBookingId:origin.id===target.id?booking.id:null});
 if(inventory.problems.length)throw new Error('Posti da riconciliare prima dello spostamento: '+inventory.problems.join('; '));
 if(seats.some(s=>Number(s)>inventory.capacity))throw new Error('Posto fuori capienza.');

 if(Array.isArray(layout?.rows)&&layout.rows.length){
  const usable=new Set();
  for(const row of layout.rows)for(const cell of (Array.isArray(row)?row:row.cells||[])){
   if(cell?.type!=='seat'||['blocked','out_of_service'].includes(cell.status))continue;
   if(/^[1-9]\d{0,2}$/.test(String(cell.id||cell.label)))
    usable.add(String(Number(cell.id||cell.label)));
  }
  if(seats.some(n=>!usable.has(n)))
   throw new Error('Uno o più posti non sono presenti o sono fuori servizio nella piantina ufficiale.');
 }

 const conflicts=seats.filter(s=>inventory.taken.has(s));
 if(conflicts.length)throw new Error('Sedili occupati: '+conflicts.join(', '));
 if(inventory.free.length<expected)throw new Error('Posti liberi insufficienti.');
 return {bookingId:booking.id,sourceTripId:origin.id,targetTripId:target.id,
  oldSeats:seatNumbers(String(booking.posti_selezionati||'').split(/[,;\s]+/).filter(Boolean)),
  seats,passengers:expected,changedBus:origin.id!==target.id,
  paid:Number(booking.pagato||0),total:Number(booking.totale||0)};
}
