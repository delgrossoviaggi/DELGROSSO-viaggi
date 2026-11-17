const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.cwd();
const resolver=fs.readFileSync(root+'/GESTIONALE/seatmap-groups.js','utf8');
const generator=fs.readFileSync(root+'/GESTIONALE/nuovo/pdf-piantine-nominativi.js','utf8');
const ctx={window:{},console,Uint8Array};vm.createContext(ctx);vm.runInContext(resolver,ctx);vm.runInContext(generator,ctx);
const seat=n=>({type:'seat',id:String(n),status:'available'}),aisle={type:'aisle'},empty={type:'empty'},door={type:'door'};
const standard=(start)=>[seat(start),seat(start+1),aisle,seat(start+2),seat(start+3)];
const fw=Array.from({length:16},(_,i)=>standard(1+i*4));
// I posti prima della porta differiscono fisicamente tra FW e GS.
fw[6]=[seat(25),seat(26),aisle,empty,door];fw[7]=[seat(29),seat(30),empty,seat(27),seat(28)];
for(let i=8;i<15;i++)fw[i]=standard(31+(i-8)*4);
fw[15]=[seat(59),seat(60),seat(61),seat(62),seat(63)];
const gs=fw.map(row=>row.map(c=>({...c})));
gs[6]=[seat(27),seat(28),aisle,empty,door];gs[7]=[seat(29),seat(30),empty,seat(25),seat(26)];
const century=Array.from({length:14},(_,i)=>standard(1+i*4));
century[7]=[seat(29),seat(30),empty,empty,door];century[8]=[seat(31),seat(32),empty,empty,empty];
century[9]=[seat(35),seat(36),empty,seat(33),seat(34)];
century[10]=standard(37);century[11]=standard(41);century[12]=standard(45);
century[13]=[seat(49),seat(50),seat(51),seat(52),seat(53)];
function test(name,rows,capacity){
 const config={rows:rows.map(cells=>({cells})),posti_totali:capacity};
 const trip={id:name,titolo:'Napoli',posti_totali:capacity,data_partenza:'2026-11-22'};
 const group={title:'Napoli',buses:[{name,trip,official:true,layout:config,bookings:[{id:'booking1',cliente_nome:'Mario Rossi',posti:2,posti_selezionati:'1,2'}],seatRows:[],warnings:[]}]};
 const pdf=ctx.window.DGSeatPdf.makeSeatMapPdf([group]);
 assert.equal(Buffer.from(pdf.slice(0,5)).toString(),'%PDF-');assert(pdf.length>10000);
 const data=Buffer.from(pdf).toString('latin1');
 assert(data.includes('POSTO')===false,'Il testo dei PDF deve essere codificato esadecimale');
 assert(data.includes(Buffer.from('Mario Rossi','latin1').toString('hex')),'Il referente compare nella piantina');
 assert(data.includes('/MediaBox [0 0 841.89 1190.55]'),'PDF A3');
 assert(data.includes('/Count 2'),'Piantina e legenda separate');
 const used=rows.flat().filter(c=>c.type==='seat').map(c=>Number(c.id));assert.equal(used.length,capacity);assert.equal(new Set(used).size,capacity);
 console.log('PASS',name,capacity,'posti — PDF A3 vettoriale, nominativi, legenda');
}
test('PB FW',fw,63);test('PB GS',gs,63);test('CENTURY',century,53);
