import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('GESTIONALE/index.html','utf8');
const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
assert.match(html,/<head\s*>\s*<!-- DG38:[\s\S]{0,160}<base href="\/GESTIONALE\/">/, 'V2 must set absolute base before relative asset links');
assert(html.includes('data-src="./suite/index.html"'),'V2 still embeds authenticated Business Suite');
assert(html.includes('src="delgrosso-logo-originale-bianco.png"'),'V2 still uses original logo');
for (const [relative,expected] of [
  ['./suite/index.html','/GESTIONALE/suite/index.html'],
  ['delgrosso-logo-originale-bianco.png','/GESTIONALE/delgrosso-logo-originale-bianco.png'],
  ['./suite/app.js','/GESTIONALE/suite/app.js']
]) {
  const resolved=new URL(relative,'https://www.delgrossoviaggi.it/GESTIONALE/').pathname;
  assert.equal(resolved,expected);
  assert(fs.existsSync('.'+expected),'Required static file not found: '+expected);
}
for(const path of ['/GESTIONALE','/GESTIONALE/']) {
  assert(vercel.redirects.some(r=>r.source===path&&r.destination==='/GESTIONALE/index.html'),'redirect absent: '+path);
}
assert(vercel.headers.some(x=>x.headers.some(h=>h.key==='X-Frame-Options'&&h.value==='SAMEORIGIN')),'iframe security must remain same-origin');
console.log('DG38 PASS: original V2 menu preserved, Suite and logo paths resolvable with or without slash.');
