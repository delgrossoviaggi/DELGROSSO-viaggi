/* DELGROSSO V5 · PDF nominativi e colori · sola lettura.
 * Usa i layout pubblicati del viaggio/bus, mai una piantina inventata.
 * Si avvale del modulo DG33 autenticato e del generatore PDF esistente. */
(function(root){'use strict';
 let inProgress=false,lastUrl=null;
 function norm(v){return String(v==null?'':v)}
 function fileName(v){return norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,65)}
 function sourceSeats(booking,seatRows){
  const resolver=root.DGSeatGroups;
  if(!resolver?.sourceBookingSeats)throw Error('Modulo geometrie e colori non caricato.');
  return resolver.sourceBookingSeats(booking,seatRows);
 }
 function prepare(data,selected){
  const engine=root.DG33V2,resolve=root.DGSeatGroups;
  if(!engine?.groups||!resolve?.buildPlan||!resolve?.normalizeGeometry)throw Error('Moduli piantine ufficiali non disponibili.');
  if(data.issues?.some(x=>/Piantine ufficiali (bus|viaggio)/i.test(x)))throw Error('Lettura dei layout ufficiali non riuscita: '+data.issues.join(' | '));
  const chosen=data.trips.find(t=>norm(t.id)===norm(selected));
  if(!chosen)throw Error('Viaggio non trovato in Supabase.');
  const rootId=norm(chosen.bis_parent_id||chosen.id);
  const groups=engine.groups(data,{id:rootId});
  if(groups.length!==1)throw Error('Impossibile identificare in modo univoco BUS e BUS BIS.');
  for(const bus of groups[0].buses){
   if(!bus.official||!bus.layout?.rows?.length)throw Error('Piantina UFFICIALE non pubblicata per '+bus.name+'. Vai a Crea/Modifica piantine e pubblicala per il viaggio o autobus.');
   const geometry=resolve.normalizeGeometry(bus.layout);
   const count=Number(bus.trip?.posti_totali);
   if(!Number.isInteger(count)||geometry.capacity!==count)throw Error('Capienza diversa dalla piantina ufficiale per '+bus.name+': '+geometry.capacity+' / '+count+'.');
   const ids=geometry.rows.flatMap(r=>r.cells.filter(c=>c.type==='seat').map(c=>Number(c.id)));
   if(ids.length!==count||ids.some((v,i)=>!Number.isInteger(v)||v<1||v>count)||new Set(ids).size!==count)throw Error('Numerazione fisica non valida per '+bus.name);
   const rows=data.seatrows.filter(r=>norm(r.viaggio_id)===norm(bus.trip.id));
   bus.seatRows=rows;
   bus.bookings=bus.bookings.map(b=>{
    const assignment=sourceSeats(b,rows);
    if(assignment.mismatch)throw Error('Posti discordanti tra prenotazione e registro per '+(b.cliente_nome||b.cliente||b.id)+'.');
    if(assignment.seats.length!==Number(b.posti||0))throw Error('Numero persone/posti discordante per '+(b.cliente_nome||b.cliente||b.id)+'.');
    return {...b,sedili:assignment.seats};
   });
   const plan=resolve.buildPlan({layout:bus.layout,bookings:bus.bookings,seatRows:rows,capacity:count,strict:true});
   if(plan.warnings.length)throw Error(plan.warnings.join(' | '));
  }
  return groups;
 }
 async function exportSelected(){
  if(inProgress)return;
  inProgress=true;
  const btns=[...document.querySelectorAll('button[onclick*="DG5NomiPdf.exportSelected"]')];
  btns.forEach(b=>b.disabled=true);
  try{
   const selected=document.getElementById('controlTripSelect')?.value;
   if(!selected)throw Error('Seleziona prima il viaggio nella Control Room.');
   const data=await root.DG33V2?.getLiveSnapshot?.();
   if(!data)throw Error('Accedi al gestionale prima di generare il PDF.');
   const groups=prepare(data,selected);
   if(!root.DG2Pdf?.makeOperationalPdf)throw Error('Generatore PDF non caricato.');
   const bytes=root.DG2Pdf.makeOperationalPdf(groups,{onlyMaps:true,requireOfficial:true});
   if(!(bytes?.length>1500))throw Error('PDF non generato correttamente.');
   const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);
   if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=url;
   const a=document.createElement('a');
   a.href=url;a.download='DELGROSSO_PIANTINA_NOMI_COLORI_'+fileName(groups[0].title)+'.pdf';
   document.body.appendChild(a);a.click();a.remove();
   if(typeof root.toast==='function')root.toast('PDF ufficiale scaricato: nomi e colori per ogni posto',true);
  }catch(e){
   if(typeof root.toast==='function')root.toast('PDF non generato: '+e.message,false);
   else alert('PDF non generato: '+e.message);
  }finally{btns.forEach(b=>b.disabled=false);inProgress=false}
 }
 root.addEventListener('pagehide',()=>{if(lastUrl)URL.revokeObjectURL(lastUrl)});
 root.DG5NomiPdf=Object.freeze({exportSelected,prepare});
})(window);
