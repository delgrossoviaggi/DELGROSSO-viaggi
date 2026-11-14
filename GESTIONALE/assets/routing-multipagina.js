/* DELGROSSO VIAGGI 3.0 ULTIMATE — pagine statiche con routing sicuro. */
'use strict';
(function(global){
 const paths=Object.freeze({"dashboard":"index.html","trips":"viaggi.html","archivedTrips":"viaggi-archiviati.html","bookings":"prenotazioni.html","moves":"sposta-data.html","control":"control-room.html","layouts":"piantine.html","fleet":"flotta.html","customers":"clienti.html","payments":"pagamenti.html","cash":"cassa-generale.html","nicola":"contabilita-nicola.html","raffaele":"contabilita-raffaele.html","economy":"economia.html","cashClosing":"chiusura-cassa.html","suppliers":"fornitori.html","tripCosts":"costi-viaggio.html","rentals":"noleggi.html","whatsapp":"whatsapp.html","documents":"documenti.html","invoices":"fatturazione.html","notifications":"notifiche.html","reports":"report.html","assistant":"anomalie.html","archive":"archivio.html","agenda":"agenda.html","quotes":"preventivi.html","tasks":"scadenze.html","transfers":"trasferimenti-cassa.html","drivers":"autisti.html","settings":"impostazioni.html","diagnostics":"diagnostica.html"});
 const fileToRoute=Object.freeze(Object.fromEntries(Object.entries(paths).map(([k,v])=>[v,k])));
 function resolve(pathname){
  let filename='index.html';
  try{ filename=String(pathname||'').split('/').filter(Boolean).pop()||'index.html'; }catch{}
  return fileToRoute[filename]||'dashboard';
 }
 global.DGPageRoutes=Object.freeze({paths,resolve,current:resolve(global.location?.pathname)});
})(window);
