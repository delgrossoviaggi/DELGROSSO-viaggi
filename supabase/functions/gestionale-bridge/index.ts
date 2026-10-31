import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GESTIONALE_URL = "https://chkuayhbmitdmzmmvona.supabase.co";
const GESTIONALE_KEY = "sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je";
const corsHeaders = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json"
};

function response(body: unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:corsHeaders});
}

async function callGestionale(path:string,body?:unknown,timeoutMs=20000){
  const headers={
    apikey:GESTIONALE_KEY,
    Authorization:`Bearer ${GESTIONALE_KEY}`,
    "Content-Type":"application/json",
    "Accept":"application/json",
    "Prefer":"return=representation"
  };
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(`${GESTIONALE_URL}${path}`,{
      method:body===undefined?"GET":"POST",
      headers,
      body:body===undefined?undefined:JSON.stringify(body),
      signal:controller.signal
    });
    const text=await res.text();
    let data:unknown;
    try{data=text?JSON.parse(text):null}catch{data=text}
    if(!res.ok){
      const msg=typeof data==="object"&&data&&"message" in data
        ?String((data as any).message)
        :typeof data==="object"&&data&&"error" in data
          ?String((data as any).error)
          :`Gestionale request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }finally{
    clearTimeout(timer);
  }
}

async function callGestionaleWithRetry(path:string,body:unknown){
  let lastError:unknown=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{return await callGestionale(path,body,20000)}catch(error){
      lastError=error;
      if(attempt<2)await new Promise(r=>setTimeout(r,350));
    }
  }
  throw lastError instanceof Error?lastError:new Error("Collegamento al Gestionale non riuscito.");
}

function normalizeBookedSeats(data:unknown):string[]{
  if(!Array.isArray(data))return [];
  return [...new Set(data.map((x:any)=>{
    if(x===null||x===undefined)return "";
    if(typeof x==="object")return String(x.seat??x.posto??x.numero??x.id??"").trim();
    return String(x).trim();
  }).filter(Boolean))];
}
function explicitSoldOut(trip:any){
  const state=String(trip?.stato??"").trim().toLowerCase();
  return /sold\s*out|esaurit|complet|chius[oa]|full/.test(state);
}
function normalizeDestination(v:any){
  return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\([^)]*\)/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
async function enrichTrip(trip:any){
  const total=Math.max(0,Number(trip?.posti_totali)||0);
  try{
    const booked=normalizeBookedSeats(await callGestionale(`/rest/v1/rpc/get_public_booked_seats`,{p_viaggio_id:String(trip.id)},15000));
    const occupied=booked.length;
    const free=Math.max(0,total-occupied);
    return {...trip,posti_totali:total,posti_occupati:occupied,posti_liberi:free,sold_out:explicitSoldOut(trip)||free<=0};
  }catch{
    const occupied=Math.max(0,Number(trip?.posti_occupati)||0);
    const rawFree=Number(trip?.posti_liberi);
    const free=Number.isFinite(rawFree)?Math.max(0,rawFree):Math.max(0,total-occupied);
    return {...trip,posti_totali:total,posti_occupati:occupied,posti_liberi:free,sold_out:explicitSoldOut(trip)||free<=0};
  }
}
function fillPosterFallback(trips:any[]){
  const posterByDestination=new Map<string,string>();
  for(const trip of trips){
    const key=normalizeDestination(trip?.destinazione);
    const poster=String(trip?.locandina||"").trim();
    if(key&&poster&&!posterByDestination.has(key))posterByDestination.set(key,poster);
  }
  return trips.map(trip=>{
    if(String(trip?.locandina||"").trim())return trip;
    const key=normalizeDestination(trip?.destinazione);
    const poster=key?posterByDestination.get(key):"";
    return poster?{...trip,locandina:poster,locandina_fallback:true}:trip;
  });
}

function stripBisTitle(value:any){
  return String(value??"").replace(/\s+[—-]\s+BIS\s*·?\s*BUS\s*\d+\s*$/i,"").trim();
}
function pickActiveRun(runs:any[]){
  const available=runs.filter(x=>!x?.sold_out && Number(x?.posti_liberi||0)>0);
  const pool=(available.length?available:runs).slice();
  pool.sort((a,b)=>{
    const na=Number(a?.bis_numero||1),nb=Number(b?.bis_numero||1);
    if(na!==nb)return nb-na;
    return Number(b?.posti_liberi||0)-Number(a?.posti_liberi||0);
  });
  return pool[0]||null;
}
function groupCommercialTrips(trips:any[]){
  const groups=new Map<string,any[]>();
  for(const trip of trips){
    const key=String(trip?.bis_parent_id||trip?.id||"");
    if(!key)continue;
    const list=groups.get(key)||[];
    list.push(trip);groups.set(key,list);
  }
  const out:any[]=[];
  for(const [rootId,runs] of groups.entries()){
    const active=pickActiveRun(runs);
    if(!active)continue;
    const maxBus=Math.max(...runs.map(x=>Number(x?.bis_numero||1)),Number(active?.bis_numero||1));
    const groupFree=runs.reduce((n,x)=>n+Math.max(0,Number(x?.posti_liberi||0)),0);
    const groupCapacity=runs.reduce((n,x)=>n+Math.max(0,Number(x?.posti_totali||0)),0);
    const groupOccupied=runs.reduce((n,x)=>n+Math.max(0,Number(x?.posti_occupati||0)),0);
    const activeNum=Number(active?.bis_numero||1);
    const anyAvailable=runs.some(x=>!x?.sold_out&&Number(x?.posti_liberi||0)>0);
    out.push({
      ...active,
      id:rootId,
      active_viaggio_id:String(active.id),
      commercial_root_id:rootId,
      bis_attivo:activeNum>1||maxBus>1,
      bis_numero_attivo:activeNum,
      bus_count:maxBus,
      posti_liberi_gruppo:groupFree,
      posti_totali_gruppo:groupCapacity,
      posti_occupati_gruppo:groupOccupied,
      titolo:stripBisTitle(active.titolo)||active.destinazione,
      stato:(activeNum>1&&anyAvailable)?"2° BUS APERTO":active.stato,
      sold_out:!anyAvailable
    });
  }
  return out.sort((a,b)=>String(a.data_partenza||"").localeCompare(String(b.data_partenza||""))||String(a.ora_partenza||"").localeCompare(String(b.ora_partenza||"")));
}
async function resolveActiveTripId(requestedId:string){
  const id=String(requestedId||"").trim();
  if(!id)return id;
  const q=new URLSearchParams({
    select:"id,bis_parent_id,bis_numero,posti_totali,posti_occupati,posti_liberi,stato,pubblicato",
    or:`(id.eq.${id},bis_parent_id.eq.${id})`,
    pubblicato:"eq.SI",
    order:"bis_numero.desc"
  });
  const rows=await callGestionale(`/rest/v1/viaggi?${q.toString()}`);
  if(!Array.isArray(rows)||!rows.length)return id;
  const enriched=await Promise.all(rows.map(enrichTrip));
  const active=pickActiveRun(enriched);
  return String(active?.id||id);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method==="GET"){
    const url=new URL(req.url);
    if(url.searchParams.get("health")==="1"){
      try{
        const rows=await callGestionale("/rest/v1/viaggi?select=id&limit=1",undefined,10000);
        return response({ok:true,bridge:"online",gestionale:"reachable",trip_read:Array.isArray(rows)});
      }catch(error){
        return response({ok:false,bridge:"online",gestionale:"unreachable",error:error instanceof Error?error.message:"Errore collegamento"},502);
      }
    }
    return response({ok:true,bridge:"online",message:"gestionale-bridge v9 BIS attivo. Usa POST per le operazioni."});
  }
  if(req.method!=="POST")return response({error:"Metodo non consentito"},405);
  try{
    const payload=await req.json();
    const action=String(payload?.action||"");

    if(action==="trips"){
      const params=new URLSearchParams({select:"*",pubblicato:"eq.SI",order:"data_partenza.asc,ora_partenza.asc,bis_numero.asc"});
      const trips=await callGestionale(`/rest/v1/viaggi?${params.toString()}`);
      if(!Array.isArray(trips))return response([]);
      const enriched=await Promise.all(trips.map(enrichTrip));
      return response(fillPosterFallback(groupCommercialTrips(enriched)));
    }

    if(action==="bus-layout"){
      const requestedId=String(payload?.viaggioId||"");
      if(!requestedId)return response({error:"viaggioId obbligatorio"},400);
      const viaggioId=await resolveActiveTripId(requestedId);
      const trips=await callGestionale(`/rest/v1/viaggi?id=eq.${encodeURIComponent(viaggioId)}&select=id,autobus_id,posti_totali`);
      const trip=Array.isArray(trips)?trips[0]:null;
      if(!trip)return response({error:"Viaggio non trovato"},404);
      const busId=String(trip.autobus_id||"");
      if(!busId)return response({posti_totali:trip.posti_totali||0,seat_layout:null,bus:null});
      const buses=await callGestionale(`/rest/v1/flotta?id=eq.${encodeURIComponent(busId)}&select=id,marca,modello,targa,seat_layout,posti`);
      const bus=Array.isArray(buses)?buses[0]:null;
      return response({posti_totali:trip.posti_totali||bus?.posti||0,seat_layout:bus?.seat_layout||null,bus:bus||null});
    }

    if(action==="booked-seats"){
      const requestedId=String(payload?.viaggioId||"");
      if(!requestedId)return response({error:"viaggioId obbligatorio"},400);
      const viaggioId=await resolveActiveTripId(requestedId);
      return response(normalizeBookedSeats(await callGestionale(`/rest/v1/rpc/get_public_booked_seats`,{p_viaggio_id:viaggioId})));
    }

    if(action==="trip-stops"){
      const requestedId=String(payload?.viaggioId||"");
      if(!requestedId)return response({error:"viaggioId obbligatorio"},400);
      const viaggioId=await resolveActiveTripId(requestedId);
      const rows=await callGestionale(`/rest/v1/rpc/get_public_trip_stops`,{p_viaggio_id:viaggioId});
      return response(Array.isArray(rows)?rows:[]);
    }

    if(action==="archive-booking"){
      // Public bookings use a per-booking token; do not accept arbitrary customer details.
      const {bookingId,token,pdfBase64}=payload||{};
      if(!bookingId||!token||!pdfBase64)return response({error:"Prenotazione, token e PDF sono obbligatori."},400);
      const archived=await callGestionaleWithRetry(`/functions/v1/send-booking-confirmation`,{
        action:"issue",
        bookingId:String(bookingId),
        token:String(token),
        pdfBase64:String(pdfBase64)
      });
      return response(archived);
    }
    if(action==="booking-pdf-url"){
      const {bookingId,token}=payload||{};
      if(!bookingId||!token)return response({error:"Prenotazione e token sono obbligatori."},400);
      const link=await callGestionale(`/functions/v1/send-booking-confirmation`,{
        action:"signed_url",
        bookingId:String(bookingId),
        token:String(token)
      });
      return response(link);
    }

    if(action==="booking"){
      const {viaggioId,nome,cognome,telefono,email,note,posti,requestId,fermataPartenza}=payload||{};
      if(!viaggioId||!nome||!cognome||!telefono||!fermataPartenza||!Array.isArray(posti)||posti.length===0)return response({error:"Dati prenotazione incompleti: indica anche telefono e località di partenza."},400);
      const activeViaggioId=await resolveActiveTripId(String(viaggioId));
      const stableRequestId=String(requestId||crypto.randomUUID());
      const result=await callGestionaleWithRetry(
        `/rest/v1/rpc/create_public_booking_v3`,
        {
          p_viaggio_id:activeViaggioId,
          p_nome:String(nome),
          p_cognome:String(cognome),
          p_telefono:String(telefono||""),
          p_email:String(email||""),
          p_note:String(note||""),
          p_posti:posti.map(String),
          p_request_id:stableRequestId,
          p_fermata_partenza:String(fermataPartenza||"")
        }
      );
      if(!result||result.success!==true){
        return response({error:result?.error||"Prenotazione non registrata."},409);
      }
      return response(result);
    }

    if(action==="quote"){
      const {nome,cognome,telefono,email,servizio,passeggeri,destinazione,partenza,dataPartenza,note}=payload||{};
      if(!nome||!cognome||!telefono||!email||!servizio||!passeggeri||!destinazione||!partenza||!dataPartenza)return response({error:"Dati preventivo incompleti"},400);
      return response(await callGestionale(`/rest/v1/rpc/create_public_quote`,{
        p_nome:String(nome),p_cognome:String(cognome),p_telefono:String(telefono),p_email:String(email),
        p_servizio:String(servizio),p_passeggeri:Number(passeggeri),p_destinazione:String(destinazione),
        p_partenza:String(partenza),p_data_partenza:String(dataPartenza),p_note:String(note||"")
      }));
    }

    return response({error:"Azione non supportata"},400);
  }catch(error){
    console.error("gestionale-bridge error",error);
    const message=error instanceof Error?error.message:"Errore interno";
    return response({error:message},502);
  }
});