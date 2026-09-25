// DELGROSSO Viaggi — bridge pubblico SITO -> GESTIONALE
// Il browser non accede direttamente al database operativo.
const SITE_SUPABASE_URL = 'https://bhsanrbadsqcpbtxupmr.supabase.co';
const GESTIONALE_BRIDGE = `${SITE_SUPABASE_URL}/functions/v1/gestionale-bridge`;

const gestFmtDate = d => d ? new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')) : '';
const gestFmtTime = t => t ? String(t).slice(0,5) : '';
const gestEsc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function gestBridge(action, payload={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),18000);
  let res;
  try{
    res = await fetch(GESTIONALE_BRIDGE, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,...payload}),
      signal:controller.signal
    });
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Il collegamento al Gestionale sta impiegando troppo tempo. Riprova.');
    throw error;
  }finally{
    clearTimeout(timeout);
  }
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

// Disponibilità ufficiale ricevuta dal Gestionale.
function gestTripAvailability(trip={}){
  const numeric=value=>value===null||value===undefined||String(value).trim()===''?Number.NaN:Number(value);
  const total=numeric(trip.posti_totali), freeRaw=numeric(trip.posti_liberi), occupied=numeric(trip.posti_occupati);
  const state=String(trip.stato??'').trim().toLowerCase();
  const bridgeSold=trip.sold_out===true || trip.soldOut===true;
  const explicitSold=/sold\s*out|esaurit|complet|chius[oa]|full/.test(state);
  const soldByNumbers=(Number.isFinite(freeRaw)&&freeRaw<=0&&(Number.isFinite(total)?total>0:true))||(Number.isFinite(total)&&total>0&&Number.isFinite(occupied)&&occupied>=total);
  const free=Number.isFinite(freeRaw)?Math.max(0,freeRaw):Number.isFinite(total)&&Number.isFinite(occupied)?Math.max(0,total-occupied):0;
  return {soldOut:bridgeSold||explicitSold||soldByNumbers,known:Number.isFinite(freeRaw)||(Number.isFinite(total)&&Number.isFinite(occupied))||bridgeSold||explicitSold,total:Number.isFinite(total)?Math.max(0,total):0,occupied:Number.isFinite(occupied)?Math.max(0,occupied):0,free};
}
function gestTripIsSoldOut(trip){return gestTripAvailability(trip).soldOut;}

async function getBookedSeats(viaggioId){
  const data = await gestBridge('booked-seats',{viaggioId});
  return Array.isArray(data) ? data.map(String) : [];
}

async function getBusLayout(viaggioId){
  return await gestBridge('bus-layout',{viaggioId});
}

async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti}){
  return await gestBridge('booking',{viaggioId,nome,cognome,telefono,email:(email||null),note,posti:posti.map(String)});
}
