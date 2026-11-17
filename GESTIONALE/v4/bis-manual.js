/**
 * Selezione manuale dei sedili da aprire su un BUS BIS.
 * Helpers senza accesso a rete o DB: le modifiche effettive richiedono la RPC
 * dg4_open_trip_bis_manual_v1 (in transazione) e la protezione DB dei posti bloccati.
 */
export const seatId=x=>String(x??'').trim();
export function usableTemplates(library,bus){
 const cap=Number(bus?.posti||0);
 if(!Number.isInteger(cap)||cap<1||cap>100)return [];
 return (library||[]).filter(l=>l.attivo!==false && l.id && l.configurazione &&
  inspectLayout(l.configurazione,cap).valid);
}
export function inspectLayout(config,capacity){
 const rows=config?.rows,cap=Number(capacity),ids=[],unusable=new Set();
 if(!Number.isInteger(cap)||cap<1||cap>100||!Array.isArray(rows)||!rows.length||rows.length>35)
  return {valid:false,reason:'Piantina ufficiale non disponibile',seats:[],unusable};
 for(const row of rows){
  if(!Array.isArray(row?.cells)||row.cells.length>8||!row.cells.length)
   return {valid:false,reason:'Fila piantina non valida',seats:[],unusable};
  for(const c of row.cells){
   if(c?.type!=='seat')continue;
   const n=seatId(c.id);
   if(!/^[1-9]\d{0,2}$/.test(n)||Number(n)>cap)
    return {valid:false,reason:'Numerazione piantina incompatibile',seats:[],unusable};
   ids.push(n);
   if(c.status==='out_of_service'||c.status==='blocked')unusable.add(n);
  }
 }
 if(ids.length!==cap||new Set(ids).size!==cap ||
    Array.from({length:cap},(_,i)=>String(i+1)).some(n=>!ids.includes(n)))
  return {valid:false,reason:'La piantina non contiene tutti i posti fisici numerati',seats:[],unusable};
 return {valid:true,reason:'',seats:ids,unusable};
}
export function normalizeManualSeats(input,capacity){
 const cap=Number(capacity),data=Array.isArray(input)?input:String(input||'').split(/[;,\s]+/);
 if(!Number.isInteger(cap)||cap<1||cap>100)throw new Error('Capienza autobus non valida.');
 const out=data.map(x=>seatId(x)).filter(Boolean);
 if(out.some(x=>!/^\d{1,3}$/.test(x)||Number(x)<1||Number(x)>cap))
  throw new Error('I posti selezionati devono essere compresi fra 1 e '+cap+'.');
 const numbers=out.map(x=>String(Number(x)));
 if(new Set(numbers).size!==numbers.length)throw new Error('Lo stesso posto è stato selezionato più volte.');
 return numbers.sort((a,b)=>Number(a)-Number(b));
}
export function prepareBisSeatOpening({source,bus,template,selected,alreadyBooked=[],today,allTrips=[]}){
 if(!source?.id||source.archiviato_at||source.data_partenza<today||
    /annull|cancel|rinviat/i.test(String(source.stato||'')))
  throw new Error('Seleziona una partenza futura attiva.');
 if(!bus?.id||bus.attivo===false||!/GT/i.test(String(bus.categoria||'')))
  throw new Error('Seleziona un autobus GT attivo.');
 const cap=Number(bus.posti),report=inspectLayout(template?.configurazione,cap);
 if(!template?.id||!report.valid)
  throw new Error('Prima di aprire il BIS serve una piantina ufficiale compatibile con la capienza fisica del bus.');
 if(allTrips.some(t=>t.id!==source.id&&t.autobus_id===bus.id&&t.data_partenza===source.data_partenza&&
    !t.archiviato_at&&!/annull|cancel/i.test(String(t.stato||''))))
  throw new Error('L’autobus è già assegnato a un altro viaggio nella stessa data.');
 if(alreadyBooked.length)throw new Error('Le prenotazioni esistenti devono essere controllate prima di aprire il BIS.');
 const seats=normalizeManualSeats(selected,cap);
 if(!seats.length)throw new Error('Scegli almeno un posto da rendere prenotabile.');
 const blocked=seats.filter(x=>report.unusable.has(x));
 if(blocked.length)throw new Error('Non puoi aprire posti bloccati o fuori servizio: '+blocked.join(', '));
 return {
  sourceTripId:source.id,busId:bus.id,layoutId:template.id,
  date:source.data_partenza,physicalSeats:cap,
  bookableCount:seats.length,bookableSeats:seats,
  closedSeats:report.seats.filter(x=>!seats.includes(x)),
  publish:false
 };
}
export function previewManualLayout(config,capacity,selected){
 const report=inspectLayout(config,capacity);
 if(!report.valid)throw new Error(report.reason);
 const seats=normalizeManualSeats(selected,capacity);
 if(!seats.length)throw new Error('Scegli almeno un posto.');
 if(seats.some(x=>report.unusable.has(x)))throw new Error('Selezione contenente posti fuori servizio.');
 const allowed=new Set(seats);
 const copy=JSON.parse(JSON.stringify(config));
 copy.name=String(config.name||'Piantina GT')+' · BIS manuale';
 copy.rows=copy.rows.map(row=>({...row,cells:row.cells.map(cell=>
  cell.type==='seat'?{...cell,status:cell.status==='out_of_service'?'out_of_service':allowed.has(seatId(cell.id))?'available':'blocked'}:cell)}));
 return copy;
}
