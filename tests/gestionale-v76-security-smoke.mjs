import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/patches/v76_secure_comms_rpc_wrapper_20261103.sql',import.meta.url),'utf8');
const check=readFileSync(new URL('../supabase/patches/v76_rls_initplan_operator_comms_20261103.sql',import.meta.url),'utf8');

assert.match(sql,/CREATE OR REPLACE FUNCTION dg_private\.dg_mark_comms_manual_v76/i,
 'Privileged mutation must reside in a private schema');
assert.match(sql,/SECURITY DEFINER[\s\S]*?SET search_path TO ''/i,
 'Private function must use an empty search path');
assert.match(sql,/dg_private\.has_permission\('operazioni', 'write'\)/,
 'Only an active operator with write permission may modify communications');
assert.match(sql,/v_uid := auth\.uid\(\)/,'Server must bind writes to the authenticated operator');
assert.match(sql,/WHERE id=p_id AND status IN \('pending','waiting_consent','failed','disabled'\)/,
 'Only outstanding communication records may be marked handled');
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.dg_mark_comms_manual_v66[\s\S]*?SECURITY INVOKER/i,
 'Public RPC must be an invoker wrapper, not a definer');
assert.match(sql,/REVOKE ALL ON FUNCTION public\.dg_mark_comms_manual_v66\(uuid,text\) FROM PUBLIC, anon/,
 'Public communication action must not be executable anonymously');
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.dg_mark_comms_manual_v66\(uuid,text\) TO authenticated/,
 'Authenticated operators must retain their access');
assert.match(sql,/REVOKE ALL ON FUNCTION dg_private\.dg_mark_comms_manual_v76\(uuid,text\) FROM PUBLIC, anon/,
 'Private elevated function must reject anonymous access');
assert.ok(!sql.includes('UPDATE public.prenotazioni'),'Security migration must not alter bookings');
assert.ok(!sql.includes('UPDATE public.pagamenti'),'Security migration must not alter payment records');
assert.match(check,/v_count <> 9/,'RLS optimization must be pinned to audited policy set');
assert.match(check,/replace\(r\.with_check,'auth\.uid\(\)','\(select auth\.uid\(\)\)'\)/,
 'RLS INSERT and UPDATE authorization conditions must be preserved');
console.log('V76: communication RPC privilege boundary, anonymous access and RLS safeguards PASS');
