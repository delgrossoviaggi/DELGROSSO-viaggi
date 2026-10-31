import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('prenota.html');
const bridge=read('js/gestionale.js');
const server=read('supabase/functions/send-booking-confirmation/index.ts');

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
assert.ok(html.includes('action:\'issue\''), 'PDF issue action missing');
assert.ok(html.includes('await archiveConfirmation()'), 'PDF archival not called');
assert.ok(html.includes('<a id="downloadReceipt"'), 'Native customer PDF link missing');
assert.ok(bridge.includes('stableRequestId'), 'Idempotent booking request identifier missing');

assert.ok(server.includes('Reinvio riservato agli operatori'), 'Protected email resend missing');
assert.ok(server.includes('pdf.length>5000000'), 'PDF upload validation missing');
assert.ok(server.includes('confirmation_email_error:emailError'), 'SMTP failure tracking missing');


assert.ok(html.includes('Promise.all([loadStops(trip,token),getBookedSeats(trip.id),getBusLayout(trip.id)])'),
  'Stops, seat availability and layout should load concurrently');
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
const first=stopCtx.checkStops({id:'old-trip',luogo_partenza:'San Severo'},1);
stopCtx.loadToken=2;
const second=stopCtx.checkStops({id:'latest-trip',luogo_partenza:'Apricena'},2);
requests.get('latest-trip')([{nome:'Apricena'}]);
await second;
assert.ok(stopElement.innerHTML.includes('Apricena'),'Latest trip stops not applied');
requests.get('old-trip')([{nome:'San Severo'}]);
await first;
assert.ok(!stopElement.innerHTML.includes('San Severo'),'Stale trip overwrote stop options');
assert.equal(stopElement.disabled,false,'Current trip stop should remain selectable');
console.log('Out-of-order mobile trip switch test passed');

console.log('Booking page scripts parsed: '+count);
console.log('Booking integration smoke tests passed');
