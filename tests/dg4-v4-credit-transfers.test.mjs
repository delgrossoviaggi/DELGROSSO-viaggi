import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const raw=readFileSync(new URL('../GESTIONALE/v4/credit-transfers.js',import.meta.url),'utf8').replace(/^export /gm,'');
const c=vm.runInNewContext(raw+';({identityKey,existingCashNet,bookingCreditBalance,destinationsForCredit,reviewCreditTransfer})',{});
const trips=[
 {id:'T1',data_partenza:'2026-11-29',titolo:'Napoli',stato:'Non formato'},
 {id:'T2',data_partenza:'2026-12-20',titolo:'Alberobello e Locorotondo',stato:'Programmato'},
 {id:'T3',data_partenza:'2026-11-15',titolo:'Napoli vecchio',stato:'Programmato'},
 {id:'T4',data_partenza:'2026-12-20',titolo:'Viaggio annullato',stato:'Annullato'}
];
const source={id:'A',cliente:'Maria  Rossi',telefono:'+39 333 123 4567',viaggio_id:'T1',posti:2,totale:40,pagato:40,stato:'Acconto Ricevuto',updated_at:'2026-11-17T10:00:00Z'};
const target={id:'B',cliente:'Maria Rossi',telefono:'3331234567',viaggio_id:'T2',posti:2,totale:56,pagato:0,stato:'Prenotata',updated_at:'2026-11-17T10:00:00Z'};
const pay=[{id:'P1',prenotazione_id:'A',importo:40,tipo:'Acconto',stato:'Registrato'}];
const base={source,target,trips,bookings:[source,target],payments:pay,transfers:[],amount:'40',reason:'Viaggio non formato, cliente chiede giroconto',today:'2026-11-17'};
test('Example: 40 EUR from a failed trip applied to a 56 EUR booking leaves 16 EUR due and never creates a payment',()=>{
 const p=c.reviewCreditTransfer(base);
 assert.equal(p.availableCents,4000);
 assert.equal(p.newTargetDueCents,1600);
 assert.equal(p.afterTargetCents,4000);
 assert.equal(p.afterSourceCents,0);
 assert.equal(p.transferCents,4000);
});
test('Only fully matching surname + given name and phone can be selected across two different journeys',()=>{
 assert.equal(c.identityKey(source),c.identityKey(target));
 const others=[{...target,id:'C',telefono:'3330000000'},{...target,id:'D',cliente:'Luisa Rossi'},{...target,id:'E',viaggio_id:'T3'},
   {...target,id:'F',viaggio_id:'T4'},{...target,id:'G',viaggio_id:'T1'}];
 const choices=c.destinationsForCredit(source,[source,target,...others],trips,'2026-11-17');
 assert.deepEqual(choices.map(x=>x.id).join(','),'B');
});
test('Source must have a genuine payment ledger, not merely a stored summary balance',()=>{
 assert.throws(()=>c.reviewCreditTransfer({...base,payments:[]}),/non riconciliate/);
 assert.throws(()=>c.reviewCreditTransfer({...base,payments:[{...pay[0],importo:20}]}),/non riconciliate/);
});
test('Duplicate or overstated credits and overpayments cannot pass preflight',()=>{
 assert.throws(()=>c.reviewCreditTransfer({...base,amount:'40.01'}),/supera il credito/);
 assert.throws(()=>c.reviewCreditTransfer({...base,target:{...target,totale:20},amount:'40'}),/supera il saldo/);
 assert.throws(()=>c.reviewCreditTransfer({...base,amount:'0'}),/positiva/);
});
test('Previous partial giroconti reduce available credit and destination due using append-only ledger',()=>{
 const prior=[{id:'G1',source_booking_id:'A',target_booking_id:'B',importo:10,stato:'Confermato'}];
 const p=c.reviewCreditTransfer({...base,transfers:prior,amount:20});
 assert.equal(p.sourcePaidCents,3000);
 assert.equal(p.targetPaidCents,1000);
 assert.equal(p.newTargetDueCents,2600);
 assert.throws(()=>c.reviewCreditTransfer({...base,transfers:prior,amount:35}),/supera il credito/);
});
test('Cancelled source booking remains eligible, active source without failed trip requires explicit cancellation',()=>{
 const confirmed=[{...trips[0],stato:'Programmato'},...trips.slice(1)];
 assert.throws(()=>c.reviewCreditTransfer({...base,trips:confirmed}),/non formato\/annullato/);
 const preview=c.reviewCreditTransfer({...base,trips:confirmed,allowIncomplete:true});
 assert.equal(preview.requiresCancellation,true);
 const cancellation=c.reviewCreditTransfer({...base,trips:confirmed,source:{...source,stato:'Annullata'}});
 assert.equal(cancellation.requiresCancellation,false);
});
test('Paid source still needs an actual valid destination booking; cannot invent one to move the money',()=>{
 assert.throws(()=>c.reviewCreditTransfer({...base,target:{...target,stato:'Annullata'}}),/altra prenotazione attiva/);
 assert.throws(()=>c.reviewCreditTransfer({...base,target:{...target,telefono:'3339999999'}}),/devono corrispondere/);
});
test('Refunds subtract from original cash paid, without fabricating an additional receipt',()=>{
 const src={...source,pagato:30};
 const paid=[...pay,{id:'P2',prenotazione_id:'A',importo:-10,tipo:'Rimborso',stato:'Registrato'}];
 const balance=c.bookingCreditBalance(src,paid,[]);
 assert.equal(balance.net,3000);
 assert.equal(balance.remaining,1000);
 const p=c.reviewCreditTransfer({...base,source:src,payments:paid,amount:30});
 assert.equal(p.availableCents,3000);
});
