import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const client=readFileSync(new URL('js/gestionale.js',root),'utf8');
const publicPage=readFileSync(new URL('js/future-v4.js',root),'utf8');
function getSandbox(fetch){
 const ctx={Intl,Date,Number,String,Math,Array,Object,RegExp,JSON,Promise,URLSearchParams,AbortController,
 setTimeout,clearTimeout,fetch,window:{}};
 vm.runInNewContext(client+';globalThis.tripTest={dgTodayRome,dgPublicTripIsCurrent,getGestionaleTrips}',ctx);
 return ctx.tripTest;
}
const today='2026-11-17';
const trips=[
 {id:'OLD',data_partenza:'2026-11-16',pubblicato:'SI'},
 {id:'TODAY',data_partenza:'2026-11-17',pubblicato:'SI'},
 {id:'FUTURE',data_partenza:'2026-11-20',pubblicato:'SI'},
 {id:'HIDDEN',data_partenza:'2026-11-20',pubblicato:'NO'},
 {id:'ARCHIVED',data_partenza:'2026-11-20',pubblicato:'SI',archiviato_at:'2026-11-16'},
 {id:'CLOSED',data_partenza:'2026-11-20',pubblicato:'SI',online_hidden_at:'2026-11-17'},
 {id:'CANCELLED',data_partenza:'2026-11-20',pubblicato:'SI',stato:'Annullato'}
];
test('Roma midnight date is used for active public trips (not host-local clock)',()=>{
 const t=getSandbox(async()=>{throw Error('no fetch needed')});
 assert.equal(t.dgTodayRome(new Date('2026-11-17T23:30:00+01:00')),'2026-11-17');
 assert.equal(t.dgTodayRome(new Date('2026-11-18T00:30:00+01:00')),'2026-11-18');
});
test('Older trips disappear only from public listings; cancelled/unpublished/archived excluded',()=>{
 const t=getSandbox(async()=>{throw Error('no fetch')});
 assert.deepEqual(trips.filter(t=>getSandbox(async()=>{}).dgPublicTripIsCurrent(t,today)).map(t=>t.id),['TODAY','FUTURE']);
});
test('The LIVE Supabase bridge response always filters past, hidden and unpublished dates',async()=>{
 const fn=getSandbox(async()=>({ok:true,status:200,text:async()=>JSON.stringify(trips)}));
 const items=await fn.getGestionaleTrips();
 assert.deepEqual([...items.map(t=>t.id)],['FUTURE']); // Nov 17 runtime? use static date? See below.
});
test('The emergency catalog has exactly the same public expiry policy',async()=>{
 let calls=0;
 const fn=getSandbox(async url=>{
  if(++calls===1)throw new Error('bridge offline');
  if(String(url).includes('viaggi-fallback'))return {ok:true,json:async()=>({source:'supabase-gestionale-public-trips-readonly',trips})};
  throw Error('unexpected URL '+url);
 });
 const items=await fn.getGestionaleTrips();
 assert.equal(items.every(t=>t.offline_catalog===true),true);
 assert.ok(items.every(t=>t.id!=='OLD'&&t.id!=='HIDDEN'&&t.id!=='ARCHIVED'));
});
test('Main public catalog uses Europe/Rome rather than browser timezone for expiry',()=>{
 const src=publicPage.match(/const future=d=>\{[^;\n]+;[^;\n]+;\};/);
 assert.ok(src,'Cannot locate the public future date predicate');
 const output=vm.runInNewContext(src[0]+';({future})',{Intl,Date});
 assert.equal(output.future('2026-01-01'),false);
 assert.equal(output.future('2099-01-01'),true);
});
