/* DELGROSSO VIAGGI — geometry and group-colour resolver.
 * Read-only, shared by V2/suite and V4. No personal data leaves the browser.
 * Layout is copied as-is from the published Supabase snapshot; never renumber seats.
 */
(function (root) {'use strict';
 const AVAILABLE_TYPES=new Set(['seat','aisle','door','empty','wc','table','driver']);
 const MAX_ROWS=35,MAX_COLS=8;
 const str=x=>String(x==null?'':x).trim();
 function seatList(raw){
  if(Array.isArray(raw))return [...new Set(raw.flatMap(seatList))].sort((a,b)=>Number(a)-Number(b));
  const x=str(raw);if(!x)return [];
  if(x.startsWith('['))try{const parsed=JSON.parse(x);if(Array.isArray(parsed))return seatList(parsed)}catch(_){}
  return [...new Set(x.split(/[,;\s|]+/).map(x=>x.replace(/^0+(\d)/,'$1')).filter(x=>/^[1-9]\d{0,2}$/.test(x)))].sort((a,b)=>Number(a)-Number(b));
 }
 function normalizeGeometry(config){
  const src=config?.configurazione||config;
  if(!src||!Array.isArray(src.rows)||!src.rows.length||src.rows.length>MAX_ROWS)
   throw Error('La piantina ufficiale non contiene file valide.');
  const rows=src.rows.map((r,i)=>{
   const raw=Array.isArray(r)?r:r?.cells;
   if(!Array.isArray(raw)||!raw.length||raw.length>MAX_COLS)
    throw Error('Fila '+(i+1)+': numero colonne non valido (1-8).');
   return {label:str(r?.label)||'Fila '+(i+1),cells:raw.map(c=>{
    if(typeof c==='number'||typeof c==='string'&&/^\d+$/.test(c))return {type:'seat',id:str(c),status:'available'};
    const type=c?.type||c;
    if(!AVAILABLE_TYPES.has(type))throw Error('Elemento non valido nella fila '+(i+1));
    if(type!=='seat')return {type};
    const id=str(c?.id??c?.number??c?.label);
    return {type,id,status:['available','blocked','out_of_service'].includes(c.status)?c.status:'available'};
   })};
  });
  const ids=rows.flatMap(r=>r.cells).filter(x=>x.type==='seat').map(x=>x.id);
  if(!ids.length||ids.some(x=>!/^[1-9]\d{0,2}$/.test(x))||ids.length!==new Set(ids).size)
   throw Error('La piantina contiene sedili mancanti, ripetuti o non numerati.');
  return {name:str(src.name)||'Piantina ufficiale',rows,capacity:ids.length,columns:Math.max(...rows.map(r=>r.cells.length)),
   frontLabel:str(src.frontLabel)||'FRONTE AUTOBUS',driverLabel:str(src.driverLabel)||'AUTISTA'};
 }
 function colour(n){
  const h=((n*137.508+14)%360)/60,s=.65,l=.81;
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2;
  let rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return rgb.map(v=>Math.round((v+m)*255));
 }
 function css(rgb){return 'rgb('+rgb.join(',')+')'}
 function pdfColor(rgb){return rgb.map(v=>Math.round(v/255*1000)/1000)}
 function sourceBookingSeats(booking,seatRows){
  const fromRows=seatList((seatRows||[]).filter(r=>String(r.prenotazione_id)===String(booking.id)).map(r=>r.posto));
  const fromBooking=seatList(booking.sedili?.length?booking.sedili:booking.posti_selezionati);
  return {seats:fromRows.length?fromRows:fromBooking,fromRows,fromBooking,
   mismatch:fromRows.length>0&&fromBooking.length>0&&fromRows.join(',')!==fromBooking.join(',')};
 }
 function buildPlan({layout,bookings=[],seatRows=[],capacity=null,strict=false}={}){
  const geometry=normalizeGeometry(layout);
  const ids=new Set(geometry.rows.flatMap(r=>r.cells.filter(c=>c.type==='seat').map(c=>c.id)));
  const warnings=[],used=new Map(),groups=[];
  // Group colours follow the numerical order of the first assigned seat.
  const sorted=(bookings||[]).slice().map((b,i)=>({b,i,assignment:sourceBookingSeats(b,seatRows)}))
   .sort((a,b)=>Number(a.assignment.seats[0]||9999)-Number(b.assignment.seats[0]||9999)||String(a.b.id||'').localeCompare(String(b.b.id||'')));
  for(const {b,i,assignment} of sorted){
   const n=groups.length+1,number='G'+String(n).padStart(2,'0'),rgb=colour(n),seats=assignment.seats;
   const id=String(b.id||b.codice||'prenotazione-'+i),name=str(b.cliente_nome||b.cliente)||'Referente non indicato';
   const g={id,number,name,seats,stop:str(b.fermata_partenza),people:Number(b.posti||0),rgb,css:css(rgb),pdf:pdfColor(rgb)};
   groups.push(g);
   if(assignment.mismatch)warnings.push(number+': posti diversi tra prenotazione e registro sedili (verificare prima della partenza).');
   if(seats.length!==Number(b.posti||0))warnings.push(number+': '+b.posti+' passeggeri ma '+seats.length+' posti assegnati.');
   for(const seat of seats){
    if(!ids.has(seat))warnings.push(number+': posto '+seat+' non presente sulla piantina pubblicata.');
    const cell=geometry.rows.flatMap(r=>r.cells).find(c=>c.type==='seat'&&c.id===seat);
    if(cell&&cell.status!=='available')warnings.push(number+': posto '+seat+' bloccato o fuori servizio.');
    if(used.has(seat))warnings.push('CONFLITTO: posto '+seat+' assegnato a '+used.get(seat).number+' e '+number+'.');
    else used.set(seat,g);
   }
  }
  if(capacity!=null&&Number.isFinite(Number(capacity))&&Number(capacity)>geometry.capacity)
   warnings.push('Capienza del viaggio '+capacity+' superiore ai '+geometry.capacity+' sedili presenti in piantina.');
  if(strict&&warnings.length)throw Error('La piantina non è coerente con i dati dei prenotati: '+warnings.slice(0,5).join(' | '));
  return {geometry,groups,bySeat:used,warnings};
 }
 function resolveLayout(trip,tripLayouts=[],busLayouts=[]){
  const t=(tripLayouts||[]).find(x=>String(x.viaggio_id)===String(trip?.id)&&
   (!x.autobus_id||String(x.autobus_id)===String(trip.autobus_id)));
  if(t?.configurazione)return {config:t.configurazione,source:'viaggio',version:t.versione};
  const b=(busLayouts||[]).find(x=>String(x.autobus_id)===String(trip?.autobus_id));
  if(b?.configurazione)return {config:b.configurazione,source:'autobus',version:b.versione};
  return null;
 }
 const api={seatList,normalizeGeometry,colour,css,pdfColor,sourceBookingSeats,buildPlan,resolveLayout};
 root.DGSeatGroups=Object.freeze(api);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
