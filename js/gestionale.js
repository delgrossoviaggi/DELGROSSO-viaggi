// DELGROSSO Viaggi — collegamento operativo al Supabase GESTIONALE
// Le operazioni pubbliche usano esclusivamente SELECT pubblico e RPC già presenti nel Gestionale.
const GESTIONALE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const GESTIONALE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const gestSb = window.supabase.createClient(GESTIONALE_URL, GESTIONALE_KEY);

const gestFmtDate = d => d ? new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00')) : '';
const gestFmtTime = t => t ? String(t).slice(0,5) : '';
const gestEsc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function getGestionaleTrips(){
  const {data,error} = await gestSb.from('viaggi').select('*').eq('pubblicato','SI').order('data_partenza',{ascending:true}).order('ora_partenza',{ascending:true});
  if(error) throw error;
  return data || [];
}

async function getBookedSeats(viaggioId){
  const {data,error} = await gestSb.rpc('get_public_booked_seats',{p_viaggio_id:viaggioId});
  if(error) throw error;
  return Array.isArray(data) ? data.map(String) : [];
}

async function createGestionaleBooking({viaggioId,nome,cognome,telefono,email,note,posti}){
  const {data,error} = await gestSb.rpc('create_public_booking',{
    p_viaggio_id:viaggioId,
    p_nome:nome,
    p_cognome:cognome,
    p_telefono:telefono,
    p_email:email || '',
    p_note:note || '',
    p_posti:posti.map(String)
  });
  if(error) throw error;
  return data;
}
