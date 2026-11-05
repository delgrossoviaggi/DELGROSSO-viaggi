import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const modelSource=read('GESTIONALE/dg80-contanti-modello.js');
const uiSource=read('GESTIONALE/dg80-contanti-viaggi.js');
const css=read('GESTIONALE/dg80-contanti.css');
const html=read('GESTIONALE/index.html');
const sw=read('GESTIONALE/sw.js');
new vm.Script(modelSource);
new vm.Script(uiSource);
assert.ok(html.includes('id="page-contantiviaggi"'),'The new page must exist');
assert.ok(html.includes('data-page="contantiviaggi"'),'Cash page must appear in sidebar');
assert.ok(html.includes("mobileGo('contantiviaggi')"),'Cash page must be reachable on mobile');
assert.ok(html.includes("if(p==='contantiviaggi')window.dg80RenderCashTrips?.();"),'Page router must render cash report');
assert.ok(html.includes('window.dg80ResetCashTrips?.()'),'Operator logout must wipe sensitive in-memory payment details');
assert.ok(html.includes('dg80-contanti-modello.js?v=80'));
assert.ok(html.includes('dg80-contanti-viaggi.js?v=80'));
assert.ok(html.includes('dg80-contanti.css?v=80'));
assert.ok(sw.includes('delgrosso-gestionale-v80-cash-by-trip'));
assert.match(css,/@media\(max-width:650px\)/,'Mobile responsive design should be present');
assert.ok(!uiSource.includes("method:'PATCH'")&&!uiSource.includes("method:'DELETE'"),
  'Cash reconciliation must not alter the payment ledger');

const context={window:{},Intl,Date,Map,Set,Number,String,Math,Object,Array};
vm.runInNewContext(modelSource,context);
const model=context.window.DG80CashModel;
const ops=[
 {user_id:'nic-id',username:'nicola',attivo:true},
 {user_id:'raf-id',username:'raffaele',attivo:true}
];
const tripA={id:'trip-a',titolo:'Napoli',data_partenza:'2026-12-06'};
const bisA={id:'trip-a-bis',titolo:'Napoli BIS',data_partenza:'2026-12-06',bis_numero:2,bis_parent_id:'trip-a'};
const tripB={id:'trip-b',titolo:'Larino',data_partenza:'2026-12-08'};
const bookings=[
 {id:'book-a',viaggio_id:'trip-a',cliente:'Cliente A',codice:'A1',stato:'Confermata'},
 {id:'book-b',viaggio_id:'trip-a-bis',cliente:'Cliente B',codice:'B2',stato:'Confermata'},
 {id:'book-c',viaggio_id:'trip-b',cliente:'Cliente C',codice:'C3',stato:'Annullata'}
];
const cash=(id,book,trip,amount,type,who)=>({
 id,prenotazione_id:book,viaggio_id:trip,importo:amount,tipo:type,stato:'Registrato',
 metodo:'Contanti',metodo_pagamento:'Contanti',incassato_da_user_id:who,created_at:'2026-11-05',
 receipt_number:id.toUpperCase()
});
const payments=[
 cash('p1','book-a','trip-a',30,'Acconto','nic-id'),
 cash('p2','book-a','trip-a',20,'Saldo','raf-id'),
 cash('p3','book-b','trip-a-bis',15,'Acconto','nic-id'),
 cash('p4','book-b','trip-a-bis',-5,'Rimborso','nic-id'),
 cash('p5','book-c','trip-b',10,'Acconto','raf-id'),
 {...cash('p6','book-c','trip-b',4,'Saldo','raf-id'),metodo:'POS',metodo_pagamento:'POS'},
 cash('p7',null,'missing-trip',7,'Acconto','nic-id'),
 cash('p8','book-a','trip-a',8,'Acconto',null),
 {...cash('p9','book-a','trip-a',99,'Acconto','raf-id'),metodo_pagamento:'POS'},
 cash('p1','book-a','trip-a',30,'Acconto','nic-id')
];
const transfers=[{id:'transfer-1',da_operatore_user_id:'nic-id',a_operatore_user_id:'raf-id',importo:10,stato:'Confermato',data_trasferimento:'2026-11-05'},
 {id:'pending',da_operatore_user_id:'raf-id',a_operatore_user_id:'nic-id',importo:999,stato:'Da approvare'}];
const fixture={trips:[tripA,bisA,tripB],bookings,payments,operators:ops,cashTransfers:transfers};
const data=model.build(fixture);
assert.equal(data.groups.length,2);
assert.equal(data.groups.find(x=>x.id==='trip-a').buses.length,2,'BUS and BUS BIS must count as one trip');
const napoli=data.groups.find(x=>x.id==='trip-a');
assert.equal(napoli.nicola,4000,'Nicola: 30 + 15 - 5');
assert.equal(napoli.raffaele,2000,'Raffaele: 20');
assert.equal(napoli.nonAttribuiti,800,'Unknown payee must not be guessed');
assert.equal(napoli.netto,6800);
assert.equal(data.groups.find(x=>x.id==='trip-b').raffaele,1000,'Cash from cancelled booking must remain traceable');
assert.equal(data.totals.nicola,4700);
assert.equal(data.totals.raffaele,3000);
assert.equal(data.totals.nonAttribuiti,800);
assert.equal(data.totals.netto,8500);
assert.equal(data.totals.refunds,500);
assert.equal(data.totals.received,9000);
assert.equal(data.transfers.nicola,-1000);
assert.equal(data.transfers.raffaele,1000);
assert.equal(data.inCaricoViaggi.nicola,3700);
assert.equal(data.inCaricoViaggi.raffaele,4000);
assert.equal(data.unresolved.length,1,'Unknown trip cash must remain visible but unassigned to a trip');
assert.equal(data.excludedMethods,1,'POS must not be treated as cash');
assert.ok(data.issues.some(s=>s.includes('contrastante')),'Contradictory methods must be flagged, not hidden');
assert.ok(data.issues.some(s=>s.includes('senza viaggio')),'Unlinked trip must appear in checks');
assert.equal(data.movements.length,7,'Repeated payment ID must not duplicate cash');
assert.equal(napoli.movements[0].cliente,'Cliente A');
assert.equal(data.movements.find(x=>x.booking==='C3').bookingStatus,'Prenotazione annullata');
assert.equal(fixture.payments.length,10,'No ledger mutation');
assert.equal(model.cents(20.01),2001,'Financial model must use integer cents');

const requested=[];
const io={
 window:context.window,
 document:{getElementById:()=>null},
 api:async (table,query,opts)=>{
  assert.equal(opts.noCache,true,'Never use stale financial data');
  assert.ok(query.includes('limit=1000&offset=0'),'Paginate large transaction lists');
  requested.push(table);
  return {
   viaggi:fixture.trips,prenotazioni:fixture.bookings,pagamenti:fixture.payments,
   operatori_gestionale:fixture.operators,cassa_trasferimenti:fixture.cashTransfers
  }[table]||[];
 },
 can:(area,mode)=>area==='cassa'&&mode==='read',
 authSession:{access_token:'mock-session'},
 Intl,Date,Map,Set,Number,String,Math,Object,Array,console,URL,Blob
};
vm.runInNewContext(uiSource,io);
await io.window.dg80RefreshCashTrips();
assert.deepEqual(requested.sort(),['cassa_trasferimenti','operatori_gestionale','pagamenti','prenotazioni','viaggi'].sort(),
 'Cash page must re-read source tables from Supabase');
assert.equal(typeof io.window.dg80ExportCashCSV,'function');
assert.equal(typeof io.window.dg80ResetCashTrips,'function');
io.window.dg80ResetCashTrips();
console.log('V80: cash by trip, individual payers, BUS/BIS, refunds, confirmed transfers, security and Supabase read-only refresh PASS');
