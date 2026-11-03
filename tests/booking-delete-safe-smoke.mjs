import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../GESTIONALE/index.html',import.meta.url),'utf8');
const start=html.indexOf('async function deleteBooking(id){');
const end=html.indexOf('\nfunction openPaymentModal(',start);
assert.ok(start>0&&end>start,'Booking delete handler was not found');
const code=html.slice(start,end);
new vm.Script(code);
assert.ok(!code.includes("method:'DELETE'"),'No unsafe direct REST DELETE fallback after RPC failure');
assert.ok(!code.includes('dg_sync_booking_seats'),'Do not release seats before deleting through the database');
assert.ok(code.includes("await api('prenotazioni'"),'Delete must verify the database result');
assert.ok(html.includes('value="attive" selected>Attive (escluse annullate)'),'Cancelled bookings must be hidden by default but accessible');
assert.equal(html.split("st==='attive'?!/annull|cancel|storn|rimbors/i.test").length-1,2,'Both booking lists must respect the active filter');
assert.ok(html.includes("company?' class="),'Company reservation booking list must still render');

const sql=readFileSync(new URL('../supabase/patches/safe_booking_delete_preserve_payments_outbound_20261103.sql',import.meta.url),'utf8');
assert.ok(sql.includes("dg_private.has_permission('operazioni', 'delete')"),'Server must enforce permissions');
assert.ok(sql.includes('v_payment_count > 0 or v_message_count > 0'),'Even zero-value payment records and outbound messages must be preserved');
assert.ok(sql.includes("stato = 'Annullata'"),'Protected bookings should be cancelled, not deleted');
assert.ok(sql.includes('delete from public.prenotazione_posti'),'Cancelling must release seats');
assert.ok(sql.includes('delete from public.prenotazioni'),'Unpaid bookings with no protected history must be deleted');

const id='00000000-0000-4000-8000-000000000400';
async function exercise({payments=[],mode='eliminata',confirmation=true,throws='',check,busy=false}={}){
 const events=[];
 const state={prenotazioni:[{id,cliente:'Cliente test',codice:'DG-TEST',stato:'Confermata'}],pagamenti:payments};
 const window={dgBookingDeleteBusy:busy};
 const ctx={
  window,state,encodeURIComponent,
  confirm:text=>{events.push({kind:'confirm',text});return confirmation},
  rpc:async(name,args)=>{events.push({kind:'rpc',name,args});if(throws)throw Error(throws);return {mode,booking_id:id}},
  api:async(table,qs,opts)=>{events.push({kind:'api',table,qs,opts});return check??(mode==='eliminata'?[]:[{id,stato:'Annullata',posti:0}])},
  closeModal:()=>events.push({kind:'close'}),
  toast:(text,success)=>events.push({kind:'toast',text,success}),
  log:text=>events.push({kind:'log',text}),
  loadAll:async(force)=>events.push({kind:'refresh',force})
 };
 vm.runInNewContext(code+'\nthis.deleteBooking=deleteBooking;',ctx);
 await ctx.deleteBooking(id);
 return {events,ctx};
}
const unpaid=await exercise();
assert.equal(unpaid.events.filter(e=>e.kind==='rpc').length,1);
assert.equal(unpaid.events.find(e=>e.kind==='rpc').name,'dg_delete_booking');
assert.equal(unpaid.events.find(e=>e.kind==='rpc').args.p_booking_id,id);
assert.equal(unpaid.events.find(e=>e.kind==='api').opts.noCache,true);
assert.ok(unpaid.events.some(e=>e.kind==='toast'&&e.text.includes('eliminata definitivamente')));
assert.ok(unpaid.events.some(e=>e.kind==='refresh'&&e.force===true));

const paid=await exercise({payments:[{prenotazione_id:id,importo:30}],mode:'annullata'});
assert.ok(paid.events.find(e=>e.kind==='confirm').text.includes('movimenti contabili'));
assert.ok(paid.events.some(e=>e.kind==='toast'&&e.text.includes('ANNULLATA')));
assert.ok(paid.events.some(e=>e.kind==='toast'&&e.text.includes('conservati')));
assert.ok(paid.events.some(e=>e.kind==='refresh'&&e.force===true));

const cancelled=await exercise({confirmation:false});
assert.equal(cancelled.events.filter(e=>e.kind==='rpc').length,0,'Operator declined confirmation');

const rejected=await exercise({throws:'Permission denied'});
assert.equal(rejected.events.filter(e=>e.kind==='api').length,0,'Failed RPC must not attempt direct deletion');
assert.equal(rejected.events.filter(e=>e.kind==='refresh').length,0);
assert.ok(rejected.events.some(e=>e.kind==='toast'&&e.text.includes('Permission denied')));

const unverifiable=await exercise({mode:'eliminata',check:[{id,stato:'Confermata',posti:2}]});
assert.ok(unverifiable.events.some(e=>e.kind==='toast'&&e.text.includes('ancora presente')));
assert.equal(unverifiable.events.filter(e=>e.kind==='refresh').length,0);

const busy=await exercise({busy:true});
assert.equal(busy.events.filter(e=>e.kind==='rpc').length,0,'Prevent double submit');
console.log('Booking deletion: permanent delete, safe cancellation, readback, errors and duplicate actions passed');
