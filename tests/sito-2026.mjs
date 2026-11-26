// Controlli del sito pubblico 2026: pagine collegate agli script giusti, nessuna chiave privata,
// prenotazione con le funzioni sicure del bridge e conferma PDF archiviata.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execSync} from 'node:child_process';
const pages=['index.html','viaggi.html','viaggio.html','prenota.html','flotta.html','limousine.html','noleggio.html','partyontheroad.html','news.html','chi-siamo.html','contatti.html','preventivo.html','privacy.html','cookie.html'];
for(const p of pages){
  const h=fs.readFileSync(p,'utf8');
  assert(h.includes('assets/sito.css?v='),p+': manca il foglio di stile');
  assert(h.includes('lang="it"'),p);
  assert(!/fonts\.googleapis|fonts\.gstatic/.test(h),p+': niente font da Google');
  assert(h.includes('320 573 0466')&&h.includes('366 212 7916'),p+': contatti nel piè di pagina');
}
for(const p of ['index.html','viaggi.html','viaggio.html'])assert(fs.readFileSync(p,'utf8').includes('js/gestionale.js?v='),p);
const pren=fs.readFileSync('prenota.html','utf8');
for(const s of ['js/gestionale.js','js/ricevuta.js','js/prenota.js'])assert(pren.includes(s),'prenota: '+s);
for(const f of ['js/sito.js','js/prenota.js','js/gestionale.js']){
  const js=fs.readFileSync(f,'utf8');
  execSync('node --check '+f);
  assert(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|service_role\s*:/.test(js),f+': chiavi private vietate');
}
const pj=fs.readFileSync('js/prenota.js','utf8');
for(const s of ['createGestionaleBooking(','getBookedSeats(','getBusLayout(','getTripStops(','DGReceipt.generate(',"'archive-booking'","'booking-pdf-url'"])assert(pj.includes(s),'prenota.js usa '+s);
assert(/latest\.has/.test(pj),'controllo dei posti appena prima di registrare');
assert(/__dgOfflineCatalog/.test(pj),'nessuna prenotazione con catalogo di emergenza');
console.log('Sito 2026: '+pages.length+' pagine controllate, prenotazione con bridge sicuro e PDF archiviato.');
