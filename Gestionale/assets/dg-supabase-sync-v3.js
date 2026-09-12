/*
 * DELGROSSO VIAGGI & LIMOUSINE BUS
 * Supabase Central Sync Layer v1.0
 *
 * Project: https://chkuayhbmitdmzmmvona.supabase.co
 * Safe for browser use: publishable key only.
 * NEVER put a Supabase secret/service_role key in this file.
 *
 * Purpose:
 * - One central Supabase client for the entire Gestionale.
 * - Connection/health monitoring.
 * - Paginated pull of operational tables.
 * - Generic upsert/delete helpers.
 * - Offline queue + automatic retry.
 * - Realtime subscriptions for operational tables.
 * - Custom DOM events so every page can refresh without reload.
 *
 * Usage:
 *   <script type="module" src="./assets/dg-supabase-sync-v1.js"></script>
 *
 * Then:
 *   const sync = window.DG_SUPABASE_SYNC;
 *   await sync.healthCheck();
 *   await sync.pullAll();
 *   await sync.upsert('clienti', row);
 *
 * NOTE:
 * This layer does not bypass RLS. It uses the browser-safe publishable key.
 */

const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CONFIG = Object.freeze({
  url: SUPABASE_URL,
  key: SUPABASE_PUBLISHABLE_KEY,
  pageSize: 500,
  retryBaseMs: 1500,
  maxRetries: 8,
  queueKey: 'dg_supabase_sync_queue_v2',
  stateKey: 'dg_supabase_sync_state_v2',
  heartbeatMs: 30000,
  flushMs: 5000,
  realtime: true,
});

// Operational tables currently used by the Gestionale.
// Sensitive settings are intentionally excluded from browser snapshot caching.
const TABLES = Object.freeze([
  'viaggi',
  'prenotazioni',
  'clienti',
  'flotta',
  'pagamenti',
  'preventivi',
  'noleggi_bus',
  'noleggi_bus_mezzi',
  'noleggi_bus_pagamenti',
  'notifiche',
  'accessi_checkin',
  'attivita_gestionale',
  'scadenze_gestionale',
]);

let supabase = null;
let realtimeChannel = null;
let heartbeatTimer = null;
let flushTimer = null;
let initialized = false;
let flushing = false;
const realtimePullTimers = new Map();

function now() { return new Date().toISOString(); }
function isTransientError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return status === 0 || status === 408 || status === 409 || status === 425 || status === 429 ||
    status >= 500 || code.includes('network') || code.includes('fetch') ||
    msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function isBrowser() { return typeof window !== 'undefined' && typeof document !== 'undefined'; }
function emit(name, detail = {}) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(name, { detail: { ...detail, at: now() } }));
}
function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}
function readQueue() {
  if (!isBrowser()) return [];
  return safeJson(localStorage.getItem(CONFIG.queueKey) || '[]', []);
}
function writeQueue(queue) {
  if (!isBrowser()) return;
  localStorage.setItem(CONFIG.queueKey, JSON.stringify(queue));
}
function writeState(patch) {
  if (!isBrowser()) return;
  const current = safeJson(localStorage.getItem(CONFIG.stateKey) || '{}', {});
  localStorage.setItem(CONFIG.stateKey, JSON.stringify({ ...current, ...patch, updatedAt: now() }));
}
function readState() {
  if (!isBrowser()) return {};
  return safeJson(localStorage.getItem(CONFIG.stateKey) || '{}', {});
}

async function getClient() {
  if (supabase) return supabase;
  const mod = await import(SUPABASE_JS);
  supabase = mod.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: 'public' },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-dg-client': 'delgrosso-gestionale-sync-v2' },
    },
  });
  return supabase;
}

async function healthCheck() {
  const sb = await getClient();
  const started = performance.now();
  const { data, error } = await sb.from('viaggi').select('id').limit(1);
  const result = {
    ok: !error,
    url: SUPABASE_URL,
    latencyMs: Math.round(performance.now() - started),
    error: error ? { message: error.message, code: error.code || null } : null,
    sampleRows: Array.isArray(data) ? data.length : 0,
  };
  writeState({ online: result.ok, lastHealthCheck: now(), latencyMs: result.latencyMs });
  emit(result.ok ? 'dg:supabase:online' : 'dg:supabase:offline', result);
  return result;
}

async function pullTable(table, { cache = false } = {}) {
  if (!TABLES.includes(table)) throw new Error(`Tabella non autorizzata dal sync layer: ${table}`);
  const sb = await getClient();
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + CONFIG.pageSize - 1;
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: true }).range(from, to);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < CONFIG.pageSize) break;
    from += CONFIG.pageSize;
  }
  if (cache && isBrowser()) {
    // Never cache settings or credentials. Operational snapshots are namespaced.
    localStorage.setItem(`dg_supabase_snapshot_${table}_v1`, JSON.stringify({ at: now(), rows }));
  }
  writeState({ [`lastPull_${table}`]: now() });
  emit('dg:supabase:table-pulled', { table, count: rows.length, rows });
  return rows;
}

async function pullAll({ cache = false, tables = TABLES } = {}) {
  const uniqueTables = [...new Set(tables)].filter(t => TABLES.includes(t));
  const result = {};
  const errors = [];
  emit('dg:supabase:sync-start', { tables: uniqueTables });
  for (const table of uniqueTables) {
    try {
      result[table] = await pullTable(table, { cache });
    } catch (error) {
      errors.push({ table, message: error?.message || String(error), code: error?.code || null });
    }
  }
  writeState({ lastFullPull: now(), lastFullPullErrors: errors });
  emit('dg:supabase:sync-complete', { result, errors });
  return { result, errors, ok: errors.length === 0 };
}

function validateTable(table) {
  if (!TABLES.includes(table)) throw new Error(`Tabella non autorizzata dal sync layer: ${table}`);
}

async function upsert(table, row, options = {}) {
  validateTable(table);
  const payload = { table, op: 'upsert', row, options, queuedAt: now(), retries: 0 };
  try {
    const sb = await getClient();
    const { data, error } = await sb.from(table).upsert(row, options).select();
    if (error) throw error;
    emit('dg:supabase:changed', { table, op: 'upsert', data });
    return { ok: true, data, queued: false };
  } catch (error) {
    if (isTransientError(error)) {
      enqueue(payload, error);
      return { ok: false, queued: true, error: error?.message || String(error) };
    }
    emit('dg:supabase:operation-error', { table, op: 'upsert', error: error?.message || String(error), code: error?.code || null });
    return { ok: false, queued: false, error: error?.message || String(error) };
  }
}

async function update(table, filters, patch) {
  validateTable(table);
  try {
    const sb = await getClient();
    let q = sb.from(table).update(patch);
    for (const [column, value] of Object.entries(filters || {})) q = q.eq(column, value);
    const { data, error } = await q.select();
    if (error) throw error;
    emit('dg:supabase:changed', { table, op: 'update', data });
    return { ok: true, data, queued: false };
  } catch (error) {
    const payload = { table, op: 'update', filters, patch, queuedAt: now(), retries: 0 };
    if (isTransientError(error)) {
      enqueue(payload, error);
      return { ok: false, queued: true, error: error?.message || String(error) };
    }
    emit('dg:supabase:operation-error', { table, op: 'update', error: error?.message || String(error), code: error?.code || null });
    return { ok: false, queued: false, error: error?.message || String(error) };
  }
}

async function remove(table, filters) {
  validateTable(table);
  try {
    const sb = await getClient();
    let q = sb.from(table).delete();
    for (const [column, value] of Object.entries(filters || {})) q = q.eq(column, value);
    const { data, error } = await q.select();
    if (error) throw error;
    emit('dg:supabase:changed', { table, op: 'delete', data });
    return { ok: true, data, queued: false };
  } catch (error) {
    const payload = { table, op: 'delete', filters, queuedAt: now(), retries: 0 };
    if (isTransientError(error)) {
      enqueue(payload, error);
      return { ok: false, queued: true, error: error?.message || String(error) };
    }
    emit('dg:supabase:operation-error', { table, op: 'delete', error: error?.message || String(error), code: error?.code || null });
    return { ok: false, queued: false, error: error?.message || String(error) };
  }
}

function enqueue(payload, error) {
  const queue = readQueue();
  queue.push({ ...payload, lastError: error?.message || String(error), queuedAt: payload.queuedAt || now() });
  writeQueue(queue.slice(-1000));
  writeState({ queuedOperations: Math.min(queue.length, 1000), lastQueueError: error?.message || String(error) });
  emit('dg:supabase:queued', { size: queue.length, operation: payload.op, table: payload.table });
}

async function executeQueued(item) {
  const sb = await getClient();
  if (item.op === 'upsert') {
    const { error } = await sb.from(item.table).upsert(item.row, item.options || {});
    if (error) throw error;
    return;
  }
  if (item.op === 'update') {
    let q = sb.from(item.table).update(item.patch || {});
    for (const [column, value] of Object.entries(item.filters || {})) q = q.eq(column, value);
    const { error } = await q;
    if (error) throw error;
    return;
  }
  if (item.op === 'delete') {
    let q = sb.from(item.table).delete();
    for (const [column, value] of Object.entries(item.filters || {})) q = q.eq(column, value);
    const { error } = await q;
    if (error) throw error;
    return;
  }
  throw new Error(`Operazione in coda non supportata: ${item.op}`);
}

async function flushQueue() {
  if (flushing) return { ok: false, skipped: true };
  const queue = readQueue();
  if (!queue.length) return { ok: true, flushed: 0, remaining: 0 };
  flushing = true;
  let flushed = 0;
  const remaining = [];
  try {
    for (const item of queue) {
      try {
        await executeQueued(item);
        flushed++;
      } catch (error) {
        const retries = Number(item.retries || 0) + 1;
        if (retries < CONFIG.maxRetries) remaining.push({ ...item, retries, lastError: error?.message || String(error) });
        else emit('dg:supabase:queue-dead-letter', { item, error: error?.message || String(error) });
      }
    }
    writeQueue(remaining);
    writeState({ queuedOperations: remaining.length, lastQueueFlush: now() });
    emit('dg:supabase:queue-flushed', { flushed, remaining: remaining.length });
    return { ok: true, flushed, remaining: remaining.length };
  } finally {
    flushing = false;
  }
}

function subscribeAll() {
  if (!CONFIG.realtime || realtimeChannel) return realtimeChannel;
  const tables = TABLES.slice();
  realtimeChannel = supabase
    .channel('dg-gestionale-all-tables-v1')
    .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
      if (!tables.includes(payload.table)) return;
      emit('dg:supabase:realtime', payload);
      emit(`dg:supabase:realtime:${payload.table}`, payload);
      clearTimeout(realtimePullTimers.get(payload.table));
      realtimePullTimers.set(payload.table, setTimeout(() => {
        pullTable(payload.table, { cache: false }).catch(error => {
          console.warn('[DG SUPABASE SYNC] refresh realtime failed', payload.table, error);
        });
      }, 350));
    })
    .subscribe(status => {
      writeState({ realtimeStatus: status });
      emit('dg:supabase:realtime-status', { status });
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeChannel = null;
        setTimeout(() => { if (supabase && !realtimeChannel) subscribeAll(); }, 2500);
      }
    });
  return realtimeChannel;
}

async function init() {
  if (initialized) return api;
  initialized = true;
  await getClient();
  subscribeAll();
  await healthCheck();
  // Build a fresh central snapshot in the background. This never blocks page rendering.
  syncNow({ cache: false }).catch(error => {
    writeState({ lastFullPullError: error?.message || String(error) });
    emit('dg:supabase:init-error', { error: error?.message || String(error), phase: 'initial-sync' });
  });
  if (isBrowser()) {
    clearInterval(heartbeatTimer);
    clearInterval(flushTimer);
    heartbeatTimer = setInterval(() => healthCheck().catch(() => {}), CONFIG.heartbeatMs);
    flushTimer = setInterval(() => flushQueue().catch(() => {}), CONFIG.flushMs);
    window.addEventListener('online', () => { flushQueue().catch(() => {}); healthCheck().catch(() => {}); });
  }
  return api;
}


async function syncNow(options = {}) {
  return pullAll({ cache: options.cache === true, tables: options.tables || TABLES });
}

function getStatus() {
  const state = readState();
  return { ...state, queueSize: readQueue().length, initialized, url: SUPABASE_URL };
}

const api = Object.freeze({
  config: CONFIG,
  tables: TABLES,
  getClient,
  init,
  healthCheck,
  pullTable,
  pullAll,
  upsert,
  update,
  remove,
  flushQueue,
  readQueue,
  readState,
  subscribeAll,
  syncNow,
  getStatus,
});

if (isBrowser()) {
  window.DG_SUPABASE_SYNC = api;
  // Initialize without blocking the page.
  init().catch(error => {
    writeState({ online: false, initError: error?.message || String(error) });
    emit('dg:supabase:init-error', { error: error?.message || String(error) });
    console.warn('[DG SUPABASE SYNC]', error);
  });
}

export default api;
export { CONFIG, TABLES, SUPABASE_URL, getClient, init, healthCheck, pullTable, pullAll, syncNow, getStatus, upsert, update, remove, flushQueue };
