import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync(new URL('../GESTIONALE/v4/booking-operations.js',import.meta.url),'utf8').replace(/^export /gm,'');
const logic=vm.runInNewContext(js+';({activeBooking,busRoot,normalizeDestination,eligibleBusTargets,eligibleDateTargets,seatNumbers,seatInventory,reviewBusTransfer})',{});
const main={id:'M',data_partenza:'2026-11-22',destinazione:'Napoli',posti_totali:53,bis_numero:1,stato:'Aperto'};
const bis={...main,id:'B',bis_numero:2,bis_parent_id:'M',posti_totali:63};
const unrelated={...main,id:'U',destinazione:'Roma'};
const next={...main,id:'NEXT',data_partenza:'2026-12-06'};
const booking={id:'A',cliente:'Test',viaggio_id:'M',posti:2,posti_selezionati:'1, 2',pagato:20,totale:40,stato:'Acconto Ricevuto'};
const someone={id:'C',viaggio_id:'B',posti:2,posti_selezionati:'3, 4',stato:'In attesa acconto'};
test('Only buses linked to the same departure root and calendar date are available',()=>{
 const found=logic.eligibleBusTargets(main,[main,bis,unrelated,next]);
 assert.equal(found.length,2);
 assert.equal(found[1].id,'B');
});
test('Other-date destination choices are exact, active and future',()=>{
 const result=logic.eligibleDateTargets(main,[main,bis,unrelated,next,{...next,id:'P',archiviato_at:'2026-10-01'}],'2026-11-17');
 assert.deepEqual([...result].map(t=>t.id),['NEXT']);
});
test('Selected seats are normalized and deduplicated',()=>{
 assert.deepEqual([...logic.seatNumbers(' 3,  02; 4')],['2','3','4']);
 assert.throws(()=>logic.seatNumbers('1,1'),/due volte/);
 assert.throws(()=>logic.seatNumbers('1, abc'),/non validi/);
});
test('Cancelled booking seats are not treated as occupied',()=>{
 const inv=logic.seatInventory(bis,[someone,{...someone,id:'D',posti_selezionati:'5',stato:'Annullata'}],[]);
 assert.equal(inv.taken.size,2);
 assert.equal(inv.taken.has('5'),false);
 assert.deepEqual(inv.problems,[]);
});
test('Booking transfer from main bus to BIS preserves amounts and capacity',()=>{
 const r=logic.reviewBusTransfer({booking,origin:main,target:bis,bookings:[booking,someone],seatRows:[],chosen:'6, 7'});
 assert.equal(r.changedBus,true);
 assert.equal(r.paid,20);
 assert.equal(r.total,40);
 assert.deepEqual([...r.seats],['6','7']);
});
test('Transfer rejects seat conflicts on destination bus',()=>{
 assert.throws(()=>logic.reviewBusTransfer({booking,origin:main,target:bis,bookings:[booking,someone],seatRows:[],chosen:'3, 4'}),/occupati/);
});
test('Transfer refuses unlinked bus even if departure date is identical',()=>{
 assert.throws(()=>logic.reviewBusTransfer({booking,origin:main,target:unrelated,bookings:[booking],seatRows:[],chosen:'3,4'}),/non appartiene/);
});
test('Check-in and ambiguous seat registries prevent seat move',()=>{
 assert.throws(()=>logic.reviewBusTransfer({booking:{...booking,checkin_effettuato:true},origin:main,target:bis,bookings:[someone],seatRows:[],chosen:'5,6'}),/Check-in/);
 const odd={...someone,id:'E',posti:3,posti_selezionati:'8'};
 assert.throws(()=>logic.reviewBusTransfer({booking,origin:main,target:bis,bookings:[someone,odd],seatRows:[],chosen:'5,6'}),/riconciliare/);
});
test('Same-bus seat change only allows free seats and excludes its own current seats',()=>{
 const r=logic.reviewBusTransfer({booking,origin:main,target:main,bookings:[booking],seatRows:[{viaggio_id:'M',prenotazione_id:'A',posto:'1'}],chosen:'1, 3'});
 assert.equal(r.changedBus,false);
 assert.deepEqual([...r.seats],['1','3']);
});
