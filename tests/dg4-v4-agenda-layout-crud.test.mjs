import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const dir=new URL('../GESTIONALE/v4/',import.meta.url);
const rawA=readFileSync(new URL('agenda-model.js',dir),'utf8').replace(/^export /gm,'');
const rawL=readFileSync(new URL('layout-operations.js',dir),'utf8').replace(/^export /gm,'');
const ctx=vm.createContext({Date,String,Number,Math,Set,Map,Array,Object,JSON,Error,RegExp});
vm.runInContext(rawA+'\n'+rawL+
 '\n;globalThis.models={agendaEntries,isDiaryEntry,isDeadlineEntry,deadlineStats,calendarMonth,shiftCalendarMonth,validateAgendaEntry,agendaDeleted,seatCount,isCompleteLayout,eligibleGtBuses,layoutAssociations,archivePlan,compatibleTrips};',ctx);
const m=ctx.models;
const agenda=[
 {id:'A',tipo:'Appuntamento',titolo:'Incontro clienti',data_scadenza:'2026-11-20',stato:'aperta',priorita:'normale'},
 {id:'B',tipo:'Estintori',titolo:'Revisione estintori',data_scadenza:'2026-11-15',stato:'aperta',priorita:'alta'},
 {id:'C',tipo:'Scadenza',titolo:'Rinnovo carta di circolazione',data_scadenza:'2026-11-17',stato:'completata'},
 {id:'D',tipo:'Nota',titolo:'Eliminato',data_scadenza:'2026-11-20',stato:'eliminata'}
];
const layout=cap=>({name:'GT',rows:Array.from({length:Math.ceil(cap/4)},(_,i)=>({
 cells:Array.from({length:4},(_,j)=>i*4+j<cap?{type:'seat',id:String(i*4+j+1),status:'available'}:{type:'empty'})
}))});
const buses=[
 {id:'GT53',categoria:'GT',posti:53,attivo:true},
 {id:'GT63A',categoria:'GT',posti:63,attivo:true},
 {id:'GT63B',categoria:'GT',posti:63,attivo:true},
 {id:'LIMO',categoria:'Limousine Bus',posti:30,attivo:true}
];
test('Agenda calendar and scadenze have distinct entries and preserve legacy Estintori',()=>{
 assert.equal(m.agendaEntries(agenda,'agenda').map(x=>x.id).join(','),'A');
 assert.equal(m.agendaEntries(agenda,'scadenze').map(x=>x.id).join(','),'B,C');
 assert.equal(m.agendaEntries(agenda,'agenda',{includeDeleted:true}).map(x=>x.id).join(','),'D');
 assert.equal(m.isDeadlineEntry(agenda[1]),true);
 assert.equal(m.deadlineStats(agenda,'2026-11-17').late,1);
 assert.equal(m.deadlineStats(agenda,'2026-11-17').done,1);
});
test('Calendar month includes correct days without locale-dependent drift',()=>{
 const days=m.calendarMonth('2026-11');
 assert.equal(days.find(x=>x.date==='2026-11-17').day,17);
 assert.equal(m.shiftCalendarMonth('2026-11',1),'2026-12');
 assert.equal(m.shiftCalendarMonth('2027-01',-1),'2026-12');
});
test('Create/edit accepts only relevant fields, original legacy types and valid dates',()=>{
 const base={titolo:'Revisione flotta',descrizione:'GT 53',note:'Contattare officina',
  data_scadenza:'2026-12-13',priorita:'alta',stato:'aperta',tipo:'Estintori'};
 const valid=m.validateAgendaEntry(base,{section:'scadenze',original:agenda[1]});
 assert.equal(valid.tipo,'Estintori');
 assert.throws(()=>m.validateAgendaEntry({...base,tipo:'Appuntamento'},{section:'scadenze'}),/Tipo incompatibile/);
 assert.throws(()=>m.validateAgendaEntry({...base,data_scadenza:'2026-11-31'},{section:'scadenze'}),/data valida/);
 assert.equal(m.validateAgendaEntry({...base,tipo:'Nota'},{section:'agenda'}).tipo,'Nota');
});
test('GT 53 and GT 63 layout association must match exactly physical numbered seats',()=>{
 const l53={id:'L53',attivo:true,configurazione:layout(53)};
 const l63={id:'L63',attivo:true,configurazione:layout(63)};
 assert.equal(m.seatCount(l53.configurazione),53);
 assert.equal(m.isCompleteLayout(l53.configurazione,53),true);
 assert.equal(m.eligibleGtBuses(l53,buses).map(x=>x.id).join(','),'GT53');
 assert.equal(m.eligibleGtBuses(l63,buses).map(x=>x.id).join(','),'GT63A,GT63B');
 assert.equal(m.eligibleGtBuses({...l53,attivo:false},buses).length,0);
 const wrong=layout(53);wrong.rows[0].cells[1].id='1';
 assert.equal(m.isCompleteLayout(wrong,53),false);
});
test('An archived library layout never destroys official bus or journey layouts',()=>{
 const lib={id:'lib',nome:'GT63',attivo:true,configurazione:layout(63)};
 const refs=m.layoutAssociations(lib.id,[{layout_id:'lib',autobus_id:'GT63A'}],[{layout_id:'lib',viaggio_id:'T1'}]);
 assert.equal(refs.buses.length,1);assert.equal(refs.trips.length,1);
 const preview=m.archivePlan(lib,refs.buses,refs.trips);
 assert.equal(preview.isAssociated,true);
 assert.equal(preview.assignedBuses,1);
 assert.match(preview.message,/configurazioni ufficiali restano conservate/);
});
test('Matching custom trip seat map never uses unrelated bus or mismatched seat count',()=>{
 const l={id:'L53',attivo:true,configurazione:layout(53)};
 const trips=[
  {id:'T1',autobus_id:'GT53',posti_totali:53},
  {id:'T2',autobus_id:'GT63A',posti_totali:63},
  {id:'T3',autobus_id:'GT53',posti_totali:53,archiviato_at:'2026-11-01'}
 ];
 assert.equal(m.compatibleTrips(l,trips,buses).map(x=>x.id).join(','),'T1');
});
