import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const email=file('GESTIONALE/dg66-email-verifica.js');
const dashboard=file('GESTIONALE/dg75-integrita.js');
const html=file('GESTIONALE/index.html');
const sw=file('GESTIONALE/sw.js');
new vm.Script(email,{filename:'dg66-email-verifica.js'});
new vm.Script(dashboard,{filename:'dg75-integrita.js'});
assert.ok(html.includes('dg66-email-verifica.js?v=77'));
assert.ok(html.includes('dg75-integrita.js?v=77'));
assert.ok(sw.includes('delgrosso-gestionale-v77-safe-pdf-review'));

const window={};
vm.runInNewContext(dashboard,{
 window,Map,Set,console,
 document:{readyState:'loading',getElementById(){return null},addEventListener(){}}
});
const result=window.dg75AuditIntegrity({
 viaggi:[],
 prenotazioni:[
  {id:'archived',confirmation_storage_path:'conferme/existing.pdf',confirmation_generated_at:'2026-09-01'},
  {id:'generated-orphan',confirmation_storage_path:null,confirmation_generated_at:'2026-09-01'},
  {id:'never-created',confirmation_storage_path:null,confirmation_generated_at:null},
  {id:'company',riserva_aziendale:true,confirmation_storage_path:null}
 ],
 prenotazionePosti:[],
 pagamenti:[]
});
assert.equal(result.noArchivedConfirmation,2);
assert.equal(result.generatedNoArchive,1,'Previously generated PDFs require manual historical review');
assert.equal(result.noGenerationNoArchive,1,'Truly unissued bookings may have a separate explicit workflow');
assert.ok(dashboard.includes('data.generatedNoArchive'));
assert.ok(dashboard.includes('data.noGenerationNoArchive'));

assert.ok(email.includes('button.disabled=!!previouslyGenerated'),'Prevent click when a booking was already generated');
assert.ok(email.includes('if(local.confirmation_generated_at)return alert('),'Protect against direct button invocation');
assert.ok(email.includes('if(info.booking?.confirmation_generated_at)throw new Error('),'Recheck authoritative server state before issuing');
assert.ok(email.includes('Generazione precedente rilevata dal server'),'Explain why generation was blocked');
assert.ok(email.includes('Archivia conferma non ancora generata'),'Avoid misleading duplicate reissue labels');
assert.ok(!email.includes('Rigenera conferma PDF mancante'),'Old misleading duplicate issue label must be removed');
assert.ok(!dashboard.includes("await api('prenotazioni'"),'Read-only panel must not write booking records');
assert.ok(!dashboard.includes("await rpc('"),'Read-only panel must not use privileged mutations');
console.log('V77 PDF history review and three independent duplicate-issuance protections PASS');
