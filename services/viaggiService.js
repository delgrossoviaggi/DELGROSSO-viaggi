import { supabase } from '../js/supabase.js';

const FIELDS = `
  id,titolo,data_partenza,destinazione,luogo_partenza,ora_partenza,
  prezzo,posti_totali,posti_occupati,posti_liberi,pubblicato,stato,
  immagine,locandina,autobus,autobus_id,descrizione,created_at,updated_at
`;

function normalizeTrip(row) {
  if (!row) return null;
  return {
    ...row,
    immagine_url: row.locandina || row.immagine || null,
    modello_bus: row.autobus || 'GT',
    capacita: Number(row.posti_totali) || 63,
    postiLiberiDb: Number(row.posti_liberi ?? 0),
  };
}

export async function getPublicTrips() {
  const { data, error } = await supabase
    .from('viaggi')
    .select(FIELDS)
    .eq('pubblicato', 'SI')
    .order('data_partenza', { ascending: true })
    .order('ora_partenza', { ascending: true });

  if (error) throw new Error(`Errore caricamento viaggi: ${error.message}`);
  return (data || []).map(normalizeTrip);
}

export async function getTripById(id) {
  const { data, error } = await supabase
    .from('viaggi')
    .select(FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Errore caricamento viaggio: ${error.message}`);
  return normalizeTrip(data);
}

export async function getBookedSeats(viaggioId) {
  const { data, error } = await supabase
    .from('prenotazioni')
    .select('posti_selezionati,stato,viaggio_id')
    .eq('viaggio_id', viaggioId);

  if (error) throw new Error(`Errore disponibilità posti: ${error.message}`);

  const seats = [];
  for (const row of data || []) {
    const stato = String(row.stato || '').toLowerCase();
    if (['annullata', 'cancellata', 'cancelled'].includes(stato)) continue;
    const raw = row.posti_selezionati;
    if (Array.isArray(raw)) seats.push(...raw.map(String));
    else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) seats.push(...parsed.map(String));
        else seats.push(...raw.split(',').map(s => s.trim()).filter(Boolean));
      } catch {
        seats.push(...raw.split(',').map(s => s.trim()).filter(Boolean));
      }
    }
  }
  return [...new Set(seats)];
}
