import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const email=file('GESTIONALE/dg66-email-verifica.js');
const integrity=file('GESTIONALE/dg75-integrita.js');
const html=file('GESTIONALE/index.html');
const migration=file('supabase/patches/v76_rls_initplan_operator_comms_20261103.sql');
new vm.Script(email,{filename:'dg66-email-verifica.js'});
new vm.Script(integrity,{filename:'dg75-integrita.js'});
assert.ok(html.includes('dg66-email-verifica.js?v=76'),'Email PDF controls must be cache-busted');
assert.ok(html.includes('dg75-integrita.js?v=76'),'Integrity panel must be cache-busted');

const start=email.indexOf('function fill(){'),end=email.indexOf('\nwindow.dg66RefreshEmail=',start);
assert.ok(start>0&&end>start,'Archive filter helper not found');
const el={
 dg66Kind:{value:'booking'},
 dg66Target:{value:'',innerHTML:''},
 dg66MissingOnly:{checked:true},
 dg66MissingCount:{textContent:''},
 dg66MissingLabel:{textContent:''},
 dg66MissingOnlyWrap:{style:{}}
};
const bookings=[
 {id:'missing',cliente:'Cliente A',confirmation_storage_path:null},
 {id:'stored',cliente:'Cliente B',confirmation_storage_path:'conferme/existing.pdf'}
];
const payments=[
 {id:'acconto-no-pdf',prenotazione_id:'missing',tipo:'Acconto',stato:'Registrato'},
 {id:'saldo-pdf',prenotazione_id:'stored',tipo:'Saldo',stato:'Registrato',receipt_professional_path:'professionali/saldo.pdf'},
 {id:'refund-no-pdf',prenotazione_id:'stored',tipo:'Rimborso',stato:'Registrato'}
];
const ctx={$:id=>el[id],bookList:()=>bookings,payList:()=>payments,findBooking:id=>bookings.find(x=>x.id===id),esc:String};
vm.runInNewContext(email.slice(start,end)+'\nthis.recheck=fill;',ctx);
ctx.recheck();
assert.ok(el.dg66Target.innerHTML.includes('missing'));
assert.ok(!el.dg66Target.innerHTML.includes('stored'));
assert.match(el.dg66MissingCount.textContent,/1 da verificare/);
el.dg66Kind.value='payment';ctx.recheck();
assert.ok(el.dg66Target.innerHTML.includes('acconto-no-pdf'),'Missing deposit must be visible');
assert.ok(el.dg66Target.innerHTML.includes('refund-no-pdf'),'Missing refund must be visible');
assert.ok(!el.dg66Target.innerHTML.includes('saldo-pdf'),'Payment with stored PDF must be excluded');
assert.match(el.dg66MissingCount.textContent,/2 da verificare/);
assert.match(el.dg66MissingLabel.textContent,/pagamenti/i);
assert.equal(el.dg66MissingOnlyWrap.style.display,'flex');
el.dg66MissingOnly.checked=false;ctx.recheck();
assert.ok(el.dg66Target.innerHTML.includes('saldo-pdf'),'Stored payments must be reachable when filter is off');
assert.ok(email.includes("acconto|saldo|rimborso"),'Refunds must be included in payment review');
assert.ok(email.includes('dg66OpenMissing=function'),'Integrity desk must be able to open either missing-PDF list');
assert.ok(email.includes("if(kind==='payment'&&/^rimborso$/i.test"),'Refund email resend must be blocked');
assert.ok(email.includes('resend.disabled=!hasPdf||refund'),'UI must disable refund/missing PDF re-sends');
assert.ok(!email.includes('createGestionaleBooking('),'PDF audit must not create bookings');
assert.ok(!email.includes("method:'DELETE'"),'PDF audit must not delete any payment');

let launch=null;const window={};
vm.runInNewContext(integrity,{
 window,Map,
 document:{readyState:'loading',getElementById:()=>null,addEventListener:(kind,cb)=>{if(kind==='DOMContentLoaded')launch=cb}},
 console
});
assert.equal(typeof window.dg75AuditIntegrity,'function');
const summary=window.dg75AuditIntegrity({
 viaggi:[],prenotazioni:[{id:'b',confirmation_storage_path:null}],
 prenotazionePosti:[],
 pagamenti:payments
});
assert.equal(summary.noPdfPayments,2);
assert.equal(summary.missingAccontiSaldi,1);
assert.equal(summary.missingRimborsi,1);
assert.ok(integrity.includes('data-dg75-payments="1"'),'Missing payments must be accessible with one action');
assert.ok(integrity.includes("window.dg66OpenMissing?.(kind)"),'Integrity desk must select the correct review type');
assert.ok(migration.includes('v_count <> 9'),'RLS change must be pinned to nine existing policies');
assert.ok(migration.includes("replace(r.qual,'auth.uid()','(select auth.uid())')"),'RLS change must preserve authorization predicates');
console.log('V76 historical PDF filtering, refund safeguards, operator review navigation and RLS scope PASS');
