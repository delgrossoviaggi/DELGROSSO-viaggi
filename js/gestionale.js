// DELGROSSO Viaggi — bridge pubblico SITO -> GESTIONALE
// Il browser non accede direttamente al database operativo.
const SITE_SUPABASE_URL = 'https://bhsanrbadsqcpbtxupmr.supabase.co';
const GESTIONALE_BRIDGE = `${SITE_SUPABASE_URL}/functions/v1/gestionale-bridge`;

const gestFmtDate = d => d ? new Intl.DateTimeFormat(document.documentElement.lang==='en'?'en-GB':'it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')) : '';
const gestFmtTime = t => t ? String(t).slice(0,5) : '';
const gestEsc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function gestBridge(action, payload={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),action==='archive-booking'?55000:action==='trips'?6500:18000);
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

const DG_EMERGENCY_CATALOG = '/assets/viaggi-fallback-20261117.json';
function dgEmergencyBanner(show){
  if(typeof document==='undefined')return;
  const old=document.getElementById('dg-emergency-banner');
  if(!show){old?.remove();return}
  if(old)return;
  const host=document.querySelector('main')||document.body;
  const panel=document.createElement('div');
  panel.id='dg-emergency-banner';
  panel.setAttribute('role','status');
  panel.style.cssText='margin:18px auto;max-width:1160px;padding:15px 18px;border:2px solid #e8aa53;background:#fff7e8;color:#513b1e;border-radius:12px;line-height:1.6;font-size:14px';
  panel.innerHTML='<strong>⚠ Aggiornamento temporaneo delle partenze</strong><div>Il collegamento live con il Gestionale è momentaneamente indisponibile. Le date e i prezzi sono quelli dell’ultimo elenco verificato il 17 novembre; posti disponibili e prenotazioni online non sono confermati. <a href="https://wa.me/393208815899" target="_blank" rel="noopener" style="font-weight:800;color:#664000;text-decoration:underline">Chiedi disponibilità su WhatsApp 320 881 5899</a>.</div>';
  host.prepend(panel);
}
// Non cancellare mai viaggi storici nel DB. Questa regola controlla soltanto il catalogo pubblico.
function dgTodayRome(now=new Date()){
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function dgPublicTripIsCurrent(trip,today=dgTodayRome()){
  if(!trip || !/^\\d{4}-\\d{2}-\\d{2}$/.test(String(trip.data_partenza||'')))return false;
  if(String(trip.data_partenza)<today)return false;
  if(trip.archiviato_at || trip.online_hidden_at || trip.bis_auto_hidden)return false;
  if(trip.pubblicato!=null&&!['SI','TRUE','1','SÌ'].includes(String(trip.pubblicato).toUpperCase()))return false;
  if(/annullat|rinviat/i.test(String(trip.stato||'')))return false;
  return true;
}
async function getGestionaleTrips(){
  try{
    const data=await gestBridge('trips');
    if(!Array.isArray(data))throw new Error('Catalogo live non valido.');
    window.__dgOfflineCatalog=false;
    dgEmergencyBanner(false);
    return data.filter(t=>dgPublicTripIsCurrent(t));
  }catch(error){
    const res=await fetch(DG_EMERGENCY_CATALOG,{cache:'no-store'});
    if(!res.ok)throw error;
    const copy=await res.json();
    if(!copy||copy.source!=='supabase-gestionale-public-trips-readonly'||!Array.isArray(copy.trips)||copy.trips.length<1)throw error;
    const now=dgTodayRome();
    window.__dgOfflineCatalog=true;
    dgEmergencyBanner(true);
    return copy.trips.filter(t=>dgPublicTripIsCurrent(t,now)).map(t=>({...t,offline_catalog:true}));
  }
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
  return {soldOut:bridgeSold||explicitSold||soldByNumbers,known:trip.offline_catalog===true?false:(Number.isFinite(freeRaw)||(Number.isFinite(total)&&Number.isFinite(occupied))||bridgeSold||explicitSold),total:Number.isFinite(total)?Math.max(0,total):0,occupied:Number.isFinite(occupied)?Math.max(0,occupied):0,free};
}
function gestTripIsSoldOut(trip){return gestTripAvailability(trip).soldOut;}

async function getBookedSeats(viaggioId){
  const data = await gestBridge('booked-seats',{viaggioId});
  return Array.isArray(data) ? data.map(String) : [];
}

async function getBusLayout(viaggioId){
  // La piantina ufficiale usa il medesimo snapshot Supabase visto dagli operatori.
  // Pubblica soltanto la geometria, mai nomi clienti o dati di prenotazione.
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('https://chkuayhbmitdmzmmvona.supabase.co/rest/v1/rpc/dg28_public_trip_layout_v1',{
        method:'POST',
        headers:{apikey:'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je','Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({p_viaggio_id:String(viaggioId)}),
        cache:'no-store',signal:controller.signal
      });
      if(response.ok){
        const official=await response.json();
        if(official && Array.isArray(official.layout) && official.layout.length){
          return official;
        }
      }
    }finally{clearTimeout(timeout)}
  }catch(error){console.warn('Piantina ufficiale non disponibile; uso layout di riserva.',error)}
  return await gestBridge('bus-layout',{viaggioId});
}

async function getTripStops(viaggioId){
  const data=await gestBridge('trip-stops',{viaggioId});
  return Array.isArray(data)?data:[];
}

async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti,requestId,fermataPartenza}){
  // Lo stesso requestId viene riutilizzato nei retry: il backend e' idempotente e non crea doppioni.
  const stableRequestId=requestId||((globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():`web-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const payload={viaggioId,nome,cognome,telefono,email:(email||null),note,posti:posti.map(String),requestId:stableRequestId,fermataPartenza:String(fermataPartenza||'')};
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{return await gestBridge('booking',payload)}catch(error){
      lastError=error;
      const msg=String(error?.message||'');
      const uncertain=error?.name==='TypeError'||/fetch|network|rete|tempo|collegamento/i.test(msg);
      if(!uncertain||attempt===2)throw error;
      await new Promise(r=>setTimeout(r,650));
    }
  }
  throw lastError||new Error('Prenotazione non completata.');
}

async function checkGestionaleBridge(){
  try{const r=await fetch(`${GESTIONALE_BRIDGE}?health=1`,{cache:'no-store'});return r.ok?await r.json():{ok:false,status:r.status}}catch(error){return {ok:false,error:String(error?.message||error)}}
}
