import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../GESTIONALE/dg67-whatsapp-pdf.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'dg67-whatsapp-pdf.js'});
assert.ok(source.includes("header!=='%PDF-'"),'PDF header must be verified');
assert.ok(source.includes("tail.includes('%%EOF')"),'PDF end marker must be verified');
assert.ok(source.includes("throw Error('Il documento PDF è incompleto o danneggiato: invio bloccato')"),'Invalid PDF must block sharing');
assert.ok(source.includes("inspect.textContent='👁 Controlla PDF'"),'Operator must be able to preview PDF');
assert.ok(source.includes("tab.opener=null"),'PDF preview must not expose opener');
assert.ok(source.includes("if(!file){notice('Prepara prima"),'Share requires a prepared document');
assert.ok(source.includes("foot.prepend(share,pc,down,inspect,retry)"),'Preview must appear in WhatsApp controls');
console.log('WhatsApp PDF validation and preview checks passed');
