import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const editor = readFileSync('GESTIONALE/assets/piantine-ufficiali-v28.js','utf8');
const supabase = readFileSync('GESTIONALE/assets/supabase.js','utf8');
const migration = readFileSync('supabase/patches/dg29_immutable_layout_history_and_booked_trip_guard.sql','utf8');

new Script(editor);
new Script(supabase);

const ctx = {document:{addEventListener(){}},window:{}};
createContext(ctx);
new Script(editor).runInContext(ctx);
assert.equal(ctx.window.DGPiantine28.version,'2.8');

for(const capacity of [53,63]){
  const draft=ctx.window.DGPiantine28.makeTemplate(capacity,'BOZZA DI TEST NON OMOLOGATA');
  const seats=draft.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat');
  assert.equal(seats.length,capacity);
  assert.equal(new Set(seats.map(s=>s.id)).size,capacity);
  assert.deepEqual(seats.map(s=>Number(s.id)).sort((a,b)=>a-b),Array.from({length:capacity},(_,i)=>i+1));
}

// Critical regression: never renumber upon saving a draft or publish
// a document that differs from the persisted version.
assert.doesNotMatch(editor,/else if\(action==='save'\)\s*\{\s*renumber\(\)/);
assert.match(editor,/savedDraftFingerprint=fingerprint\(draft\)/);
assert.match(editor,/if\(!selectedLayoutId\|\|dirty\(\)\)/);
assert.match(editor,/validateNumbering\(Number\(bus\.posti\)\)/);
assert.match(editor,/validateNumbering\(Number\(t\.posti_totali\)\)/);
assert.match(editor,/data-dg28="move-up"/);
assert.match(editor,/data-dg28="undo"/);
assert.match(editor,/data-dg28="restore-history"/);
assert.match(supabase,/layoutHistory:\['dg29_layout_versions'/);

// Check the migration explicitly prevents overwrites of already booked
// trips and uses an append-only security model for versions.
assert.match(migration,/create table if not exists public\.dg29_layout_versions/i);
assert.match(migration,/enable row level security/i);
assert.match(migration,/dg29_guard_booked_trips_on_master_change/i);
assert.match(migration,/dg29_immutable_history/i);
assert.match(migration,/for select to authenticated/i);
assert.match(migration,/on conflict do nothing/i);
assert.doesNotMatch(migration,/\btruncate\b/i);

console.log('DG29 seat editor static/functional smoke tests PASS');
