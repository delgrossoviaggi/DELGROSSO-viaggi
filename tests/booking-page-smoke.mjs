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

console.log('Booking page scripts parsed: '+count);
console.log('Booking integration smoke tests passed');
