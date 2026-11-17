// DELGROSSO V4: manually choose which physical BUS BIS seats are open, offline safety suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../GESTIONALE/v4/bis-manual.js',import.meta.url),'utf8').replace(/^export /gm,'');
const lib=vm.runInNewContext(source+';({usableTemplates,inspectLayout,normalizeManualSeats,prepareBisSeatOpening,previewManualLayout})',{});
const makeLayout=n=>({name:'Official GT '+n,rows:Array.from({length:Math.ceil(n/4)},(_,r)=>({
 cells:Array.from({length:4},(_,c)=>r*4+c<n?{type:'seat',id:String(r*4+c+1),label:String(r*4+c+1),status:'available'}:{type:'aisle'})
}))});
const sourceTrip={id:'A',titolo:'Napoli',data_partenza:'2026-12-08',stato:'Programmato'};
const bus={id:'GT63',titolo:'IRIZAR Scania PB A',categoria:'GT',posti:63,attivo:true};
const template={id:'L63',nome:'GT 63',attivo:true,configurazione:makeLayout(63)};
test('64 seats absent or repeated, draft is rejected before opening any BUS BIS',()=>{
 assert.equal(lib.inspectLayout(makeLayout(63),63).valid,true);
 assert.equal(lib.inspectLayout(makeLayout(53),63).valid,false);
 const broken=makeLayout(63);broken.rows[0].cells[1].id='1';
 assert.equal(lib.inspectLayout(broken,63).valid,false);
});
test('Manual seat numbers are exact unique integers within real bus capacity',()=>{
 assert.deepEqual([...lib.normalizeManualSeats('02, 9; 63',63)],['2','9','63']);
 assert.throws(()=>lib.normalizeManualSeats('1,1',63),/più volte/);
 assert.throws(()=>lib.normalizeManualSeats('64',63),/compresi/);
 assert.deepEqual([...lib.normalizeManualSeats('',63)],[]); // empty is allowed during editing, not on commit
});
test('Only a compatible official layout can be selected',()=>{
 assert.equal(lib.usableTemplates([{...template},{...template,id:'bad',configurazione:makeLayout(53)}],bus).length,1);
});
test('Operator can open exactly chosen seats, all others blocked while physical capacity stays unchanged',()=>{
 const out=lib.prepareBisSeatOpening({source:sourceTrip,bus,template,selected:[2,8,16,30],
  allTrips:[sourceTrip],today:'2026-11-17'});
 assert.equal(out.physicalSeats,63);
 assert.equal(out.bookableCount,4);
 assert.deepEqual([...out.bookableSeats],['2','8','16','30']);
 assert.equal(out.closedSeats.length,59);
 const edited=lib.previewManualLayout(template.configurazione,63,out.bookableSeats);
 const cells=edited.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat');
 assert.equal(cells.length,63);
 assert.equal(cells.filter(c=>c.status==='available').length,4);
 assert.equal(cells.find(c=>c.id==='9').status,'blocked');
 assert.equal(template.configurazione.rows[2].cells[0].status,'available','original template remains unchanged');
});
test('BUS already committed on another journey or earlier date fails before preview confirmation',()=>{
 const other={id:'X',data_partenza:sourceTrip.data_partenza,autobus_id:bus.id,stato:'Programmato'};
 assert.throws(()=>lib.prepareBisSeatOpening({source:sourceTrip,bus,template,selected:[1],allTrips:[other],today:'2026-11-17'}),/già assegnato/);
 assert.throws(()=>lib.prepareBisSeatOpening({source:{...sourceTrip,data_partenza:'2026-11-16'},bus,template,selected:[1],allTrips:[],today:'2026-11-17'}),/futura/);
});
test('Unavailable or out-of-service seats cannot be opened',()=>{
 const cfg=makeLayout(63);cfg.rows[0].cells[0].status='out_of_service';
 const protectedTemplate={...template,configurazione:cfg};
 assert.throws(()=>lib.prepareBisSeatOpening({source:sourceTrip,bus,template:protectedTemplate,selected:[1],allTrips:[],today:'2026-11-17'}),/fuori servizio/);
 const out=lib.prepareBisSeatOpening({source:sourceTrip,bus,template:protectedTemplate,selected:[2],allTrips:[],today:'2026-11-17'});
 const edited=lib.previewManualLayout(cfg,63,out.bookableSeats);
 assert.equal(edited.rows[0].cells[0].status,'out_of_service');
});
test('Must not pick an inactive bus, non-GT bus or empty release',()=>{
 for(const mod of [{...bus,attivo:false},{...bus,categoria:'VAN'}]){
  assert.throws(()=>lib.prepareBisSeatOpening({source:sourceTrip,bus:mod,template,selected:[1],allTrips:[],today:'2026-11-17'}),/GT attivo/);
 }
 assert.throws(()=>lib.prepareBisSeatOpening({source:sourceTrip,bus,template,selected:[],allTrips:[],today:'2026-11-17'}),/almeno un posto/);
});
