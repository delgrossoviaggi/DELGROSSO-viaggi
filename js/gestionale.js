
const G_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const G_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const H={apikey:G_KEY,Authorization:`Bearer ${G_KEY}`,'Content-Type':'application/json'};
const enc=v=>encodeURIComponent(v);
async function get(table,query='select=*'){const r=await fetch(`${G_URL}/rest/v1/${table}?${query}`,{headers:H,cache:'no-store'});if(!r.ok)throw new Error(`GESTIONALE ${table}: HTTP ${r.status}`);return r.json()}
async function post(table,body){const r=await fetch(`${G_URL}/rest/v1/${table}`,{method:'POST',headers:{...H,Prefer:'return=representation'},body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());return r.json()}
export async function getTrips(){const rows=await get('viaggi','select=*&pubblicato=eq.SI&order=data_partenza.asc');return rows.map(t=>({...t,codice:t.codice||t.codice_viaggio||`GDL-${String(t.id).slice(0,6)}`,posti_liberi:Number(t.posti_liberi??Math.max(Number(t.posti_totali||0)-Number(t.posti_occupati||0),0))}))}
export async function getTrip(id){const rows=await get('viaggi',`select=*&id=eq.${enc(id)}`);return rows[0]||null}
export async function getTripBookings(id){return get('prenotazioni',`select=*&viaggio_id=eq.${enc(id)}`)}
export async function createBooking(payload){return post('prenotazioni',payload)}
export async function createQuote(payload){return post('preventivi',payload)}
export {G_URL,G_KEY};
