-- Applied 2026-11-02 to DELGROSSO Supabase.
-- Operator-only read access to private archived receipts so iOS/desktop can
-- create short-lived Storage signed URLs without the Edge Functions gateway.
-- No public bucket access; other storage buckets remain unaffected.
drop policy if exists dg_operator_read_existing_receipts_20261102 on storage.objects;
create policy dg_operator_read_existing_receipts_20261102
on storage.objects for select to authenticated
using (bucket_id='ricevute-prenotazioni' and dg_private.is_operator());
