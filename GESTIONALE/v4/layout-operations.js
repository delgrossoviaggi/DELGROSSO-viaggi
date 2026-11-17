/** Pure helpers for DELGROSSO 4.0 official GT seatplan operations.
 * No direct Supabase writes. Official publishing is performed only by guarded RPCs.
 */
export function seatCount(config){
 return (Array.isArray(config?.rows)?config.rows:[]).reduce((n,r)=>
  n+(Array.isArray(r?.cells)?r.cells:[]).filter(c=>c?.type==='seat').length,0);
}
export function layoutIds(config){
 return (config?.rows||[]).flatMap(r=>(r.cells||[]).filter(c=>c?.type==='seat').map(c=>String(c.id||c.label||'').trim()));
}
export function isCompleteLayout(config,capacity){
 const cap=Number(capacity),ids=layoutIds(config);
 return Number.isInteger(cap)&&cap>0&&cap<=100&&
  ids.length===cap&&new Set(ids).size===cap&&
  ids.every(x=>/^[1-9]\d{0,2}$/.test(x)&&Number(x)<=cap)&&
  Array.from({length:cap},(_,i)=>String(i+1)).every(x=>ids.includes(x));
}
export function eligibleGtBuses(layout,fleet){
 const cap=seatCount(layout?.configurazione);
 if(!layout?.attivo||!isCompleteLayout(layout.configurazione,cap))return [];
 return (fleet||[]).filter(b=>b?.categoria==='GT'&&b.attivo!==false&&
  [53,63].includes(Number(b.posti))&&Number(b.posti)===cap);
}
export function layoutAssociations(id,busLayouts,tripLayouts){
 return {
  buses:(busLayouts||[]).filter(x=>x.layout_id===id),
  trips:(tripLayouts||[]).filter(x=>x.layout_id===id)
 };
}
export function archivePlan(layout,busLayouts,tripLayouts){
 if(!layout?.id)throw new Error('Piantina non trovata.');
 const refs=layoutAssociations(layout.id,busLayouts,tripLayouts);
 return {id:layout.id,isAssociated:refs.buses.length>0||refs.trips.length>0,
  assignedBuses:refs.buses.length,assignedTrips:refs.trips.length,
  message:refs.buses.length||refs.trips.length?
   'La piantina è associata a bus o viaggi. L’archiviazione elimina solo la bozza dalla libreria attiva: le configurazioni ufficiali restano conservate.' :
   'La piantina può essere spostata nel cestino e ripristinata; nessuna cancellazione fisica sarà eseguita.'};
}
export function compatibleTrips(layout,trips,buses){
 const cap=seatCount(layout?.configurazione),fleet=new Map((buses||[]).map(b=>[b.id,b]));
 if(!layout?.attivo||!isCompleteLayout(layout.configurazione,cap))return [];
 return (trips||[]).filter(t=>!t.archiviato_at&&
  fleet.has(t.autobus_id)&&fleet.get(t.autobus_id)?.categoria==='GT'&&
  Number(t.posti_totali)===cap);
}
