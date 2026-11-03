import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('GESTIONALE/dg78-archivio-storico.js');
const desk=read('GESTIONALE/dg75-integrita.js');
const html=read('GESTIONALE/index.html');
const sw=read('GESTIONALE/sw.js');

new vm.Script(src,{filename:'dg78-archivio-storico.js'});
assert.ok(html.includes('dg78-archivio-storico.js?v=78'),'V78 module must be loaded');
assert.ok(desk.includes('window.dg78RenderArchive?.()'),'Booking updates must retain the V78 archive widget');
assert.ok(sw.includes('delgrosso-gestionale-v78-archive-reconciliation'),'Mobile cached scripts must be invalidated');
assert.ok(!src.includes('/rest/v1/'),'Archive review must not write bookings through the Data API');
assert.ok(!src.includes("method:'DELETE'")&&!src.includes("method:'PUT'"),'Archive review must not mutate or delete original PDFs');

let panelInner='',createdBox=null,network=[],opened=[],tabCreated=0;
const panel={appendChild(el){createdBox=el;}};
const document={
 readyState:'loading',
 getElementById:id=>id==='dg75IntegrityPanel'?panel:id==='dg78Historical'?createdBox:null,
 createElement:tag=>({id:'',style:{},addEventListener(){},set innerHTML(v){panelInner=v},get innerHTML(){return panelInner}}),
 addEventListener(){}
};
const state={prenotazioni:[
 {id:'1',confirmation_number:'B100',confirmation_storage_path:'conferme/B100.pdf'},
 {id:'2',confirmation_number:'B200',confirmation_storage_path:null}
]};
const signed='https://demo.supabase.co/storage/v1/object/sign/ricevute-prenotazioni/conferme/OLD999.pdf?token=only-temporary';
const files=[
 {name:'B100.pdf',created_at:'2026-11-01'},
 {name:'B200.pdf',created_at:'2026-11-01'},
 {name:'OLD999.pdf',created_at:'2026-11-01'}
];
const fetch=async(url,options)=>{
 network.push({url:String(url),method:options.method,body:options.body});
 assert.equal(options.method,'POST');
 assert.equal(options.headers.Authorization,'Bearer fixture-operator');
 if(String(url).includes('/object/list/')){
  const params=JSON.parse(options.body);
  assert.equal(params.prefix,'conferme');
  assert.equal(params.limit,100);
  assert.equal(params.offset,0);
  return {ok:true,status:200,json:async()=>files};
 }
 if(String(url).includes('/object/sign/')){
  assert.deepEqual(JSON.parse(options.body),{expiresIn:300});
  assert.ok(String(url).includes('/conferme/OLD999.pdf'));
  return {ok:true,status:200,json:async()=>({signedURL:'/object/sign/ricevute-prenotazioni/conferme/OLD999.pdf?token=only-temporary'})};
 }
 throw Error('Unexpected URL: '+url);
};
const window={
 open(){tabCreated++;return {document:{title:'',body:{textContent:''}},location:{replace:url=>opened.push(url)},close(){}};},
 openBookingModal(){}
};
const context={URL,window,document,state,SUPA_URL:'https://demo.supabase.co',accessHeaders:()=>({Authorization:'Bearer fixture-operator'}),fetch,console,Map,Number,Set,Date};
vm.runInNewContext(src,context);
assert.equal(network.length,0,'Archive must never make requests during page load');
assert.equal(typeof window.dg78LoadArchive,'function');
assert.equal(typeof window.dg78TrustedSignedUrl,'function');
assert.equal(window.dg78TrustedSignedUrl('https://evil.supabase.co/storage/v1/object/sign/ricevute-prenotazioni/conferme/a.pdf?token=x'),'','Reject other domains');
assert.equal(window.dg78TrustedSignedUrl('https://demo.supabase.co/storage/v1/object/public/ricevute-prenotazioni/conferme/a.pdf?token=x'),'','Reject public links');
assert.equal(window.dg78TrustedSignedUrl('https://demo.supabase.co/storage/v1/object/sign/ricevute-prenotazioni/conferme/a.pdf'),'','Require a temporary token');
assert.equal(window.dg78TrustedSignedUrl(signed),signed);

const mapped=window.dg78ClassifyArchive(files,state.prenotazioni);
assert.equal(mapped.length,3);
assert.deepEqual(Array.from(mapped,x=>x.mode),['linked','review','unlinked'],'Only exact references can reconcile historical PDFs');
assert.equal(mapped[1].bookingId,'2');
assert.equal(window.dg78ClassifyArchive([{name:'../bad.pdf'}],[]).length,0,'Reject traversal paths');

await window.dg78LoadArchive();
assert.equal(network.length,1,'Only a requested archive inventory should be fetched');
assert.ok(panelInner.includes('3</b> PDF esaminati'),'Counts visible in the operator-only UI');
assert.ok(panelInner.includes('1</b> già collegati'));
assert.ok(panelInner.includes('1</b> senza corrispondenza esatta'));
assert.ok(panelInner.includes('OLD999.pdf'));
assert.ok(!panelInner.includes('data-dg78-open="0"'),'Already linked PDFs do not need an orphan-review button');

await window.dg78OpenArchive(0);
assert.equal(network.length,1,'Already linked document should not open in historical review');
await window.dg78OpenArchive(2);
assert.equal(tabCreated,1);
assert.equal(network.length,2,'Only explicit operator click may request signed URL');
assert.deepEqual(opened,[signed]);
assert.equal(network.filter(x=>x.method==='POST'&&!x.url.includes('/object/list/')&&!x.url.includes('/object/sign/')).length,0);
console.log('V78 private historical archive: on-demand access, exact matching, no mutations, safe signed PDF open PASS');
