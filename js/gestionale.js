// DELGROSSO Viaggi — bridge pubblico SITO -> GESTIONALE
// Il browser non accede direttamente al database operativo.
const SITE_SUPABASE_URL = 'https://bhsanrbadsqcpbtxupmr.supabase.co';
const GESTIONALE_BRIDGE = `${SITE_SUPABASE_URL}/functions/v1/gestionale-bridge`;

const gestFmtDate = d => d ? new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')) : '';
const gestFmtTime = t => t ? String(t).slice(0,5) : '';
const gestEsc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function gestBridge(action, payload={}){
  const res = await fetch(GESTIONALE_BRIDGE, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...payload})
  });
  const text = await res.text();
  let data=null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if(!res.ok) throw new Error(data?.error || `Servizio non disponibile (${res.status})`);
  if(data && data.error) throw new Error(data.error);
  return data;
}

async function getGestionaleTrips(){
  const data = await gestBridge('trips');
  return Array.isArray(data) ? data : [];
}

async function getBookedSeats(viaggioId){
  const data = await gestBridge('booked-seats',{viaggioId});
  return Array.isArray(data) ? data.map(String) : [];
}

async function getBusLayout(viaggioId){
  return await gestBridge('bus-layout',{viaggioId});
}

async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti}){
  return await gestBridge('booking',{viaggioId,nome,cognome,telefono,email,note,posti:posti.map(String)});
}
