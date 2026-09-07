import { getPublicConfirmation } from './services/bookingNotificationService.js';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const bookingId = params.get('booking') || params.get('id');
const token = params.get('token');
const money = value => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(value)||0);
(async()=>{
  try {
    if(!bookingId || !token) throw new Error('Il link di conferma non è completo.');
    const result = await getPublicConfirmation(bookingId, token);
    if(result.success === false) throw new Error(result.error || 'Prenotazione non trovata.');
    const data = result.data || {};
    $('numero').textContent=data.numero||'—'; $('cliente').textContent=data.cliente||'—'; $('destinazione').textContent=data.destinazione||'—'; $('data').textContent=data.data||'—'; $('ora').textContent=data.ora||'—'; $('partenza').textContent=data.partenza||'—'; $('posti').textContent=Array.isArray(data.posti)?data.posti.join(', '):data.posti||'—'; $('totale').textContent=money(data.totale); $('stato').textContent=data.stato||'—';
    $('loading').classList.add('hidden'); $('content').classList.remove('hidden');
  } catch(error) { $('loading').classList.add('hidden'); $('error').textContent=error.message||'Impossibile verificare la prenotazione.'; $('error').style.display='block'; }
})();
