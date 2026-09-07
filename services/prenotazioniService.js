import { supabase } from '../js/supabase.js';

export async function createPublicBooking({ trattaId, nome, cognome, telefono, email = '', note = '', posti }) {
  const cleanSeats = [...new Set((posti || []).map(String).map(s => s.trim()).filter(Boolean))];
  if (!cleanSeats.length) throw new Error('Seleziona almeno un posto.');

  const { data, error } = await supabase.rpc('create_public_booking', {
    p_tratta_id: trattaId,
    p_nome: nome.trim(),
    p_cognome: cognome.trim(),
    p_telefono: telefono.trim(),
    p_email: email.trim(),
    p_note: note.trim(),
    p_posti: cleanSeats
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Prenotazione non completata.');
  return data;
}
