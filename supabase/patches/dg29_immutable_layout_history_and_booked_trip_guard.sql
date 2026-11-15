-- DELGROSSO VIAGGI 3.0 ULTIMATE — DG29
-- Additive migration for immutable official-layout history and protection of booked trips.
-- IMPORTANT: apply on staging AFTER a verified recovery point; then run dg29_layout_integrity_readonly.sql.
-- Does not alter bookings, passenger seat assignments, payments, receipt objects or existing official layouts.

create table if not exists public.dg29_layout_versions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('bus','trip')),
  autobus_id uuid not null references public.flotta(id) on delete restrict,
  viaggio_id uuid references public.viaggi(id) on delete restrict,
  layout_id uuid not null references public.dg2_layout_library(id) on delete restrict,
  versione integer not null check (versione > 0),
  configurazione jsonb not null,
  checksum text not null,
  pubblicata_il timestamptz not null,
  pubblicata_da uuid,
  acquisita_il timestamptz not null default now(),
  constraint dg29_scope_target_chk check (
    (scope = 'bus' and viaggio_id is null)
    or (scope = 'trip' and viaggio_id is not null)
  ),
  constraint dg29_config_rows_chk check (jsonb_typeof(configurazione->'rows') = 'array')
);
create unique index if not exists dg29_unique_bus_version
  on public.dg29_layout_versions(autobus_id,versione) where scope = 'bus';
create unique index if not exists dg29_unique_trip_version
  on public.dg29_layout_versions(viaggio_id,versione) where scope = 'trip';
create index if not exists dg29_layout_versions_by_draft
  on public.dg29_layout_versions(layout_id,acquisita_il desc);

alter table public.dg29_layout_versions enable row level security;
revoke all on public.dg29_layout_versions from public,anon,authenticated;
grant select on public.dg29_layout_versions to authenticated;
drop policy if exists dg29_layout_versions_operator_read on public.dg29_layout_versions;
create policy dg29_layout_versions_operator_read on public.dg29_layout_versions
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and public.is_gestionale_admin()
    and dg_private.has_permission('flotta','read')
  );

-- Nobody can modify or delete version rows, including an accidentally privileged
-- application workflow. This history is append-only.
create or replace function dg_private.dg29_reject_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'STORICO_PIANTINE_IMMUTABILE' using errcode='42501';
end;
$$;
revoke all on function dg_private.dg29_reject_history_mutation() from public,anon,authenticated;
drop trigger if exists dg29_immutable_history on public.dg29_layout_versions;
create trigger dg29_immutable_history before update or delete
  on public.dg29_layout_versions for each row
  execute function dg_private.dg29_reject_history_mutation();

-- A master publication must not silently change the geometry of an already
-- booked future trip that has no independent trip snapshot. This is critical
-- also for the *first* master publication when the site still serves legacy maps.
create or replace function dg_private.dg29_guard_booked_trips_on_master_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.configurazione is not distinct from old.configurazione
    then return new;
  end if;
  if exists (
    select 1 from public.viaggi v
    where v.autobus_id = new.autobus_id
      and v.data_partenza >= (now() at time zone 'Europe/Rome')::date
      and v.archiviato_at is null
      and coalesce(v.stato,'') !~* 'annull|cancel|cancell'
      and exists (
        select 1 from public.prenotazioni p
        where p.viaggio_id = v.id
          and coalesce(p.stato,'') !~* 'annull|cancel|cancell'
      )
      and not exists (
        select 1 from public.dg28_trip_layouts tl
        where tl.viaggio_id = v.id and tl.autobus_id = new.autobus_id
      )
  ) then
    raise exception 'PIANTINA_NON_PUBBLICABILE: viaggio prenotato privo di snapshot validato. Pubblica prima una variante specifica del viaggio.'
      using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function dg_private.dg29_guard_booked_trips_on_master_change() from public,anon,authenticated;
drop trigger if exists dg29_guard_booked_trips_on_master_change on public.dg28_bus_layouts;
create trigger dg29_guard_booked_trips_on_master_change
  before insert or update of configurazione on public.dg28_bus_layouts
  for each row execute function dg_private.dg29_guard_booked_trips_on_master_change();

-- Capture the actual database-published snapshot, not a mutable draft.
-- A private SECURITY DEFINER trigger avoids granting direct history INSERT
-- to browser clients. Restrict the function to a known search_path and tables.
create or replace function dg_private.dg29_capture_layout_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'dg28_bus_layouts' then
    insert into public.dg29_layout_versions(
      scope,autobus_id,viaggio_id,layout_id,versione,configurazione,
      checksum,pubblicata_il,pubblicata_da
    ) values (
      'bus',new.autobus_id,null,new.layout_id,new.versione,new.configurazione,
      pg_catalog.encode(extensions.digest(pg_catalog.convert_to(new.configurazione::text,'UTF8'),'sha256'),'hex'),
      new.pubblicata_il,new.pubblicata_da
    ) on conflict do nothing;
  elsif tg_table_name = 'dg28_trip_layouts' then
    insert into public.dg29_layout_versions(
      scope,autobus_id,viaggio_id,layout_id,versione,configurazione,
      checksum,pubblicata_il,pubblicata_da
    ) values (
      'trip',new.autobus_id,new.viaggio_id,new.layout_id,new.versione,new.configurazione,
      pg_catalog.encode(extensions.digest(pg_catalog.convert_to(new.configurazione::text,'UTF8'),'sha256'),'hex'),
      new.pubblicata_il,new.pubblicata_da
    ) on conflict do nothing;
  else
    raise exception 'TRIGGER_SCOPE_NON_VALIDO' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function dg_private.dg29_capture_layout_version() from public,anon,authenticated;
drop trigger if exists dg29_capture_bus_version on public.dg28_bus_layouts;
create trigger dg29_capture_bus_version after insert or update of configurazione,versione
  on public.dg28_bus_layouts for each row
  execute function dg_private.dg29_capture_layout_version();
drop trigger if exists dg29_capture_trip_version on public.dg28_trip_layouts;
create trigger dg29_capture_trip_version after insert or update of configurazione,versione
  on public.dg28_trip_layouts for each row
  execute function dg_private.dg29_capture_layout_version();

-- Non-destructive backfill of historical versions still represented by dg28.
-- Earlier overwritten revisions cannot be reconstructed reliably.
insert into public.dg29_layout_versions(
  scope,autobus_id,viaggio_id,layout_id,versione,configurazione,
  checksum,pubblicata_il,pubblicata_da
)
select 'bus',x.autobus_id,null,x.layout_id,x.versione,x.configurazione,
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(x.configurazione::text,'UTF8'),'sha256'),'hex'),
  x.pubblicata_il,x.pubblicata_da
from public.dg28_bus_layouts x
on conflict do nothing;

insert into public.dg29_layout_versions(
  scope,autobus_id,viaggio_id,layout_id,versione,configurazione,
  checksum,pubblicata_il,pubblicata_da
)
select 'trip',x.autobus_id,x.viaggio_id,x.layout_id,x.versione,x.configurazione,
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(x.configurazione::text,'UTF8'),'sha256'),'hex'),
  x.pubblicata_il,x.pubblicata_da
from public.dg28_trip_layouts x
on conflict do nothing;
