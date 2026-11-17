import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const dir='GESTIONALE/nuovo/';
const html=fs.readFileSync(dir+'index.html','utf8');
const css=fs.readFileSync(dir+'stile.css','utf8');
const app=fs.readFileSync(dir+'app.js','utf8');
const moduleText=fs.readFileSync(dir+'piantine-v37.js','utf8');
new vm.Script(app,{filename:'app.js'});
new vm.Script(moduleText,{filename:'piantine-v37.js'});
assert(html.includes('data-page="layouts"'),'Piantine in sidebar');
assert(html.includes('pdf-report.js?v=dg37'),'offline PDF generator included');
assert(html.includes('piantine-v37.js?v=dg37'),'editor script included');
assert(html.includes('../seatmap-groups.js'),'official geometry and group-colour resolver included');
assert(
 html.indexOf('../seatmap-groups.js') < html.indexOf('../suite/pdf-report.js'),
 'group-colour resolver must load before the PDF report script'
);
assert(css.includes('.dg37-editor'),'touch friendly editor');
assert(app.includes('dg28_publish_trip_layout_v1')===false,'layouts RPC isolated in module');
assert(app.includes('layoutDrafts:')&&app.includes('tripOfficial:')&&app.includes('busOfficial:'),'all Supabase tables bound');
assert(app.includes("['POST','PATCH']"),'POST and PATCH return confirmed rows');
assert(app.includes('DG37Layouts.init'),'editor initialized');
assert(app.includes('renderControlMap'),'official seat map integrated');
assert(app.includes('accounting-pdf-nicola')&&app.includes('accounting-pdf-raffaele'),'operator PDF actions wired');
assert(app.includes('control-pdf-sunday'),'Sunday PDF accessible');
assert(app.includes('DG37Layouts?.clear()'),'logout clears editor state');
const ctx={window:{},document:{},console};
vm.createContext(ctx);vm.runInContext(moduleText,ctx);
const mod=ctx.window.DG37Layouts;
for(const n of [53,57,63]){
 const conf=mod.makeConfig(n);
 assert.equal(conf.rows.length,Math.ceil(n/4));
 const v=mod.validate(conf,n);
 assert.equal(v.seats,n);
 assert.equal(new Set(conf.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat').map(c=>c.id)).size,n);
 const legacy={rows:conf.rows.map(r=>r.cells.map(c=>c.type==='seat'?Number(c.id):c.type)),posti_totali:n};
 assert.equal(mod.validate(mod.normalize(legacy),n).seats,n);
}
const bad=mod.makeConfig(63);bad.rows[0].cells[0].id='2';
assert.throws(()=>mod.validate(bad,63),/duplicat/i);
const incomplete=mod.makeConfig(53);incomplete.rows[0].cells[0]={type:'empty'};
assert.throws(()=>mod.validate(incomplete,53),/INCOMPLETA/i);
const off=mod.makeConfig(63);off.rows[1].cells[0].status='blocked';
assert.equal(mod.validate(off,63).seats,63);
const pdfFile='GESTIONALE/suite/pdf-report.js';
const pdfSrc=fs.readFileSync(pdfFile,'utf8');
const pdfContext={window:{},console,Blob,Uint8Array,TextEncoder,Buffer};
vm.createContext(pdfContext);
// Load the same resolver the browser includes ahead of the PDF module.
// Without it, this standalone VM test is missing a browser dependency.
const seatmapSrc=fs.readFileSync('GESTIONALE/seatmap-groups.js','utf8');
new vm.Script(seatmapSrc,{filename:'seatmap-groups.js'});
vm.runInContext(seatmapSrc,pdfContext);
assert.equal(typeof pdfContext.window.DGSeatGroups.buildPlan,'function','group colours and seat geometry resolver loaded');
vm.runInContext(pdfSrc,pdfContext);
assert.equal(typeof pdfContext.window.DG2Pdf.makeOperationalPdf,'function');
const group=[{
 title:'Napoli 22 novembre',
 trip:{id:'tripA',titolo:'Napoli',data_partenza:'2026-11-22'},
 buses:[
  {name:'BUS 1',trip:{id:'tripA',titolo:'BUS 1',data_partenza:'2026-11-22',posti_totali:63},bookings:[{id:'a',cliente:'Cliente simulato',posti:1,sedili:['1'],fermata_partenza:'San Severo'}],official:true,layout:mod.makeConfig(63),warnings:[]},
  {name:'BUS BIS',trip:{id:'tripB',titolo:'BUS 2',data_partenza:'2026-11-22',posti_totali:63},bookings:[{id:'b',cliente:'Cliente simulato B',posti:1,sedili:['2'],fermata_partenza:'Apricena'}],official:true,layout:mod.makeConfig(63),warnings:[]}
 ]}];
const bytes=pdfContext.window.DG2Pdf.makeOperationalPdf(group);
assert(bytes.length>2000,'nonempty operational PDF');
assert(String.fromCharCode(...bytes.slice(0,5))==='%PDF-','valid PDF header');
console.log('DG37 PASS — app syntax, 53/57/63 schemas, legacy import, numbering, two-bus operational PDF');
