import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../GESTIONALE/index.html',import.meta.url),'utf8');
const pdf=readFileSync(new URL('../GESTIONALE/dg66-email-verifica.js',import.meta.url),'utf8');

assert.ok(html.length>100000,'Main UI was unexpectedly truncated');
const start=html.indexOf('  const specs=[',html.indexOf('async function loadAll('));
const end=html.indexOf('  const dg59ReuseFleet=',start);
assert.ok(start>0&&end>start,'Main synchronization config cannot be isolated');
const syncSource=html.slice(start,end)+'\nglobalThis.audit={specs,dgDataAliases,dgActiveSpecs};';
new vm.Script(syncSource);
const run=(page,background)=>vm.runInNewContext(syncSource,{state:{page},background,Set}).audit;
const full=run('dashboard',false),dashboard=run('dashboard',true),whatsapp=run('whatsapp',true),fleet=run('flotta',true),finance=run('pagamenti',true);
assert.ok(full.specs.length>=35,'Full refresh must still cover the core system');
assert.equal(full.dgActiveSpecs.length,full.specs.length,'Manual full refresh must retain ALL tables');
assert.ok(dashboard.dgActiveSpecs.length<=15,'Dashboard background sync must not refetch 40+ tables');
assert.ok(whatsapp.dgActiveSpecs.some(x=>x[0]==='dg_whatsapp_trip_invites_v61'),'WhatsApp must refresh group links');
assert.ok(whatsapp.dgActiveSpecs.some(x=>x[0]==='dg_whatsapp_optins_v61'),'WhatsApp must refresh opt-outs');
assert.ok(fleet.dgActiveSpecs.some(x=>x[0]==='flotta'),'Fleet page must receive fresh bus photo data');
assert.ok(finance.dgActiveSpecs.some(x=>x[0]==='pagamenti'),'Payments page must refresh bookkeeping');
for(const [name] of full.specs)assert.ok(full.dgDataAliases[name],`Missing memory-state alias: ${name}`);
assert.ok(html.includes('data[name]=state[dgDataAliases[name]||name]||[]'),'Background sync must preserve untouched state');
assert.ok(html.includes('let dgLastRefreshAt=0'),'Visibility sync must debounce refresh');
assert.ok(html.includes('},90000);if(!window.__dgVisibilitySync)'),'Background refresh must run at slower interval');
assert.ok(html.includes('dgLastAutoMobile<180000'),'Idle mobile refresh must be throttled');

new vm.Script(pdf);
const a=pdf.indexOf('function fill(){'),b=pdf.indexOf('\nwindow.dg66RefreshEmail=',a);
assert.ok(a>0&&b>a,'PDF filter not found');
const fixture={
 dg66Kind:{value:'booking'}, dg66Target:{value:'',innerHTML:''},
 dg66MissingOnly:{checked:true}, dg66MissingCount:{textContent:''},
 dg66MissingOnlyWrap:{style:{}}
};
const bookings=[
 {id:'missing',cliente:'Test Uno',confirmation_storage_path:null,created_at:'2026-11-03'},
 {id:'stored',cliente:'Test Due',confirmation_storage_path:'conferme/example.pdf',created_at:'2026-11-02'}
];
const scope={$:id=>fixture[id],bookList:()=>bookings,payList:()=>[{id:'receipt',prenotazione_id:'stored',tipo:'Acconto'}],findBooking:()=>bookings[1],esc:String};
vm.runInNewContext(pdf.slice(a,b)+'\nglobalThis.fillFilter=fill;',scope);
scope.fillFilter();
assert.ok(fixture.dg66Target.innerHTML.includes('missing'),'Must list missing confirmation');
assert.ok(!fixture.dg66Target.innerHTML.includes('stored'),'Missing-PDF view should omit archived confirmation');
assert.match(fixture.dg66MissingCount.textContent,/1 da verificare/);
fixture.dg66MissingOnly.checked=false;
scope.fillFilter();
assert.ok(fixture.dg66Target.innerHTML.includes('stored'),'Unfiltered list must include archived confirmation');
fixture.dg66Kind.value='payment';
scope.fillFilter();
assert.ok(fixture.dg66Target.innerHTML.includes('receipt'),'Payment receipt list must remain available');
assert.equal(fixture.dg66MissingOnlyWrap.style.display,'none','Missing confirmation filter must be hidden for payments');
assert.ok(pdf.includes('row.receipt_professional_path||row.receipt_storage_path'),'Professional receipt path must be recognized');
assert.ok(pdf.includes('/storage/v1/object/sign/ricevute-prenotazioni/'),'PDF verification must use operator-only private Storage');
assert.ok(!pdf.includes("const endpoint=kind==='booking'?'send-booking-confirmation':'send-payment-receipt';"),'Open-document click must not rely on the failing Edge function');
console.log('DELGROSSO V74: full/manual sync, page-specific background, stable state, PDF filter and private file open PASSED');
