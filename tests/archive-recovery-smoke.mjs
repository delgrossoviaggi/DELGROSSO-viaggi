import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../supabase/functions/send-booking-confirmation/index.ts',import.meta.url),'utf8');
const start=source.indexOf('function validPdf(bytes:Uint8Array){');
const end=source.indexOf('\nfunction tokenOK(',start);
assert.ok(start>=0&&end>start,'PDF validation and identity helpers are required');
const functions=source.slice(start,end)
 .replaceAll('bytes:Uint8Array','bytes')
 .replaceAll('number:string','number');
const context={TextDecoder,Uint8Array};
vm.runInNewContext(functions+'\nglobalThis.checkDocument=pdfMatchesBooking;',context,{timeout:3000});
const makePdf=(number,bytes=1800,end=true)=>{
 const b=Buffer.alloc(bytes,32);
 b.write('%PDF-1.4\n',0,'latin1');
 b.write('BT /F1 12 Tf ('+number+') Tj ET\n',60,'latin1');
 if(end)b.write('\n%%EOF\n',bytes-7,'latin1');
 return new Uint8Array(b);
};
assert.equal(context.checkDocument(makePdf('DG-P-TEST0001'),'DG-P-TEST0001'),true,'Correct booking PDF must pass');
assert.equal(context.checkDocument(makePdf('DG-P-TEST0001'),'DG-P-OTHER'),false,'Wrong booking PDF must fail');
assert.equal(context.checkDocument(makePdf('DG-P-TEST0001',1800,false),'DG-P-TEST0001'),false,'Truncated PDF must fail');
assert.equal(context.checkDocument(makePdf('DG-P-TEST0001',200),'DG-P-TEST0001'),false,'Tiny PDF must fail');

const issueStart=source.indexOf('const pdf=pdfBytes(T(p.pdfBase64))');
const issueEnd=source.indexOf('\n    const now=new Date()',issueStart);
assert.ok(issueStart>0&&issueEnd>issueStart,'PDF issue/recovery section not found');
const recovery=source.slice(issueStart,issueEnd);
assert.ok(recovery.includes('upsert:false'),'The service must not overwrite a PDF');
assert.ok(recovery.includes('if(!pdfMatchesBooking(prior,number))'),'Existing files must belong to the same booking');
assert.ok(recovery.includes('.is("confirmation_storage_path",null)'),'Recovery must not overwrite unrelated booking metadata');
assert.ok(recovery.includes('if(!duplicate)throw up.error;'),'Only duplicate storage conflicts are recoverable');
assert.ok(recovery.includes('alreadyArchived:true,recovered:true'),'Recovery should be distinguishable to the frontend');
assert.ok(!recovery.includes('sendMail('),'Recovery must never send a duplicate email');
assert.ok(source.includes('tokenOK(b,p)'),'Booking token must remain mandatory');
console.log('Booking PDF identity and safe orphan-recovery regression tests passed');
