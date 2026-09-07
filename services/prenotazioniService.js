import { supabase } from '../js/supabase.js';

export async function createPublicBooking({ viaggioId, nome, cognome, telefono, email = '', note = '', posti }) {
  const cleanSeats = [...new Set((posti || []).map(String).map(s => s.trim()).filter(Boolean))];
  if (!cleanSeats.length) throw new Error('Seleziona almeno un posto.');

  const { data, error } = await supabase.rpc('create_public_booking', {
    p_viaggio_id: viaggioId,
    p_nome: String(nome || '').trim(),
    p_cognome: String(cognome || '').trim(),
    p_telefono: String(telefono || '').trim(),
    p_email: String(email || '').trim(),
    p_note: String(note || '').trim(),
    p_posti: cleanSeats
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Prenotazione non completata.');
  return data;
}
