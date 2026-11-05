import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modelSource=read('GESTIONALE/dg79-partenza-modello.js');
const pdfSource=read('GESTIONALE/dg79-partenza-pdf.js');
const uiSource=read('GESTIONALE/dg79-riepilogo-partenza.js');
const html=read('GESTIONALE/index.html');
const sw=read('GESTIONALE/sw.js');
for(const [path,src] of [
 ['modello',modelSource],['pdf',pdfSource],['ui',uiSource]
])new vm.Script(src,{filename:path+'.js'});
assert.ok(html.includes('dg79-partenza-modello.js?v=79'));
assert.ok(html.includes('dg79-partenza-pdf.js?v=79'));
assert.ok(html.includes('dg79-riepilogo-partenza.js?v=79'));
assert.ok(html.includes("dg79DownloadTripReport('"),'Trip rows must let the operator generate PDF');
assert.ok(html.includes('window.dg79RenderToday?.()'),'Dashboard must surface the report on the departure date');
assert.ok(sw.includes('delgrosso-gestionale-v79-departure-pdf'),'Mobile caches must be refreshed');
assert.ok(uiSource.includes("{noCache:true}"),'Financial source must be reread from Supabase');
assert.ok(!uiSource.includes("method:'PATCH'")&&!uiSource.includes("method:'POST'"),
 'Export must not change any booking, payment or financial data');
assert.ok(!uiSource.includes('send-booking-confirmation'),'Internal accounts must never be sent to travellers');

const ctx={window:{},Date,Intl,Map,Set,Number,String,Math,Object,Array,console};
vm.runInNewContext(modelSource,ctx);
vm.runInNewContext(pdfSource,{window:ctx.window,TextEncoder,Uint8Array,Math,Number,String,Array,Object});
const model=ctx.window.DG79Model,pdf=ctx.window.DG79PDF;
assert.equal(typeof model.build,'function');
assert.equal(typeof pdf.make,'function');
assert.deepEqual(Array.from(model.splits(5001,2)),[2501,2500],'Split odd cents without losing a cent');
assert.deepEqual(Array.from(model.splits(-501,2)),[-251,-250],'Refunds must reconcile exactly');
const u1='11111111-1111-4111-8111-111111111111';
const u2='22222222-2222-4222-8222-222222222222';
const tr1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tr2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b1='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const b2='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const canceled='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const group={
 root:{id:tr1,titolo:'Napoli e Spaccanapoli',data_partenza:'2026-11-22',ora_partenza:'05:20:00'},
 trips:[
  {id:tr1,titolo:'Napoli e Spaccanapoli',bis_numero:1},
  {id:tr2,titolo:'Napoli BIS',bis_parent_id:tr1,bis_numero:2}
 ],
 operators:[{user_id:u1,username:'nicola',nome:'Nicola',attivo:true},
            {user_id:u2,username:'raffaele',nome:'Raffaele',attivo:true}],
 bookings:[
  {id:b1,viaggio_id:tr1,cliente:'Cliente A',posti:2,totale:50.01,
   posti_selezionati:'3,4',stato:'Confermata',fermata_partenza:'San Severo'},
  {id:b2,viaggio_id:tr2,cliente:'Cliente B',posti:1,totale:25,
   posti_selezionati:'12',stato:'Confermata',fermata_partenza:'Apricena'},
  {id:canceled,viaggio_id:tr2,cliente:'Cliente annullato',posti:0,totale:15,
   stato:'Annullata'}
 ],
 seats:[],
 payments:[
  {id:'p1',viaggio_id:tr1,prenotazione_id:b1,importo:30,
   tipo:'Acconto',stato:'Registrato',incassato_da_user_id:u1},
  {id:'p2',viaggio_id:tr1,prenotazione_id:b1,importo:20.01,
   tipo:'Saldo',stato:'Registrato',incassato_da_user_id:u2},
  {id:'p3',viaggio_id:tr2,prenotazione_id:b2,importo:25,
   tipo:'Acconto',stato:'Registrato',incassato_da_user_id:u2},
  {id:'p4',viaggio_id:tr2,prenotazione_id:b2,importo:-5,
   tipo:'Rimborso',stato:'Registrato',incassato_da_user_id:u2},
  {id:'p5',viaggio_id:tr2,prenotazione_id:canceled,importo:15,
   tipo:'Acconto',stato:'Registrato',incassato_da_user_id:u1},
  {id:'p6',viaggio_id:tr2,prenotazione_id:canceled,importo:-15,
   tipo:'Rimborso',stato:'Registrato',incassato_da_user_id:u1},
  {id:'p7',viaggio_id:tr1,prenotazione_id:null,importo:7,
   tipo:'Acconto',stato:'Registrato',incassato_da_user_id:u1}
 ],
 transfers:[{tipo_origine:'viaggio',pagamento_id:'p1',
  da_operatore_user_id:u1,a_operatore_user_id:u2,importo:10}]
};
const report=model.build(group);
const tot=report.totals;
assert.equal(report.rows.length,3,'One row per passenger seat including BUS BIS');
assert.equal(tot.pax,3);
assert.equal(tot.quota,7501,'Booking values, not payments, determine gross');
assert.equal(tot.activePaid,7001,'Active bookings net of refunds');
assert.equal(tot.activeResidual,500);
assert.equal(tot.nicola,2700,'Nicola net after transfer plus trip-linked unmatched payment');
assert.equal(tot.raffaele,5001,'Raffaele net after incoming quota transfer and refund');
assert.equal(tot.altro,0);
assert.equal(tot.cashNet,7701);
assert.equal(tot.refunds,2000);
assert.equal(tot.cancelledCash,0,'Cancelled payment with exact refund must not inflate cash');
assert.equal(tot.unlinkedCash,700,'Unlinked payment must not be silently assigned to a passenger');
assert.equal(report.busSummaries.length,2);
assert.equal(report.rows.reduce((n,r)=>n+r.quota,0),tot.quota,'Per-passenger quotas must sum to gross');
assert.equal(report.rows.reduce((n,r)=>n+r.incassato,0),tot.activePaid,'Per-passenger incassi must sum to active receipts');
assert.equal(report.rows.reduce((n,r)=>n+r.residuo,0),tot.activeResidual);
assert.ok(report.warnings.some(x=>x.includes('Movimenti')),'Unlinked movements must be marked');

function inspect(bytes){
 const s=Buffer.from(bytes).toString('latin1');
 assert.ok(s.startsWith('%PDF-1.4'),'Must be a real PDF binary');
 assert.ok(s.endsWith('%%EOF\n'),'PDF trailer required');
 const match=/startxref\n(\d+)\n%%EOF/.exec(s);
 assert.ok(match,'xref pointer missing');
 assert.equal(s.slice(Number(match[1]),Number(match[1])+4),'xref','xref pointer must be exact');
 return s;
}
const bytes=pdf.make(report);
const content=inspect(bytes);
assert.match(content,/Napoli e Spaccanapoli/);
assert.match(content,/CLIENTE A/i);
assert.match(content,/NICOLA/);
assert.match(content,/RAFFAELE/);
assert.match(content,/7701|77,01 EUR/);
assert.match(content,/\bCount 2\b/,'Few bookings should create a detail page and summary page');

const many=structuredClone(group);
many.bookings=[{id:b1,viaggio_id:tr1,cliente:'Gruppo di prova',
 posti:77,totale:77,stato:'Confermata',
 posti_selezionati:Array.from({length:77},(_,i)=>String(i+1)).join(',')}];
many.payments=[];many.transfers=[];
const massive=model.build(many);
const multi=inspect(pdf.make(massive));
assert.ok((multi.match(/\/Type \/Page \/Parent/g)||[]).length>3,'Long departure list must span multiple A4 pages');
const before=JSON.stringify(group);
model.build(group);
assert.equal(JSON.stringify(group),before,'Computation must never modify input records');
console.log('V79: individual quotas, refunds, cash transfers, BUS BIS, PDF xref and multi-page layout PASS');
