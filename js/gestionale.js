// DELGROSSO Viaggi — bridge sicuro verso il Supabase GESTIONALE
const GESTIONALE_BRIDGE_URL = 'https://bhsanrbadsqcpbtxupmr.supabase.co/functions/v1/gestionale-bridge';
async function gestBridge(action, payload = {}){
  const res = await fetch(GESTIONALE_BRIDGE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  let data=null; try{data=await res.json();}catch(_){ }
  if(!res.ok || (data && data.error)) throw new Error(data?.error || `Bridge error (${res.status})`);
  return data;
}
async function getGestionaleTrips(){ const data=await gestBridge('trips'); return Array.isArray(data)?data:[]; }
async function getBookedSeats(viaggioId){ const data=await gestBridge('booked-seats',{viaggioId}); return Array.isArray(data)?data.map(String):[]; }
async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti}){ return await gestBridge('booking',{viaggioId,nome,cognome,telefono,email:email||'',note:note||'',posti:posti.map(String)}); }
async function createGestionaleQuote({nome,cognome,telefono,email,servizio,passeggeri,destinazione,partenza,dataPartenza,note}){ return await gestBridge('quote',{nome,cognome,telefono,email,servizio,passeggeri,destinazione,partenza,dataPartenza,note:note||''}); }
