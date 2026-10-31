import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../supabase/functions/send-booking-confirmation/index.ts',import.meta.url),'utf8');
const start=src.indexOf('function validPdf(bytes:Uint8Array){');
const end=src.indexOf('\nfunction tokenOK(',start);
assert.ok(start>=0&&end>start,'PDF validation missing');
const context={Uint8Array,TextDecoder};
vm.runInNewContext(src.slice(start,end).replace('bytes:Uint8Array','bytes')+'\nglobalThis.validate=validPdf;',context);
const valid=context.validate;
const pdf=(header,tail,size=1400)=>{
 const b=new Uint8Array(size);
 b.fill(32);
 b.set(new TextEncoder().encode(header),0);
 b.set(new TextEncoder().encode(tail),size-tail.length);
 return b;
};
assert.equal(valid(pdf('%PDF-1.4\n','\n%%EOF\n')),true,'Normal completed PDF should pass');
assert.equal(valid(pdf('%PDF-1.4\n','no-end-marker')),false,'Missing EOF must fail');
assert.equal(valid(pdf('garbage','\n%%EOF\n')),false,'Invalid header must fail');
assert.equal(valid(pdf('%PDF-1.4\n','\n%%EOF\n',400)),false,'Too-small PDF must fail');
assert.ok(src.includes('if(!validPdf(verifiedPdf))'), 'Mail sending must reject corrupted archived PDFs');
assert.ok(src.includes('if(!validPdf(pdf))'), 'Archival must reject corrupted incoming PDFs');
assert.ok(src.includes('tokenOK(b,p)'), 'Booking token authorization must remain');
assert.ok(src.includes('Reinvio riservato agli operatori'), 'Email resend must remain operator-only');
console.log('Booking PDF integrity checks passed');
