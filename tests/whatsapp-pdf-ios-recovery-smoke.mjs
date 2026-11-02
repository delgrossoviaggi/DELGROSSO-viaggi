import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../GESTIONALE/dg67-whatsapp-pdf.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'dg67-whatsapp-pdf.js'});
const base='https://example-project.supabase.co';
const path='/storage/v1/object/sign/ricevute-prenotazioni/professionali/viaggi/2026/documento.pdf';
const signed=base+path+'?token=test-token';
const elements={
 modal:{classList:{contains:()=>true}},
 dg64BookingText:{value:'Messaggio di conferma'},
 dg67State:{textContent:''},
 modalBody:{appendChild(el){elements[el.id]=el}},
 modalFoot:{prepend(...children){for(const el of children)elements[el.id||el.textContent]=el}}
};
const clicked=[];
const document={
 readyState:'complete',
 getElementById:id=>elements[id]||null,
 createElement:tag=>({
  tag,style:{},disabled:false,
  addEventListener(type,fn){this[type]=fn},
  click(){clicked.push(this.href)},
  remove(){},
  set innerHTML(value){this.html=value}
 }),
 body:{appendChild(){}},
 addEventListener(){}
};
let calls=0;
const fetch=async url=>{
 calls++;
 if(String(url).includes('/functions/v1/dg67-booking-pdf')){
  return {ok:true,status:200,json:async()=>({success:true,signedUrl:signed,filename:'DELGROSSO_Prenotazione.pdf'})};
 }
 if(String(url)===signed)throw new TypeError('Load failed');
 throw new Error('Unexpected URL');
};
const window={
 dg64OpenBooking(){},
 dg64OpenReceipt(){},
 toast(){}
};
const bookingId='00000000-0000-4000-8000-000000000001';
const context={
 URL,SUPA_URL:base,accessHeaders:()=>({'Content-Type':'application/json'}),
 state:{prenotazioni:[{id:bookingId,cliente:'Cliente test',telefono:'3208888888'}],pagamenti:[]},
 window,document,fetch,console,encodeURIComponent,Uint8Array,File:class {},navigator:{},setTimeout:()=>{}
};
vm.runInNewContext(source,context);
window.dg64OpenBooking(bookingId);
for(let i=0;i<24;i++)await Promise.resolve();
assert.equal(calls,2,'Should get signed URL then try fetching the PDF');
assert.equal(elements.dg67Download.disabled,true,'No download when PDF was not validated');
assert.equal(elements.dg67Share.disabled,true,'Do not share a failed PDF');
assert.equal(elements.dg67OpenStored.disabled,false,'Existing stored PDF should remain directly accessible');
assert.match(elements.dg67State.textContent,/Apri PDF originale/,'User must see the recovery action');
elements.dg67OpenStored.click();
assert.deepEqual(clicked,[signed],'Fallback should open the original signed PDF directly');
assert.ok(!source.includes('Rigenera PDF'), 'Retry must not be presented as reissuing a receipt');
const first=source.indexOf('function trustedSignedUrl(raw){');
const end=source.indexOf('\nfunction openStoredPdf(){',first);
assert.ok(first>=0&&end>first,'Secure signed URL validator missing');
const secure=vm.runInNewContext(source.slice(first,end)+'\ntrustedSignedUrl',{URL,SUPA_URL:base});
assert.equal(secure(signed),signed);
for(const candidate of [
 'https://example-project.supabase.co.evil.tld'+path+'?token=x',
 'https://example-project.supabase.co/storage/v1/object/public/ricevute-prenotazioni/a.pdf?token=x',
 base+path,
 'http://example-project.supabase.co'+path+'?token=x',
 'https://evil.test/doc.pdf?token=x'
]) assert.equal(secure(candidate),'','Must not open an untrusted or unsigned URL');
console.log('iPhone stored PDF recovery: safe link, no unvalidated attachment, no document reissue');
