import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://chkuayhbmitdmzmmvona.supabase.co";
const SUPABASE_KEY = "sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je";

let supabaseClient = null;

function getClient() {
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  return supabaseClient;
}

function result(success, data = null, error = null) {
  return { success, data, error };
}

function normalizeError(error, fallbackMessage) {
  if (!error) return new Error(fallbackMessage);
  if (error instanceof Error) return error;
  if (typeof error === "object" && error.message) return new Error(error.message);
  return new Error(String(error));
}

async function wrapQuery(executor, fallbackMessage) {
  try {
    const response = await executor();
    if (response.error) return result(false, null, normalizeError(response.error, fallbackMessage));
    return result(true, response.data ?? null, null);
  } catch (error) {
    return result(false, null, normalizeError(error, fallbackMessage));
  }
}

function parsePublishedValue(value) {
  if (
    value === true ||
    value === "true" ||
    value === "TRUE" ||
    value === "True" ||
    value === "SI" ||
    value === "si" ||
    value === "Si" ||
    value === 1 ||
    value === "1"
  ) {
    return true;
  }
  return false;
}

export function isViaggioPubblicato(value) {
  return parsePublishedValue(value);
}

export async function getViaggiPubblicati() {
  const query = await wrapQuery(
    () => getClient().from("viaggi").select("*").order("data_partenza", { ascending: true }),
    "Errore durante il caricamento dei viaggi."
  );
  if (!query.success) return query;
  const items = Array.isArray(query.data) ? query.data : [];
  return result(true, items.filter((item) => parsePublishedValue(item.pubblicato)), null);
}

export async function getViaggio(id) {
  if (!id) return result(false, null, new Error("ID viaggio non valido."));
  return wrapQuery(
    () => getClient().from("viaggi").select("*").eq("id", id).maybeSingle(),
    "Errore durante il caricamento del viaggio."
  );
}

export async function getPrenotazioniByViaggio(viaggioId) {
  if (!viaggioId) return result(false, null, new Error("ID viaggio non valido."));
  return wrapQuery(
    () => getClient().from("prenotazioni").select("*").eq("viaggio_id", viaggioId).order("created_at", { ascending: true }),
    "Errore durante il caricamento delle prenotazioni."
  );
}

export async function creaPrenotazione(payload) {
  if (!payload || typeof payload !== "object") {
    return result(false, null, new Error("Payload prenotazione non valido."));
  }
  return wrapQuery(
    () => getClient().from("prenotazioni").insert(payload).select("*").single(),
    "Errore durante la creazione della prenotazione."
  );
}

export async function aggiornaDisponibilita(viaggioId, postiDelta) {
  if (!viaggioId) return result(false, null, new Error("ID viaggio non valido."));
  const delta = Number(postiDelta);
  if (!Number.isInteger(delta) || delta === 0) {
    return result(false, null, new Error("Delta posti non valido."));
  }

  const current = await wrapQuery(
    () =>
      getClient()
        .from("viaggi")
        .select("id, posti_totali, posti_liberi, posti_occupati")
        .eq("id", viaggioId)
        .single(),
    "Errore durante la lettura disponibilita viaggio."
  );
  if (!current.success) return current;

  const row = current.data || {};
  const total = Math.max(Number(row.posti_totali) || 0, 0);
  const occupied = Math.max(Number(row.posti_occupati) || 0, 0);
  const free = Number.isFinite(Number(row.posti_liberi))
    ? Math.max(Number(row.posti_liberi), 0)
    : Math.max(total - occupied, 0);

  const nextFree = free - delta;
  if (nextFree < 0) {
    return result(false, null, new Error("Posti disponibili insufficienti."));
  }

  const nextOccupied = Math.min(Math.max(occupied + delta, 0), total);
  const payload = {
    posti_liberi: Math.max(total - nextOccupied, 0),
    posti_occupati: nextOccupied
  };

  return wrapQuery(
    () => getClient().from("viaggi").update(payload).eq("id", viaggioId).select("*").single(),
    "Errore durante l'aggiornamento disponibilita viaggio."
  );
}
