-- V62: outbound audit. Deploy after verifying existing Supabase project.
create table if not exists public.dg_whatsapp_outbound_v62 (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 booking_id uuid not null references public.prenotazioni(id) on delete restrict,
 template_kind text not null check (template_kind in ('confirmation','deposit','balance')),
 recipient_phone text not null,
 status text not null default 'sending' check (status in ('sending','sent','delivered','read','failed')),
 meta_message_id text unique,
 last_error text,
 created_by uuid not null references public.operatori_gestionale(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists dg_wa_outbound_booking_v62_idx on public.dg_whatsapp_outbound_v62(booking_id,created_at desc);
alter table public.dg_whatsapp_outbound_v62 enable row level security;
drop policy if exists dg_wa_outbound_read_v62 on public.dg_whatsapp_outbound_v62;
create policy dg_wa_outbound_read_v62 on public.dg_whatsapp_outbound_v62
 for select to authenticated using (dg_private.has_permission('operazioni','read'));
revoke all on public.dg_whatsapp_outbound_v62 from public,anon,authenticated;
grant select on public.dg_whatsapp_outbound_v62 to authenticated;
-- Inserts and updates are performed exclusively by the server after verifying the login and consent.
