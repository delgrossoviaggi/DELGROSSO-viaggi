import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../GESTIONALE/dg67-whatsapp-pdf.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'dg67-whatsapp-pdf.js'});
const base='https://example-project.supabase.co';
const paymentId='00000000-0000-4000-8000-000000000009';
const bookingId='00000000-0000-4000-8000-000000000001';
const receiptPath='professionali/viaggi/2026/DG-RCP-2026-000027-V3.pdf';
const signedPath='/object/sign/ricevute-prenotazioni/'+receiptPath+'?token=safe-token';
const absoluteSigned=base+'/storage/v1'+signedPath;
const elements={
 modal:{classList:{contains:()=>true}},
 dg64ReceiptText:{value:'Ricevuta del pagamento'},
 dg67State:{textContent:''},
 modalBody:{appendChild(el){elements[el.id]=el}},
 modalFoot:{prepend(...children){for(const el of children)elements[el.id||el.textContent]=el}}
};
const opened=[];
const document={
 readyState:'complete',
 getElementById:id=>elements[id]||null,
 createElement:tag=>({
  tag,style:{},disabled:false,
  addEventListener(type,fn){this[type]=fn},
  click(){opened.push(this.href)},remove(){},
  set innerHTML(value){this.html=value}
 }),
 body:{appendChild(){}},addEventListener(){}
};
const calls=[];
const fetch=async (url,options={})=>{
 calls.push({url:String(url),options});
 if(String(url).includes('/storage/v1/object/sign/')){
  assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,'Bearer synthetic-test-token');
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(options.body),{expiresIn:600});
  return {ok:true,status:200,json:async()=>({signedURL:signedPath})};
 }
 if(String(url)===absoluteSigned)throw new TypeError('Load failed');
 throw Error('Unexpected fetch '+url);
};
const api=async(table,query)=>{
 assert.equal(table,'pagamenti');
 assert.ok(query.includes(paymentId));
 return [{id:paymentId,receipt_professional_path:receiptPath,receipt_storage_path:null,receipt_number:'DG-RCP-2026-000027'}];
};
const window={dg64OpenBooking(){},dg64OpenReceipt(){},toast(){}};
const context={
 URL,SUPA_URL:base,
 accessHeaders:()=>({Authorization:'Bearer synthetic-test-token',apikey:'synthetic-publishable-key'}),
 state:{
  prenotazioni:[{id:bookingId,cliente:'Cliente Test',telefono:'3208888888'}],
  pagamenti:[{id:paymentId,prenotazione_id:bookingId,receipt_professional_path:receiptPath}]
 },
 api,window,document,fetch,console,Uint8Array,encodeURIComponent,File:class {},navigator:{},setTimeout(){}
};
vm.runInNewContext(source,context);
window.dg64OpenReceipt(paymentId);
for(let i=0;i<40;i++)await Promise.resolve();
assert.equal(calls.length,2,'One Storage sign request and one attempted file fetch only');
assert.ok(calls[0].url.endsWith('/storage/v1/object/sign/ricevute-prenotazioni/'+receiptPath),'Must ask Storage to sign an existing object');
assert.ok(!calls.some(x=>x.url.includes('/functions/v1/')),'Already archived receipt must never require Edge Functions');
assert.equal(elements.dg67OpenStored.disabled,false,'Original stored PDF fallback must be enabled after signed link');
assert.equal(elements.dg67Share.disabled,true,'Never share an unverified PDF file');
assert.match(elements.dg67State.textContent,/Apri PDF originale/);
elements.dg67OpenStored.click();
assert.deepEqual(opened,[absoluteSigned]);
assert.ok(!source.includes("endpoint='professional-receipts'"),'Existing receipts must never be reissued');
assert.ok(source.includes('Ricevuta non archiviata'),'Missing receipt must show an error, not create a new version');
console.log('Private Storage signed receipt read and iOS fallback passed');
