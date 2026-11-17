// DELGROSSO 4.0 — test offline dell'editor piantine, nessuna rete o dato cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../GESTIONALE/v4/layout-editor.js',import.meta.url),'utf8');
const window={};
vm.runInNewContext(source,{window,structuredClone,JSON,Array,Math,Number,String,Error},{timeout:2000});
const editor=window.DG4LayoutEditor;
test('Creazione configurazioni 53, 57 e 63 posti con corridoio centrale',()=>{
 for(const n of [53,57,63]){
  const cfg=editor.newDraft(n);
  assert.equal(editor.countSeats(cfg),n);
  assert.equal(cfg.posti_totali,n);
  assert.ok(cfg.rows.every(row=>row.cells[2].type==='aisle'));
  const numbers=cfg.rows.flatMap(row=>row.cells.filter(x=>x.type==='seat').map(x=>Number(x.label)));
  assert.equal(numbers[0],1);assert.equal(numbers.at(-1),n);
  assert.equal(new Set(numbers).size,n);
 }
});
test('Lavorare su una copia non modifica la configurazione originaria',()=>{
 const original=editor.newDraft(53);
 const copy=JSON.parse(JSON.stringify(original));
 copy.rows[0].cells[0].type='empty';
 editor.renumber(copy);
 assert.equal(editor.countSeats(copy),52);
 assert.equal(editor.countSeats(original),53);
});
test('Riproduzione della matrice ufficiale DB nella struttura interna',()=>{
 const rows=[{rowNumber:1,label:'Fila 1',cells:[{id:'1',type:'seat',label:'1'},{type:'aisle'},{id:'2',type:'seat',label:'2'}]}];
 const converted=editor.ensureRows({rows});
 assert.equal(converted[0].cells[0].id,'1');
 assert.equal(converted[0].cells[1].type,'aisle');
});
