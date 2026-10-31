import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../GESTIONALE/dg66-email-verifica.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'dg66-email-verifica.js'});
assert.ok(source.includes('dg66GenerateMissing()'),'Manual recovery button missing');
assert.ok(source.includes('action:\'context\''),'Authenticated server context required');
assert.ok(source.includes('action:\'issue\''),'Secure archive action missing');
assert.ok(source.includes('accessHeaders()'),'Operator session headers missing');
assert.ok(source.includes('if(!confirm('),'Recovery must require manual confirmation');
assert.ok(!source.includes('createGestionaleBooking('),'Recovery must not create bookings');

const start=source.indexOf('function bookingReceiptData(b,tr){');
const end=source.indexOf('async function ensureReceiptGenerator()',start);
assert.ok(start>=0&&end>start,'Pure receipt builder not found');
const scope={};
vm.runInNewContext(source.slice(start,end)+'\nglobalThis.build=bookingReceiptData;',scope);
const result=scope.build({
 cliente_nome:'Mario Rossi',telefono:'0000000000',confirmation_number:'DG-P-TEST0001',
 posti_selezionati:'4,5',posti:2,totale:50,fermata_partenza:'Apricena'
},{titolo:'Napoli - Spaccanapoli',data_partenza:'2026-11-22',ora_partenza:'05:20'});
assert.equal(result.riferimento,'DG-P-TEST0001');
assert.equal(result.numeroPosti,2);
assert.equal(result.prezzo,25);
assert.equal(result.totale,50);
assert.equal(result.fermataPartenza,'Apricena');
assert.equal(result.posti.join(','),'4,5');
assert.equal(result.viaggio,'Napoli - Spaccanapoli');
assert.ok(source.includes('id="dg66MissingOnly"'), 'Missing PDF quick filter required');
assert.ok(source.includes("allBookings.filter(x=>!x.confirmation_storage_path)"), 'Count of missing PDFs required');
assert.ok(source.includes("showMissing?allBookings.filter(x=>!x.confirmation_storage_path):allBookings"), 'Missing-only list must not include archived PDFs');
console.log('Authenticated operator PDF recovery and missing-document filtering smoke tests passed');
