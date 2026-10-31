import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('prenota.html');
const bridge=read('js/gestionale.js');
const server=read('supabase/functions/send-booking-confirmation/index.ts');
const siteBridge=read('supabase/functions/gestionale-bridge/index.ts');
const capacitySql=read('supabase/patches/guard_public_booking_capacity.sql');
assert.ok(capacitySql.includes('v_occupied + v_posti'),'Database passenger capacity guard must be versioned');
assert.ok(capacitySql.includes('cardinality(string_to_array(p.posti_selezionati'),'Legacy passenger count guard must be present');

let count=0;
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  if(!match[1].trim())continue;
  new vm.Script(match[1],{filename:'prenota.html inline script'});
  count++;
}
assert.ok(count>0,'Booking page inline logic missing');
new vm.Script(bridge,{filename:'js/gestionale.js'});

assert.ok(html.includes('result.numero'), 'Official booking number missing');
assert.ok(html.includes('const confirmationPdf=DGReceipt.generate(receiptData)'), 'PDF should be generated once');
assert.ok(html.includes("gestBridge('archive-booking',{bookingId,token,pdfBase64:btoa(encoded)})"), 'PDF must use site bridge with token');
assert.ok(html.includes("gestBridge('booking-pdf-url',{bookingId,token})"), 'PDF retry must retrieve existing archive');
assert.ok(siteBridge.includes('token:String(token)'), 'Site bridge must forward the booking token');
assert.ok(siteBridge.includes('if(!bookingId||!token||!pdfBase64)'), 'Site bridge must reject missing token');
assert.ok(bridge.includes("action==='archive-booking'?55000:18000"), 'Archive needs extended timeout');
assert.ok(html.includes('await archiveConfirmation()'), 'PDF archival not called');
assert.ok(html.includes('<a id="downloadReceipt"'), 'Native customer PDF link missing');
assert.ok(bridge.includes('stableRequestId'), 'Idempotent booking request identifier missing');

assert.ok(server.includes('Reinvio riservato agli operatori'), 'Protected email resend missing');
assert.ok(server.includes('pdf.length>5000000'), 'PDF upload validation missing');
assert.ok(server.includes('confirmation_email_error:emailError'), 'SMTP failure tracking missing');


assert.ok(html.includes('Promise.all([loadStops(trip,token),getBookedSeats(runId),getBusLayout(runId)])'),
  'Stops, seat availability and layout should load concurrently');
assert.ok(html.includes('const runId=String(trip.active_viaggio_id||trip.id);'), 'Bus seat map must use the active BIS vehicle');
assert.ok(html.includes('bookingRunId=String(current.active_viaggio_id||current.id)'), 'Reservation must use the active BIS vehicle');
assert.ok(html.includes('viaggioId:bookingRunId'), 'Booking request must target chosen BUS BIS');
assert.ok(html.includes('getBookedSeats(bookingRunId)'), 'Pre-submit seat check must target chosen BUS BIS');
assert.ok(html.includes('submit.disabled=true'), 'Booking must be disabled while loading');
assert.ok(html.includes('if(token!==loadToken)return'), 'Stale requests must be ignored');

// Simulate mobile journey switching while network responses arrive out of order.
const stopStart=html.indexOf('async function loadStops(trip,token){');
const stopEnd=html.indexOf('\nfunction showCurrent()',stopStart);
assert.ok(stopStart>=0&&stopEnd>stopStart,'Isolated stop loading function not found');
const stopElement={innerHTML:'',disabled:true};
const requests=new Map();
const stopCtx={
  loadToken:1,
  document:{querySelector:()=>stopElement},
  getTripStops:(id)=>new Promise(resolve=>requests.set(id,resolve)),
  esc:s=>String(s).replace(/&/g,'&amp;'),
  console
};
vm.runInNewContext(html.slice(stopStart,stopEnd)+'\nglobalThis.checkStops=loadStops;',stopCtx);
const first=stopCtx.checkStops({id:'old-root',active_viaggio_id:'old-trip',luogo_partenza:'San Severo'},1);
stopCtx.loadToken=2;
const second=stopCtx.checkStops({id:'latest-root',active_viaggio_id:'latest-trip',luogo_partenza:'Apricena'},2);
requests.get('latest-trip')([{nome:'Apricena'}]);
await second;
assert.ok(stopElement.innerHTML.includes('Apricena'),'Latest trip stops not applied');
requests.get('old-trip')([{nome:'San Severo'}]);
await first;
assert.ok(!stopElement.innerHTML.includes('San Severo'),'Stale trip overwrote stop options');
assert.equal(stopElement.disabled,false,'Current trip stop should remain selectable');
console.log('Out-of-order mobile trip switch test passed');


// Seat selection must be capped by server-reported remaining passengers,
// including legacy bookings whose seat numbers are outside the visual map.
assert.ok(html.includes('Math.min(mapFree,inventory.free)'), 'Remaining seats must be capped by server inventory');
assert.ok(html.includes('maxBookableSeats=free;'), 'Seat-selection maximum missing');
const seatStart=html.indexOf('function seatButton(cell,occ){');
const seatEnd=html.indexOf('\nfunction voidCell(',seatStart);
assert.ok(seatStart>0&&seatEnd>seatStart, 'Seat handler not found');
const buttons=[];
const mkElement=(tag)=>{
  const element={
    tag,style:{},dataset:{},disabled:false,
    classList:{add(){},remove(){}},
    setAttribute(){},
    appendChild(){},
    innerHTML:'',title:'',onclick:null
  };
  if(tag==='button')buttons.push(element);
  return element;
};
const seatCtx={
  selected:[], maxBookableSeats:1,
  current:{posti_totali:53}, SVG:{seat:'<svg/>'},
  document:{createElement:mkElement,querySelector:()=>null},
  details:{appendChild(){}},
  esc:s=>s, updateSummary(){},
  Number, String, Set
};
vm.runInNewContext(html.slice(seatStart,seatEnd)+'\nglobalThis.createSeat=seatButton;',seatCtx);
const outside=seatCtx.createSeat({id:59,label:'59'},new Set());
assert.equal(outside.disabled,true,'Out-of-capacity seat must be disabled');
const firstSeat=seatCtx.createSeat({id:1,label:'01'},new Set());
const secondSeat=seatCtx.createSeat({id:2,label:'02'},new Set());
firstSeat.onclick();
assert.equal(seatCtx.selected.length,1,'First seat should be selected');
secondSeat.onclick();
assert.equal(seatCtx.selected.length,1,'Must reject more seats than remaining capacity');
firstSeat.onclick();
assert.equal(seatCtx.selected.length,0,'Deselecting must release capacity');
secondSeat.onclick();
assert.equal(seatCtx.selected.length,1,'A different seat can be selected after deselecting');
console.log('Capacity-limited seat selection test passed');


const archiveStart=html.indexOf('async function archiveConfirmation(){');
const archiveEnd=html.indexOf('\nmsg.innerHTML=',archiveStart);
assert.ok(archiveStart>0&&archiveEnd>archiveStart,'PDF archive function missing');
const archiveSource=html.slice(archiveStart,archiveEnd);
async function runArchive(mock){
 const calls=[];
 const context={
  result:{id:'00000000-0000-4000-8000-000000000001',token:'synthetic-private-token'},
  confirmationPdf:Promise.resolve(new Blob([Uint8Array.from([37,80,68,70,45,49,46,52,10])],{type:'application/pdf'})),
  Uint8Array,btoa,console,
  gestBridge:async(action,payload)=>{calls.push({action,payload});return mock(action,payload)}
 };
 vm.runInNewContext(archiveSource+'\nglobalThis.archiveTest=archiveConfirmation;',context);
 return {result:await context.archiveTest(),calls};
}
const issued=await runArchive(async(action,payload)=>{
 assert.equal(action,'archive-booking');
 assert.equal(payload.token,'synthetic-private-token');
 assert.ok(payload.pdfBase64);
 return {success:true,emailSent:true};
});
assert.equal(issued.result.emailSent,true);
assert.equal(issued.calls.length,1);
const recovered=await runArchive(async(action)=>{
 if(action==='archive-booking')throw Error('Network timeout after upload');
 if(action==='booking-pdf-url')return {success:true,signedUrl:'https://example.invalid/fictional.pdf'};
 throw Error('Unexpected action');
});
assert.equal(recovered.result.alreadyArchived,true,'Must recover existing document after uncertain network error');
assert.equal(recovered.calls.length,2);
console.log('Public PDF archive and retry integration smoke test passed');

console.log('Booking page scripts parsed: '+count);
console.log('Booking integration smoke tests passed');
