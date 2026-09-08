-- DEL GROSSO GESTIONALE V46
-- Operational tasks and deadlines used by the V46 dashboard.
create table if not exists public.attivita_gestionale (
  id uuid primary key default gen_random_uuid(), titolo text not null, descrizione text,
  stato text not null default 'aperta', priorita text not null default 'normale', scadenza date,
  riferimento_tipo text, riferimento_id uuid, assegnata_a text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completata_at timestamptz
);
create table if not exists public.scadenze_gestionale (
  id uuid primary key default gen_random_uuid(), titolo text not null, descrizione text,
  tipo text not null default 'operativa', stato text not null default 'aperta', priorita text not null default 'normale',
  data_scadenza date not null, riferimento_tipo text, riferimento_id uuid, cliente_id uuid, viaggio_id uuid,
  prenotazione_id uuid, importo numeric(12,2), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completata_at timestamptz
);
create index if not exists idx_attivita_gestionale_stato_scadenza on public.attivita_gestionale(stato, scadenza);
create index if not exists idx_scadenze_gestionale_data_stato on public.scadenze_gestionale(data_scadenza, stato);
create or replace function public.dg_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_attivita_gestionale_updated_at on public.attivita_gestionale;
create trigger trg_attivita_gestionale_updated_at before update on public.attivita_gestionale for each row execute function public.dg_touch_updated_at();
drop trigger if exists trg_scadenze_gestionale_updated_at on public.scadenze_gestionale;
create trigger trg_scadenze_gestionale_updated_at before update on public.scadenze_gestionale for each row execute function public.dg_touch_updated_at();
alter table public.attivita_gestionale enable row level security;
alter table public.scadenze_gestionale enable row level security;
drop policy if exists attivita_gestionale_open_access on public.attivita_gestionale;
create policy attivita_gestionale_open_access on public.attivita_gestionale for all to anon, authenticated using(true) with check(true);
drop policy if exists scadenze_gestionale_open_access on public.scadenze_gestionale;
create policy scadenze_gestionale_open_access on public.scadenze_gestionale for all to anon, authenticated using(true) with check(true);
create or replace view public.dashboard_operativa as
select
(select count(*) from public.attivita_gestionale where stato<>'completata') attivita_aperte,
(select count(*) from public.attivita_gestionale where stato<>'completata' and scadenza=current_date) attivita_oggi,
(select count(*) from public.scadenze_gestionale where stato<>'completata' and data_scadenza<current_date) scadenze_scadute,
(select count(*) from public.scadenze_gestionale where stato<>'completata' and data_scadenza between current_date and current_date+7) scadenze_7_giorni,
(select count(*) from public.prenotazioni where coalesce(stato,'') not in ('Annullata','annullata','Cancellata','cancellata')) prenotazioni_attive,
(select coalesce(sum(coalesce(pagato,0)),0) from public.pagamenti) incassato;
