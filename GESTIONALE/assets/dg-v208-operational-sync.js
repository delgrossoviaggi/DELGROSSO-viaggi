/* DELGROSSO GESTIONALE V209 — DIRECT SUPABASE OPERATIONAL CORE
 * Source of truth: Supabase project chkuayhbmitdmzmmvona.
 * No dependency on local dg_session and no Supabase Auth requirement for data reads.
 */
(() => {
  'use strict';
  if (window.__DG_V209_SYNC__) return;
  window.__DG_V209_SYNC__ = true;

  const URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
  const KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
  const API = `${URL}/rest/v1`;
  const VERSION = 'V209';
  const TABLES = [
    'viaggi','prenotazioni','clienti','flotta','pagamenti','preventivi',
    'noleggi_bus','noleggi_bus_mezzi','noleggi_bus_pagamenti','accessi_checkin',
    'notifiche','attivita_gestionale','scadenze_gestionale','impostazioni','push_subscriptions'
  ];
  const CRITICAL = new Set(['prenotazioni','flotta','viaggi','clienti','pagamenti']);
  const stateKey = 'dg_live_sync_v208';
  const snapshotKey = t => `dg_snapshot_${t}_v208`;
  const signatures = new Map();
  let busy = false;
  let initialized = false;
  let timer = null;
  let criticalTimer = null;
  let dirty = false;
  let stopped = false;

  const now = () => new Date().toISOString();
  const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail: { ...detail, at: now(), version: VERSION } }));
  const readState = () => { try { return JSON.parse(localStorage.getItem(stateKey) || '{}'); } catch { return {}; } };
  const setState = patch => {
    const next = { ...readState(), ...patch, at: now(), version: VERSION, url: URL };
    try { localStorage.setItem(stateKey, JSON.stringify(next)); } catch {}
    emit('dg:live:status', next);
    return next;
  };
  const authHeaders = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Cache-Control': 'no-cache' });

  async function rest(table, params = '') {
    const response = await fetch(`${API}/${table}?select=*${params ? `&${params}` : ''}`, {
      headers: authHeaders(), cache: 'no-store', credentials: 'omit'
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Supabase ${table} HTTP ${response.status}${body ? ` — ${body.slice(0,180)}` : ''}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  function stableSignature(rows) {
    if (!Array.isArray(rows)) return '0';
    return rows.map(r => {
      const id = r?.id ?? '';
      const changed = r?.updated_at ?? r?.created_at ?? r?.data_partenza ?? r?.data_pagamento ?? '';
      const booking = r?.posti_selezionati ?? '';
      const money = `${r?.totale ?? ''}|${r?.pagato ?? ''}|${r?.saldo ?? ''}`;
      return `${id}|${changed}|${booking}|${money}`;
    }).sort().join('¦');
  }

  function cache(table, rows) {
    try { localStorage.setItem(snapshotKey(table), JSON.stringify({ at: now(), rows })); } catch {}
  }

  async function pullTable(table, { emitEvents = true } = {}) {
    const rows = await rest(table);
    const signature = stableSignature(rows);
    const previous = signatures.get(table);
    signatures.set(table, signature);
    cache(table, rows);
    if (emitEvents) {
      const changed = previous !== undefined && previous !== signature;
      const detail = { table, rows, count: rows.length, changed, source: 'supabase-rest' };
      emit(`dg:live:table:${table}`, detail);
      if (changed) {
        emit('dg:live:change', detail);
        emit(`dg:live:change:${table}`, detail);
        // Legacy pages in this Gestionale listen for this event.
        emit('dg:supabase:changed', detail);
      }
    }
    return rows;
  }

  async function pullAll({ silent = false } = {}) {
    if (busy || stopped) return { ok: false, busy };
    busy = true;
    setState({ status: 'syncing', error: null });
    const result = {};
    const errors = [];
    try {
      for (const table of TABLES) {
        try { result[table] = await pullTable(table, { emitEvents: true }); }
        catch (e) { errors.push({ table, message: e?.message || String(e) }); }
      }
      const ok = errors.length === 0;
      const counts = Object.fromEntries(Object.entries(result).map(([k,v]) => [k, v.length]));
      setState({ status: ok ? 'online' : 'degraded', ok, errors: errors.length, counts, lastSync: now() });
      if (!silent) emit('dg:live:complete', { ok, result, errors, counts });
      return { ok, result, errors, counts };
    } finally {
      busy = false;
    }
  }

  async function health() {
    try {
      const started = performance.now();
      const rows = await rest('viaggi', 'limit=1');
      const latency = Math.round(performance.now() - started);
      setState({ status: 'online', ok: true, latency, reachable: true, viaggiSample: rows.length });
      return { ok: true, latency };
    } catch (e) {
      setState({ status: 'offline', ok: false, reachable: false, error: e?.message || String(e) });
      return { ok: false, error: e?.message || String(e) };
    }
  }

  function installUI() {
    if (document.getElementById('dg-v208-live')) return;
    const el = document.createElement('div');
    el.id = 'dg-v208-live';
    el.innerHTML = '<span class="dot"></span><span class="txt">SUPABASE • collegamento…</span><button type="button">↻ Sincronizza</button>';
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:14px;background:rgba(9,23,39,.96);color:#fff;font:600 12px system-ui,-apple-system,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);backdrop-filter:blur(8px)';
    el.querySelector('button').onclick = () => pullAll().catch(() => {});
    document.body.appendChild(el);
    window.addEventListener('dg:live:status', e => {
      const s = e.detail || {};
      const dot = el.querySelector('.dot');
      const txt = el.querySelector('.txt');
      dot.style.cssText = `width:9px;height:9px;border-radius:50%;background:${s.status === 'online' ? '#16c784' : s.status === 'syncing' ? '#f59e0b' : '#ef4444'}`;
      txt.textContent = s.status === 'online' ? `SUPABASE LIVE • ${VERSION}` : s.status === 'syncing' ? 'SUPABASE • sincronizzazione…' : 'SUPABASE • verifica collegamento';
    });
  }

  function installDirtyGuards() {
    const mark = () => { dirty = true; document.documentElement.dataset.dgUnsaved = '1'; };
    const clear = () => { dirty = false; delete document.documentElement.dataset.dgUnsaved; };
    document.addEventListener('input', e => { if (e.target?.matches?.('input,textarea,select')) mark(); }, true);
    document.addEventListener('change', e => { if (e.target?.matches?.('input,textarea,select')) mark(); }, true);
    document.addEventListener('submit', () => setTimeout(clear, 900), true);
    window.addEventListener('dg:clear-unsaved', clear);
    window.DG_SUPABASE_SYNC = {
      url: URL, key: KEY, tables: TABLES,
      pullTable, pullAll, syncNow: pullAll, healthCheck: health,
      rest, getStatus: readState,
      markDirty: mark, clearDirty: clear,
      stop: () => { stopped = true; clearInterval(timer); clearInterval(criticalTimer); }
    };
  }

  async function criticalPoll() {
    if (document.hidden || dirty || stopped || busy) return;
    for (const table of CRITICAL) {
      try { await pullTable(table, { emitEvents: true }); } catch {}
    }
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    installDirtyGuards();
    installUI();
    setState({ status: 'syncing', initialized: true });
    const h = await health();
    if (!h.ok) return;
    await pullAll();
    // Critical operational data is reconciled frequently; all other data every 30s.
    criticalTimer = setInterval(criticalPoll, 7000);
    timer = setInterval(() => { if (!document.hidden && !dirty) pullAll({ silent: true }).catch(() => {}); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !dirty) pullAll({ silent: true }).catch(() => {}); });
    window.addEventListener('online', () => { dirty = false; delete document.documentElement.dataset.dgUnsaved; pullAll().catch(() => {}); });
    emit('dg:supabase:ready', { url: URL, version: VERSION });
  }

  init().catch(e => setState({ status: 'offline', ok: false, error: e?.message || String(e) }));
})();
