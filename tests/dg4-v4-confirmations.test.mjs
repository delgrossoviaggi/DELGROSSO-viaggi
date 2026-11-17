// Offline regressions: one consolidated booking confirmation, split by boarding stop.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../GESTIONALE/v4/confirmation-groups.js',import.meta.url),'utf8').replace(/^export /gm,'');
const {collectCombinedConfirmation,normalizeTelephone,normalizeFullName,fullIdentity}=vm.runInNewContext(
 code+';({collectCombinedConfirmation,normalizeTelephone,normalizeFullName,fullIdentity})',{});
const trips=[
 {id:'M',titolo:'NAPOLI E SPACCANAPOLI',destinazione:'Napoli',data_partenza:'2026-12-08',bis_numero:1},
 {id:'B',titolo:'NAPOLI E SPACCANAPOLI BIS',destinazione:'Napoli',data_partenza:'2026-12-08',bis_parent_id:'M',bis_numero:2},
 {id:'L',titolo:'NAPOLI E SPACCANAPOLI',destinazione:'Napoli',data_partenza:'2026-12-13',bis_numero:1},
 {id:'Z',titolo:'NAPOLI E SPACCANAPOLI',destinazione:'Napoli',data_partenza:'2026-12-08',bis_numero:1}
];
const books=[
 {id:'A',cliente:'Mario  Rossi',telefono:'+39 333 123 4567',viaggio_id:'M',posti:2,posti_selezionati:'1,2',totale:40,pagato:20,fermata_partenza:'San Severo',stato:'Acconto Ricevuto',codice:'DG-A'},
 {id:'B1',cliente:'MARIO ROSSI',telefono:'3331234567',viaggio_id:'M',posti:1,posti_selezionati:'4',totale:20,pagato:20,fermata_partenza:'Apricena',stato:'Saldo Ricevuto',codice:'DG-B1'},
 {id:'C',cliente:'Mario Rossi',telefono:'0039 3331234567',viaggio_id:'B',posti:3,posti_selezionati:'6,7,8',totale:60,pagato:0,fermata_partenza:'San Severo',stato:'In attesa acconto',codice:'DG-C'},
 {id:'X1',cliente:'Mario Rossi',telefono:'3339999999',viaggio_id:'M',posti:1,totale:20,pagato:0,fermata_partenza:'San Severo',stato:'Prenotato'},
 {id:'X2',cliente:'Mario Rossi',telefono:'3331234567',viaggio_id:'L',posti:1,totale:20,pagato:0,fermata_partenza:'San Severo',stato:'Prenotato'},
 {id:'X3',cliente:'Luigi Rossi',telefono:'3331234567',viaggio_id:'M',posti:1,totale:20,pagato:0,fermata_partenza:'San Severo',stato:'Prenotato'},
 {id:'X4',cliente:'Mario Rossi',telefono:'3331234567',viaggio_id:'Z',posti:1,totale:20,pagato:0,fermata_partenza:'San Severo',stato:'Prenotato'},
 {id:'X5',cliente:'Mario Rossi',telefono:'3331234567',viaggio_id:'M',posti:1,totale:20,pagato:0,fermata_partenza:'San Severo',stato:'Annullata'}
];
const payments=[
 {id:'P1',prenotazione_id:'A',importo:30,tipo:'Acconto',stato:'Registrato'},
 {id:'P2',prenotazione_id:'A',importo:-10,tipo:'Rimborso',stato:'Registrato'},
 {id:'P3',prenotazione_id:'B1',importo:20,tipo:'Saldo',stato:'Registrato'},
 {id:'P4',prenotazione_id:'X1',importo:20,tipo:'Saldo',stato:'Registrato'}
];
test('Name and surname must both be present; phones normalize +39 / 0039',()=>{
 assert.equal(normalizeFullName('  MARIO  RÓSSI  '),'mario rossi');
 assert.equal(normalizeTelephone('0039 333 1234567'),'3331234567');
 assert.equal(normalizeTelephone('+39 333 1234567'),'3331234567');
 assert.equal(normalizeTelephone('3331234567'),'3331234567');
 assert.equal(fullIdentity({cliente:'Mario',telefono:'3331234567'}),'');
 assert.equal(fullIdentity({cliente:'Mario Rossi',telefono:'123'}),'');
});
test('Same full name and phone + same logical date merges main/BIS without merging other people, dates or trips',()=>{
 const out=collectCombinedConfirmation(books[0],books,trips,payments);
 assert.deepEqual([...out.bookings],['A','B1','C']);
 assert.equal(out.bookingCount,3);
 assert.equal(out.passengers,6);
 assert.equal(out.sections.length,2);
 assert.equal(out.totalCents,12000);
 assert.equal(out.paidCents,4000);
 assert.equal(out.dueCents,8000);
 assert.equal(out.warnings.length,0);
});
test('Each boarding stop has independent headcount, seat lines and subtotal; bus BIS remains identifiable',()=>{
 const out=collectCombinedConfirmation(books[0],books,trips,payments);
 const severo=out.sections.find(s=>s.stop==='San Severo');
 const apricena=out.sections.find(s=>s.stop==='Apricena');
 assert.equal(severo.passengers,5);
 assert.equal(severo.totalCents,10000);
 assert.equal(severo.paidCents,2000);
 assert.equal(severo.bookings.length,2);
 assert.ok(severo.bookings.some(b=>b.bus==='BUS BIS 2'&&b.seats==='6,7,8'));
 assert.equal(apricena.totalCents,2000);
 assert.equal(apricena.paidCents,2000);
});
test('Duplicate payment IDs are never double-counted; refunds subtract from paid total',()=>{
 const out=collectCombinedConfirmation(books[0],books,trips,[...payments,payments[0]]);
 assert.equal(out.paidCents,4000);
 assert.equal(out.paymentCount,3);
});
test('Ledger differences are visible rather than falsely treating the confirmation as reconciled',()=>{
 const out=collectCombinedConfirmation(books[0],books,trips,payments.map(p=>p.id==='P1'?{...p,importo:25}:p));
 assert.equal(out.paidCents,3500);
 assert.ok(out.warnings.length>0);
});
test('Insufficient identity never merges an unrelated customer',()=>{
 const b={id:'U',cliente:'Mario',telefono:'3331234567',viaggio_id:'M',posti:1,totale:20,pagato:0};
 const result=collectCombinedConfirmation(b,[b,{...b,id:'OTHER'}],trips,[]);
 assert.equal(result.bookingCount,1);
});
test('Canceled or company-reserved bookings are never silently merged',()=>{
 assert.throws(()=>collectCombinedConfirmation(books[7],books,trips,payments),/annullata/);
 const c={...books[1],id:'RES',riserva_aziendale:true};
 const out=collectCombinedConfirmation(books[0],[...books,c],trips,payments);
 assert.equal(out.bookingCount,3);
});
test('Missing stop gets a distinct, explicit section',()=>{
 const b={...books[1],fermata_partenza:null};
 const out=collectCombinedConfirmation(books[0],[books[0],b],trips,payments);
 assert.equal(out.sections.length,2);
 assert.ok(out.sections.some(s=>s.stop==='Fermata non specificata'));
});
