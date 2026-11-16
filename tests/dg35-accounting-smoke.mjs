import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file='GESTIONALE/contabilita-operativa.html';
const html=fs.readFileSync(file,'utf8');
assert(html.startsWith('<!doctype html>'));
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
assert.equal(inline.length,1,'one inline app script');
new vm.Script(inline[0],{filename:'contabilita-operativa.html'});
for(const required of ['dg2-operator-login','dg_register_payment','dg_register_rental_payment',
'operatori_gestionale','pagamenti','cassa_trasferimenti','suite/operator-ledger.js',
'Auth','Contabilità Nicola','Contabilità Raffaele','pendingUnknown=sent']){
 assert(html.includes(required),'Missing '+required);
}
assert(!html.includes('service_role'),'never embed privileged keys');
assert(html.includes("order:(table==='operatori_gestionale'?'user_id.asc':'id.asc')"),'correct operator pagination');
assert(html.includes("busy=false;await sync()"),'refresh data after successful payment');
assert(html.includes("pendingUnknown=sent"),'do not block valid retry before RPC dispatch');
assert(html.includes("await authorized()"),'validate operator identity before saving');
console.log('DG35 standalone accounting syntax and safety smoke: PASS');
