-- DEL GROSSO V96 — schema economico predisposto per Supabase
-- NOTA: questa migration NON modifica le tabelle operative esistenti e NON concede accesso anonimo.
-- Applicarla solo dopo aver completato Supabase Auth/RLS del gestionale.

create table if not exists public.dg_viaggi_costi (
  id uuid primary key default gen_random_uuid(),
  viaggio_id uuid not null references public.viaggi(id) on delete cascade,
  categoria text not null default 'Altro',
  descrizione text,
  importo numeric(12,2) not null default 0 check (importo >= 0),
  data_costo date,
  fornitore text,
  stato text not null default 'Confermato',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dg_economia_movimenti (
  id uuid primary key default gen_random_uuid(),
  viaggio_id uuid references public.viaggi(id) on delete set null,
  prenotazione_id uuid references public.prenotazioni(id) on delete set null,
  tipo text not null default 'Entrata',
  descrizione text,
  importo numeric(12,2) not null default 0 check (importo >= 0),
  data_movimento date not null default current_date,
  metodo text,
  stato text not null default 'Registrato',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dg_viaggi_costi_viaggio on public.dg_viaggi_costi(viaggio_id);
create index if not exists idx_dg_economia_movimenti_viaggio on public.dg_economia_movimenti(viaggio_id);
create index if not exists idx_dg_economia_movimenti_prenotazione on public.dg_economia_movimenti(prenotazione_id);

alter table public.dg_viaggi_costi enable row level security;
alter table public.dg_economia_movimenti enable row level security;

-- Nessuna policy anonima: l'accesso va definito dopo la migrazione a Supabase Auth.
-- Esempio futuro: policy SELECT per utenti autenticati con ruolo amministrativo.
