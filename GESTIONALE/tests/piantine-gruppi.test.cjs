// Offline safety checks. No connection to Supabase or real passenger data.
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const map=require('../seatmap-groups.js');
const mock=seats=>({name:'Piantina originale',rows:Array.from({length:Math.ceil(seats/4)},(_,i)=>({
 cells:Array.from({length:5},(_,j)=>{
  if(j===2)return {type:'aisle'};
  const n=i*4+(j>2?j:j+1);
  return n<=seats?{type:'seat',id:String(n),status:'available'}:{type:'empty'};
 })}))});
function browserPdf(file){const window={DGSeatGroups:map};const source=fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
 vm.runInNewContext(source,{window,atob,Uint8Array,Intl,Date,Math,Number,String,Map,Set,Array,JSON,Blob});return window.DG4Pdf||window.DG2Pdf}
const bookings=[
 {id:'B1',cliente:'Rossi (test)',posti:3,posti_selezionati:'1,2,3',fermata_partenza:'San Severo'},
 {id:'B2',cliente:'Bianchi (test)',posti:2,posti_selezionati:'4,5',fermata_partenza:'Apricena'},
 {id:'B3',cliente:'Verdi (test)',posti:2,posti_selezionati:'6,7',fermata_partenza:'San Nicandro'}
];
const raw=mock(53);
test('published geometry preserves each cell and all numbered seats',()=>{
 const clone=JSON.stringify(raw),m=map.normalizeGeometry(raw);
 assert.equal(m.rows.length,14);assert.equal(m.capacity,53);
 assert.equal(m.rows[0].cells[2].type,'aisle');
 assert.equal(m.rows[13].cells[4].type,'empty');
 assert.equal(JSON.stringify(raw),clone);
});
test('group colours repeat on all seats of one booking and differ between groups',()=>{
 const p=map.buildPlan({layout:raw,bookings,strict:true});
 assert.equal(p.groups.length,3);assert.equal(p.bySeat.get('1').number,'G01');
 assert.equal(p.bySeat.get('3').css,p.bySeat.get('1').css);
 assert.notEqual(p.bySeat.get('4').css,p.bySeat.get('1').css);
 assert.equal(p.groups[1].seats.join(','),'4,5');
});
test('sixteenth row and 8-column door/driver/aisle are not truncated',()=>{
 const custom={name:'8 colonne',rows:[{cells:[1,2,'aisle',3,4,{type:'door'},5,6]}]};
 const m=map.normalizeGeometry(custom);assert.equal(m.columns,8);
 assert.deepEqual(m.rows[0].cells.map(x=>x.type),['seat','seat','aisle','seat','seat','door','seat','seat']);
});
test('trip-specific official layout wins over bus default; missing official remains missing',()=>{
 const t={id:'t1',autobus_id:'bus1'};
 const ts=[{viaggio_id:'t1',autobus_id:'bus1',configurazione:{name:'viaggio'},versione:3}];
 const bs=[{autobus_id:'bus1',configurazione:{name:'bus'},versione:2}];
 assert.equal(map.resolveLayout(t,ts,bs).config.name,'viaggio');
 assert.equal(map.resolveLayout(t,[],bs).config.name,'bus');
 assert.equal(map.resolveLayout(t,[],[]),null);
 assert.equal(map.resolveLayout({...t,autobus_id:'bus2'},ts,[]),null);
});
test('a conflict or a changed seat list blocks the passenger-facing print',()=>{
 const duplicate=[bookings[0],{...bookings[1],posti_selezionati:'3,4'}];
 assert.throws(()=>map.buildPlan({layout:raw,bookings:duplicate,strict:true}),/CONFLITTO/);
 assert.throws(()=>map.buildPlan({layout:raw,bookings,seatRows:[
  {prenotazione_id:'B1',posto:'1'}, {prenotazione_id:'B1',posto:'2'}],strict:true}),/non è coerente/);
});
test('V4 PDF is real and contains group markers using identical official layout',()=>{
 const pdf=browserPdf('v4/pdf-engine.js');
 const trip={id:'T',titolo:'Napoli',data_partenza:'2026-12-20',posti_totali:53};
 const group=[{trip,buses:[{trip,name:'GT53',bookings:bookings.map(b=>({...b,sedili:map.seatList(b.posti_selezionati)})),
  layout:raw,seatRows:[],official:true,layoutSource:'viaggio',layoutVersion:1}]}];
 const output=Buffer.from(pdf.makeOperationalPdf(group,{onlyMaps:true,requireOfficial:true})).toString('latin1');
 assert.ok(output.startsWith('%PDF-'));
 for(const g of ['G01','G02','G03'])assert.ok(output.includes('<'+Buffer.from(g,'ascii').toString('hex')+'>'));
 assert.ok(output.includes('%%EOF'));
});
test('legacy V2 PDF does not invent an unofficial layout',()=>{
 const pdf=browserPdf('suite/pdf-report.js');
 const trip={id:'T',titolo:'Napoli',data_partenza:'2026-12-20',posti_totali:53};
 const output=Buffer.from(pdf.makeOperationalPdf([{trip,buses:[{trip,name:'GT53',bookings,layout:raw,official:false}]}])).toString('latin1');
 const warning=Buffer.from('PIANTINA UFFICIALE NON DISPONIBILE','ascii').toString('hex');
 assert.ok(output.includes('<'+warning+'>'));
 assert.ok(!output.includes('<'+Buffer.from('POSTO 1','ascii').toString('hex')+'>')); // no fictitious seats
});
