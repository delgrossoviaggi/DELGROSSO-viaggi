import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOptionalEnv } from '../utils/configManager.js';

const TABLES = {
  viaggi: [
    'id',
    'titolo',
    'destinazione',
    'data_partenza',
    'ora_partenza',
    'luogo_partenza',
    'prezzo',
    'descrizione',
    'locandina',
    'autobus_id',
    'autobus',
    'posti_totali',
    'posti_liberi',
    'posti_occupati',
    'stato',
    'pubblicato',
    'created_at',
    'updated_at'
  ],
  prenotazioni: [
    'id',
    'viaggio_id',
    'cliente',
    'telefono',
    'email',
    'posti',
    'totale',
    'stato',
    'checkin_effettuato',
    'checkin_stato',
    'checkin_fermata',
    'checked_in_at',
    'ultimo_accesso_at',
    'checkin_operatore',
    'checkin_note',
    'note',
    'posti_selezionati',
    'created_at',
    'updated_at'
  ],
  clienti: [
    'id',
    'nome',
    'cognome',
    'telefono',
    'email',
    'codice_fiscale',
    'indirizzo',
    'citta',
    'cap',
    'provincia',
    'note',
    'created_at',
    'updated_at'
  ],
  flotta: [
    'id',
    'targa',
    'marca',
    'modello',
    'categoria',
    'anno',
    'posti',
    'seat_layout',
    'stato',
    'immagine',
    'descrizione',
    'attivo',
    'created_at',
    'updated_at'
  ],
  pagamenti: [
    'id',
    'cliente_id',
    'viaggio_id',
    'prenotazione_id',
    'cliente',
    'viaggio',
    'persone',
    'ricevuta',
    'importo',
    'totale',
    'acconto',
    'saldo',
    'pagato',
    'tipo',
    'stato',
    'metodo',
    'metodo_pagamento',
    'data_pagamento',
    'scadenza',
    'note',
    'created_at',
    'updated_at'
  ],
  preventivi: [
    'id',
    'numero_preventivo',
    'codice',
    'nome',
    'cognome',
    'telefono',
    'email',
    'azienda',
    'origine',
    'stato',
    'servizio',
    'servizio_richiesto',
    'destinazione',
    'luogo_partenza',
    'partenza',
    'data_viaggio',
    'data_partenza',
    'data_ritorno',
    'numero_passeggeri',
    'passeggeri',
    'messaggio',
    'importo',
    'importo_preventivo',
    'validita_preventivo',
    'note_cliente',
    'note_interne',
    'dettagli_offerta',
    'operatore',
    'convertito_prenotazione',
    'prenotazione_id',
    'viaggio_id',
    'convertito_prenotazione_id',
    'convertito_viaggio_id',
    'data_creazione',
    'data_modifica',
    'created_at',
    'updated_at'
  ],
  accessi_checkin: [
    'id',
    'prenotazione_id',
    'prenotazione_codice',
    'viaggio_id',
    'cliente',
    'telefono',
    'email',
    'posto',
    'esito',
    'operatore',
    'gate',
    'note',
    'qr_payload',
    'created_at',
    'updated_at'
  ],
  impostazioni: []
};

const READ_SELECT_OVERRIDES = {
  flotta: '*',
  prenotazioni: '*',
  clienti: '*'
};

let supabaseClient = null;
const FALLBACK_SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';

function normalizeError(error) {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && error.message) {
    const normalized = new Error(error.message);
    Object.assign(normalized, error);
    return normalized;
  }
  return new Error(String(error || 'Operazione non riuscita.'));
}

function success(data) {
  return { success: true, data, error: null };
}

function failure(error) {
  return { success: false, data: [], error: normalizeError(error) };
}

function isMissingSeatLayoutColumnError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('seat_layout') && (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find')
  );
}

function extractMissingColumnName(error, table) {
  const message = String(error?.message || error || '');
  if (!message || !table) return '';

  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`Could not find the '([^']+)' column of '${escapedTable}'`, 'i'),
    new RegExp(`column "([^"]+)" of relation "${escapedTable}" does not exist`, 'i'),
    new RegExp(`column ([\\w_]+) of relation ${escapedTable} does not exist`, 'i')
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function hasId(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
}

function getColumns(table) {
  return TABLES[table] || [];
}

function getSelectClause(table) {
  const columns = getColumns(table);
  return columns.length > 0 ? columns.join(', ') : '*';
}

function getReadSelectClause(table) {
  return READ_SELECT_OVERRIDES[table] || getSelectClause(table);
}

function normalizeBookingPayload(payload = {}) {
  const source = { ...(payload || {}) };
  return {
    ...source,
    cliente: source.cliente || source.cliente_nome || source.nome_cliente || '',
    telefono: source.telefono || source.cliente_telefono || source.telefono_cliente || '',
    email: source.email || source.cliente_email || source.email_cliente || '',
    totale: source.totale ?? source.importo ?? 0
  };
}

function normalizeClientPayload(payload = {}) {
  const source = { ...(payload || {}) };
  if (!source.citta && source.comune) source.citta = source.comune;
  return source;
}

function normalizeBookingRow(row = {}) {
  const totale = Number(row.importo ?? row.totale ?? 0) || 0;
  const pagato = Number(row.pagato ?? row.acconto ?? 0) || 0;
  return {
    ...row,
    codice: row.codice || row.id || '',
    cliente_nome: row.cliente_nome || row.nome_cliente || row.cliente || '',
    cliente_telefono: row.cliente_telefono || row.telefono_cliente || row.telefono || '',
    cliente_email: row.cliente_email || row.email_cliente || row.email || '',
    viaggio_codice: row.viaggio_codice || row.viaggio || row.viaggio_id || '',
    data: row.data || row.data_prenotazione || String(row.created_at || '').slice(0, 10),
    importo: totale,
    totale,
    acconto: Number(row.acconto ?? pagato) || 0,
    pagato,
    saldo: Number(row.saldo ?? Math.max(totale - pagato, 0)) || 0
  };
}

function normalizeClientRow(row = {}) {
  return {
    ...row,
    comune: row.comune || row.citta || '',
    stato_cliente: row.stato_cliente || 'Attivo'
  };
}

function pickPayload(table, payload = {}, { includeId = false } = {}) {
  let source = { ...(payload || {}) };
  if (table === 'prenotazioni') source = normalizeBookingPayload(source);
  if (table === 'clienti') source = normalizeClientPayload(source);
  const columns = getColumns(table);

  if (!columns.length) {
    const next = {};
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) next[key] = value;
    }
    if (!includeId) delete next.id;
    return next;
  }

  const next = {};
  for (const [key, value] of Object.entries(source)) {
    if (!columns.includes(key)) continue;
    if (!includeId && key === 'id') continue;
    if (value === undefined) continue;
    next[key] = value;
  }
  return next;
}

function withTimestamps(table, payload, { isCreate = false } = {}) {
  const next = { ...(payload || {}) };
  const now = new Date().toISOString();
  const columns = getColumns(table);
  if (columns.includes('updated_at')) next.updated_at = now;
  if (isCreate && columns.includes('created_at') && !next.created_at) next.created_at = now;
  return next;
}

function applyOrder(query, table) {
  if (table === 'viaggi') return query.order('data_partenza', { ascending: true });
  if (table === 'prenotazioni') return query.order('created_at', { ascending: false });
  if (table === 'clienti') return query.order('created_at', { ascending: false });
  if (table === 'flotta') {
    return query
      .order('marca', { ascending: true })
      .order('modello', { ascending: true })
      .order('targa', { ascending: true });
  }
  if (table === 'preventivi') return query.order('created_at', { ascending: false });
  if (table === 'accessi_checkin') return query.order('created_at', { ascending: false });
  if (table === 'impostazioni') return query.order('created_at', { ascending: false });
  return query;
}

function applyFilters(query, filters = []) {
  return (filters || []).reduce((current, filter) => {
    if (!filter || !filter.column || !filter.operator) return current;
    if (filter.operator === 'eq') return current.eq(filter.column, filter.value);
    if (filter.operator === 'neq') return current.neq(filter.column, filter.value);
    if (filter.operator === 'gt') return current.gt(filter.column, filter.value);
    if (filter.operator === 'gte') return current.gte(filter.column, filter.value);
    if (filter.operator === 'lt') return current.lt(filter.column, filter.value);
    if (filter.operator === 'lte') return current.lte(filter.column, filter.value);
    if (filter.operator === 'in' && Array.isArray(filter.value)) return current.in(filter.column, filter.value);
    return current;
  }, query);
}

function applyOrders(query, orderBy = []) {
  return (orderBy || []).reduce((current, item) => {
    if (!item || !item.column) return current;
    return current.order(item.column, { ascending: item.ascending !== false });
  }, query);
}

async function listRows(table, mutator) {
  try {
    let query = getSupabase().from(table).select(getReadSelectClause(table));
    query = applyOrder(query, table);
    if (typeof mutator === 'function') {
      query = mutator(query) || query;
    }
    const { data, error } = await query;
    if (error) return failure(error);
    return success(Array.isArray(data) ? data : []);
  } catch (error) {
    return failure(error);
  }
}

async function getRow(table, id) {
  if (!hasId(id)) return failure(new Error('Identificativo non valido.'));
  try {
    const { data, error } = await getSupabase()
      .from(table)
      .select(getReadSelectClause(table))
      .eq('id', id)
      .maybeSingle();
    if (error) return failure(error);
    return success(data || null);
  } catch (error) {
    return failure(error);
  }
}

async function createRow(table, payload) {
  try {
    const sanitized = pickPayload(table, withTimestamps(table, payload, { isCreate: true }), { includeId: false });

    if (table === 'impostazioni') {
      const retryPayload = { ...sanitized };
      for (let attempt = 0; attempt < 64; attempt += 1) {
        const { data, error } = await getSupabase()
          .from(table)
          .insert(retryPayload)
          .select(getReadSelectClause(table))
          .single();
        if (!error) return success(data);

        const missingColumn = extractMissingColumnName(error, table);
        if (!missingColumn || !(missingColumn in retryPayload)) return failure(error);
        delete retryPayload[missingColumn];
      }
      return failure(new Error('Schema impostazioni incompatibile: impossibile inserire il record.'));
    }

    const { data, error } = await getSupabase()
      .from(table)
      .insert(sanitized)
      .select(getReadSelectClause(table))
      .single();
    if (error) {
      if (table === 'flotta' && isMissingSeatLayoutColumnError(error)) {
        const fallback = { ...sanitized };
        delete fallback.seat_layout;
        const retry = await getSupabase()
          .from(table)
          .insert(fallback)
          .select(getReadSelectClause(table))
          .single();
        if (retry.error) return failure(retry.error);
        return success(retry.data);
      }
      return failure(error);
    }
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

async function updateRow(table, id, payload) {
  if (!hasId(id)) return failure(new Error('Identificativo non valido.'));
  try {
    const sanitized = pickPayload(table, withTimestamps(table, payload), { includeId: false });

    if (table === 'impostazioni') {
      const retryPayload = { ...sanitized };
      for (let attempt = 0; attempt < 64; attempt += 1) {
        const { data, error } = await getSupabase()
          .from(table)
          .update(retryPayload)
          .eq('id', id)
          .select(getReadSelectClause(table))
          .single();
        if (!error) return success(data);

        const missingColumn = extractMissingColumnName(error, table);
        if (!missingColumn || !(missingColumn in retryPayload)) return failure(error);
        delete retryPayload[missingColumn];
      }
      return failure(new Error('Schema impostazioni incompatibile: impossibile aggiornare il record.'));
    }

    const { data, error } = await getSupabase()
      .from(table)
      .update(sanitized)
      .eq('id', id)
      .select(getReadSelectClause(table))
      .single();
    if (error) {
      if (table === 'flotta' && isMissingSeatLayoutColumnError(error)) {
        const fallback = { ...sanitized };
        delete fallback.seat_layout;
        const retry = await getSupabase()
          .from(table)
          .update(fallback)
          .eq('id', id)
          .select(getReadSelectClause(table))
          .single();
        if (retry.error) return failure(retry.error);
        return success(retry.data);
      }
      return failure(error);
    }
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

async function deleteRow(table, id) {
  if (!hasId(id)) return failure(new Error('Identificativo non valido.'));
  try {
    const { error } = await getSupabase()
      .from(table)
      .delete()
      .eq('id', id);
    if (error) return failure(error);
    return success(true);
  } catch (error) {
    return failure(error);
  }
}

export async function listTableRows(table, options = {}) {
  try {
    let query = getSupabase().from(table).select(options.select || getReadSelectClause(table));
    query = applyFilters(query, options.filters);
    query = options.orderBy ? applyOrders(query, options.orderBy) : applyOrder(query, table);
    const { data, error } = await query;
    if (error) return failure(error);
    return success(Array.isArray(data) ? data : []);
  } catch (error) {
    return failure(error);
  }
}

export async function getTableRow(table, id, options = {}) {
  if (!hasId(id)) return failure(new Error('Identificativo non valido.'));
  const filters = [...(options.filters || []), { column: options.idColumn || 'id', operator: 'eq', value: id }];
  try {
    let query = getSupabase().from(table).select(options.select || getReadSelectClause(table));
    query = applyFilters(query, filters);
    const { data, error } = await query.maybeSingle();
    if (error) return failure(error);
    return success(data || null);
  } catch (error) {
    return failure(error);
  }
}

export async function createTableRow(table, payload, options = {}) {
  try {
    const sanitized = pickPayload(table, withTimestamps(table, payload, { isCreate: true }), { includeId: false });
    const { data, error } = await getSupabase()
      .from(table)
      .insert(sanitized)
      .select(options.select || getReadSelectClause(table))
      .single();
    if (error) return failure(error);
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function updateTableRows(table, payload, options = {}) {
  try {
    const sanitized = pickPayload(table, withTimestamps(table, payload), { includeId: false });
    let query = getSupabase()
      .from(table)
      .update(sanitized)
      .select(options.select || getReadSelectClause(table));
    query = applyFilters(query, options.filters);
    if (options.single) {
      const { data, error } = await query.single();
      if (error) return failure(error);
      return success(data);
    }
    const { data, error } = await query;
    if (error) return failure(error);
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTableRows(table, options = {}) {
  try {
    let query = getSupabase().from(table).delete();
    query = applyFilters(query, options.filters);
    const { error } = await query;
    if (error) return failure(error);
    return success(true);
  } catch (error) {
    return failure(error);
  }
}

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = getOptionalEnv('VITE_SUPABASE_URL', FALLBACK_SUPABASE_URL);
  const key = getOptionalEnv('VITE_SUPABASE_ANON_KEY', FALLBACK_SUPABASE_ANON_KEY);

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}

export function subscribeTable(table, callback) {
  try {
    const client = getSupabase();
    const channel = client
      .channel(`delgrosso-${table}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (typeof callback === 'function') callback();
      })
      .subscribe();

    return () => {
      if (typeof client.removeChannel === 'function') {
        client.removeChannel(channel);
      } else if (typeof channel?.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    };
  } catch (_error) {
    return () => {};
  }
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

export function formatPosti(value) {
  return `${Math.max(Number(value) || 0, 0)} posti`;
}

export function calculateAvailableSeats(viaggio = {}) {
  const total = Math.max(Number(viaggio.posti_totali) || 0, 0);
  const occupied = Math.max(Number(viaggio.posti_occupati) || 0, 0);
  return Math.max(total - occupied, 0);
}

export async function getViaggi() {
  return listRows('viaggi');
}

export async function getViaggiPubblicati() {
  return listRows('viaggi', (query) => query.eq('pubblicato', 'SI'));
}

export async function getViaggio(id) {
  return getRow('viaggi', id);
}

export async function createViaggio(payload) {
  return createRow('viaggi', payload);
}

export async function updateViaggio(id, payload) {
  return updateRow('viaggi', id, payload);
}

export async function deleteViaggio(id) {
  return deleteRow('viaggi', id);
}

export async function getPrenotazioni() {
  const response = await listRows('prenotazioni');
  if (response.success === false) return response;
  return success((response.data || []).map(normalizeBookingRow));
}

export async function getPrenotazione(id) {
  const response = await getRow('prenotazioni', id);
  if (response.success === false) return response;
  return success(response.data ? normalizeBookingRow(response.data) : null);
}

export async function createPrenotazione(payload) {
  return createRow('prenotazioni', payload);
}

export async function updatePrenotazione(id, payload) {
  return updateRow('prenotazioni', id, payload);
}

export async function deletePrenotazione(id) {
  return deleteRow('prenotazioni', id);
}

export async function getClienti() {
  const response = await listRows('clienti');
  if (response.success === false) return response;
  return success((response.data || []).map(normalizeClientRow));
}

export async function getCliente(id) {
  const response = await getRow('clienti', id);
  if (response.success === false) return response;
  return success(response.data ? normalizeClientRow(response.data) : null);
}

export async function createCliente(payload) {
  return createRow('clienti', payload);
}

export async function updateCliente(id, payload) {
  return updateRow('clienti', id, payload);
}

export async function deleteCliente(id) {
  return deleteRow('clienti', id);
}

export async function getFlotta() {
  return listRows('flotta');
}

export async function getAutobus(id) {
  return getRow('flotta', id);
}

export async function createAutobus(payload) {
  return createRow('flotta', payload);
}

export async function updateAutobus(id, payload) {
  return updateRow('flotta', id, payload);
}

export async function deleteAutobus(id) {
  return deleteRow('flotta', id);
}

export async function getImpostazioni() {
  try {
    const { data, error } = await getSupabase()
      .from('impostazioni')
      .select(getSelectClause('impostazioni'))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return failure(error);
    return success(data || null);
  } catch (error) {
    return failure(error);
  }
}

export async function saveImpostazioni(payload) {
  try {
    const current = await getImpostazioni();
    if (current.success === false) return current;
    if (current.data?.id) {
      return updateRow('impostazioni', current.data.id, payload);
    }
    return createRow('impostazioni', payload);
  } catch (error) {
    return failure(error);
  }
}
