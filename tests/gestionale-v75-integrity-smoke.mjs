import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('GESTIONALE/dg75-integrita.js');
const html=read('GESTIONALE/index.html');
const sql=read('supabase/patches/v75_restore_known_seat_index_rows_20261103.sql');
new vm.Script(src,{filename:'dg75-integrita.js'});

let onReady=null;
const window={};
const document={
 readyState:'loading',
 getElementById:()=>null,
 addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')onReady=fn;}
};
vm.runInNewContext(src,{window,document,console,Map,Number,String,Set});
assert.equal(typeof window.dg75AuditIntegrity,'function');
assert.equal(typeof window.dg75RenderIntegrity,'function');
assert.equal(typeof onReady,'function');
const quality=window.dg75AuditIntegrity({
 viaggi:[{id:'tripA',titolo:'San Marino - Gradara'}],
 prenotazioni:[
  {id:'already',viaggio_id:'tripA',posti:2,posti_selezionati:'5,6',confirmation_storage_path:'conferme/existing.pdf'},
  {id:'unassigned',viaggio_id:'tripA',posti:1,posti_selezionati:null,confirmation_storage_path:null},
  {id:'canceled',viaggio_id:'tripA',posti:3,stato:'Annullata',posti_selezionati:null,confirmation_storage_path:null},
  {id:'company',viaggio_id:'tripA',posti:2,riserva_aziendale:true,confirmation_storage_path:null}
 ],
 prenotazionePosti:[
  {prenotazione_id:'already',posto:'5'},
  {prenotazione_id:'already',posto:'6'}
 ],
 pagamenti:[
  {id:'receipt',receipt_professional_path:'professionali/existing.pdf'},
  {id:'historical',receipt_professional_path:null}
 ]
});
assert.equal(quality.missingSeats.length,1,'Only active customer with missing seats should be flagged');
assert.equal(quality.missingSeats[0].id,'unassigned');
assert.equal(quality.missingSeats[0].needsChoice,true,'Do not invent a seat when there is no documented number');
assert.equal(quality.noArchivedConfirmation,2,'Historical archived PDF inventory should include noncompany bookings');
assert.equal(quality.noProfessionalReceipt,1);
assert.ok(html.includes('dg75-integrita.js?v=75'),'New integrity module not loaded');
assert.ok(html.includes('window.dg75RenderIntegrity?.()'),'Booking view must refresh audit after loading data');
assert.ok(!src.includes("await rpc("),'Integrity UI must never alter bookings through RPC');
assert.ok(!src.includes("await api("),'Integrity UI must never write back');
assert.ok(sql.includes('count(distinct booking_id)')&&sql.includes('<> 6'),'Migration must pin the audited six bookings');
assert.ok(sql.includes('v_inserted<>26'),'Migration must verify all 26 existing seat links restored');
assert.ok(sql.includes('RICOSTRUZIONE_POSTI_V75'),'Reconstructed rows must be traceable');
assert.ok(!sql.includes('UPDATE public.prenotazioni'),'Do not change passenger/booking data to reconstruct index rows');
assert.ok(!sql.includes('DELETE FROM public.prenotazione_posti'),'Do not erase existing assignments');
console.log('V75 seat reconciliation safety and operator integrity dashboard PASS');
