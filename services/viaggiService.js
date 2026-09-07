import { supabase } from '../js/supabase.js';

export async function getPublicTrips() {
  const { data, error } = await supabase
    .from('tratte')
    .select('id,titolo,data_partenza,modello_bus,immagine_url,prezzo,created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTripById(id) {
  const { data, error } = await supabase
    .from('tratte')
    .select('id,titolo,data_partenza,modello_bus,immagine_url,prezzo,created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBookedSeats(trattaId) {
  const { data, error } = await supabase.rpc('get_public_trip_seats', { p_tratta_id: trattaId });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.map(String) : [];
}
