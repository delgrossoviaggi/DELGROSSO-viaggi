import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/ricevuta.js', import.meta.url), 'utf8');
const booking = {
  riferimento: 'DG-P-TEST1234', viaggio: 'Città di Napoli – Spaccanapoli 🎄',
  data: '22 novembre 2026', ora: '05:20',
  nome: 'Niccolò d’Amico', cognome: 'Rossi', telefono: '0000000000',
  fermataPartenza: 'Apricena', numeroPosti: 2, posti: [1,2], prezzo: 25, totale: 50
};

function loadGenerator(fetch) {
  const window = {};
  vm.runInNewContext(source, {window, fetch, TextEncoder, Blob, Uint8Array, setTimeout, console}, {timeout:3000});
  assert.equal(typeof window.DGReceipt?.generate, 'function');
  return window.DGReceipt.generate;
}
function validatePdf(buffer) {
  const pdf = buffer.toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4\n'), 'Missing PDF header');
  assert.ok(pdf.endsWith('%%EOF\n'), 'Missing PDF trailer');
  const match = /startxref\n(\d+)\n%%EOF\n$/.exec(pdf);
  assert.ok(match, 'Missing startxref');
  const offset = Number(match[1]);
  assert.ok(pdf.slice(offset).startsWith('xref\n'), 'Invalid xref offset');
  const xref = /^xref\n0 (\d+)\n/.exec(pdf.slice(offset));
  assert.ok(xref, 'Missing cross-reference table');
  const lines = pdf.slice(offset + xref[0].length).split('\n');
  for(let id=1;id<Number(xref[1]);id++) {
    const row=lines[id];
    assert.match(row, /^\d{10} 00000 n /, 'Invalid xref entry '+id);
    const at=Number(row.slice(0,10));
    assert.ok(pdf.slice(at).startsWith(id+' 0 obj\n'), 'Incorrect object offset '+id);
  }
  for(const [,length,stream] of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
    assert.equal(stream.length, Number(length), 'Incorrect PDF stream length');
  }
  assert.ok(pdf.includes('DG-P-TEST1234'), 'Booking reference missing');
  assert.ok(pdf.includes('/BaseFont /Helvetica-Bold'), 'Bold font missing');
  assert.ok(pdf.includes('0 0 0 rg'), 'PDF color not reset');
  return buffer.length;
}
const noLogo=loadGenerator(async()=>{throw new Error('Logo unavailable');});
const one=Buffer.from(await (await noLogo(booking)).arrayBuffer());
console.log('Basic PDF: '+validatePdf(one)+' bytes');

const invalidLogo=loadGenerator(async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer}));
const two=Buffer.from(await (await invalidLogo({...booking,viaggio:'Viaggio molto lungo '.repeat(15),nome:'Nicola '.repeat(20)})).arrayBuffer());
console.log('Long fields and invalid logo: '+validatePdf(two)+' bytes');
console.log('PDF smoke tests passed');
