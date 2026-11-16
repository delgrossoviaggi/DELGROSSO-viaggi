import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root='GESTIONALE/nuovo/';
const html=fs.readFileSync(root+'index.html','utf8');
const css=fs.readFileSync(root+'stile.css','utf8');
const js=fs.readFileSync(root+'app.js','utf8');
assert(html.includes('GESTIONALE')||html.includes('DELGROSSO VIAGGI'));
assert(html.includes('id="login-form"')&&html.includes('id="shell"'));
assert(css.includes('[hidden]{display:none!important}'));
assert(html.includes('../suite/operator-ledger.js'));
new vm.Script(js,{filename:'nuovo/app.js'});
assert(!js.includes('service_role')&&!js.includes('sb_secret_'));
assert(js.includes('dg2-operator-login'));
assert(js.includes('is_gestionale_admin'));
assert(js.includes('dg_register_payment')&&js.includes('dg_register_rental_payment'));
assert(js.includes('receipt_number')&&js.includes('unsafeRetry=true'));
assert(js.includes("path.startsWith('/rest/v1/')")&&js.includes("'return=representation'"));
assert(js.includes('pagamenti')&&js.includes('prenotazioni')&&js.includes('viaggi'));
assert(js.includes('scadenze_gestionale')&&js.includes('cassa_trasferimenti'));
assert(js.includes('checkin_effettuato')&&js.includes('fermata_partenza'));
assert(js.includes('fetchTicket++')&&js.includes('new AbortController()'));
const sandbox={};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('GESTIONALE/suite/operator-ledger.js','utf8'),sandbox);
const model=sandbox.DG2OperatorLedger.build({
 trips:[{id:'v',titolo:'Viaggio demo',data_partenza:'2026-12-15'}],
 bookings:[{id:'b',viaggio_id:'v',cliente:'Test',posti:2}],
 payments:[
 {id:'p1',prenotazione_id:'b',viaggio_id:'v',cliente:'Test',tipo:'Acconto',stato:'Registrato',importo:20,incassato_da:'Nicola',metodo:'Contanti'},
 {id:'p2',prenotazione_id:'b',viaggio_id:'v',cliente:'Test',tipo:'Rimborso',stato:'Registrato',importo:-5,incassato_da:'Nicola',metodo:'Contanti'},
 {id:'p3',prenotazione_id:'b',viaggio_id:'v',cliente:'Test',tipo:'Saldo',stato:'Registrato',importo:10,incassato_da:'Raffaele',metodo:'POS'},
 ],
 operators:[{user_id:'n',username:'nicola',attivo:true},{user_id:'r',username:'raffaele',attivo:true}],
 transfers:[{id:'t1',da_operatore_user_id:'n',a_operatore_user_id:'r',stato:'Confermato',importo:3}]
});
assert.equal(model.profiles.nicola.net,1500);
assert.equal(model.profiles.raffaele.net,1000);
assert.equal(model.profiles.nicola.inHand,1200);
assert.equal(model.profiles.raffaele.transferredIn,300);
console.log('DG36: syntax, auth/rpc gates, non-destructive reads and reconciliation smoke PASS');
