-- V47: Noleggi Bus interi
-- La selezione del mezzo avviene tramite flotta.id/nome (titolo).
-- La targa viene salvata come snapshot per uso interno e storico.
-- Nessun campo relativo a personale/autisti.

create table if not exists public.noleggi_bus (
  id uuid primary key default gen_random_uuid(), id_noleggio text unique,
  cliente_id uuid references public.clienti(id) on delete set null,
  referente text, azienda text, telefono text, email text,
  tratta_partenza text not null, tratta_destinazione text not null, fermate text,
  data_partenza date not null, ora_partenza time, data_ritorno date, ora_ritorno time,
  passeggeri integer, servizio_tipo text not null default 'Andata e ritorno',
  prezzo_concordato numeric(12,2) not null default 0, acconto numeric(12,2) not null default 0,
  saldo numeric(12,2) not null default 0, stato_pagamento text not null default 'Da pagare',
  stato_noleggio text not null default 'Richiesto', note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.noleggi_bus_mezzi (
  id uuid primary key default gen_random_uuid(), noleggio_id uuid not null references public.noleggi_bus(id) on delete cascade,
  flotta_id uuid not null references public.flotta(id) on delete restrict,
  targa_snapshot text, posti_snapshot integer, created_at timestamptz not null default now(),
  unique(noleggio_id, flotta_id)
);

create table if not exists public.noleggi_bus_pagamenti (
  id uuid primary key default gen_random_uuid(), noleggio_id uuid not null references public.noleggi_bus(id) on delete cascade,
  tipo text not null default 'Acconto', importo numeric(12,2) not null, metodo text,
  data_pagamento date not null default current_date, note text, created_at timestamptz not null default now()
);

create or replace function public.dg_noleggio_bus_id() returns trigger language plpgsql as $$
begin
  if new.id_noleggio is null or btrim(new.id_noleggio) = '' then new.id_noleggio := 'DG-NB-' || upper(substr(replace(new.id::text,'-',''),1,8)); end if;
  new.saldo := greatest(coalesce(new.prezzo_concordato,0)-coalesce(new.acconto,0),0);
  if new.saldo=0 and coalesce(new.prezzo_concordato,0)>0 then new.stato_pagamento:='Saldata';
  elsif coalesce(new.acconto,0)>0 then new.stato_pagamento:='Acconto ricevuto'; else new.stato_pagamento:='Da pagare'; end if;
  new.updated_at:=now(); return new;
end $$;

drop trigger if exists trg_dg_noleggio_bus_id on public.noleggi_bus;
create trigger trg_dg_noleggio_bus_id before insert or update on public.noleggi_bus for each row execute function public.dg_noleggio_bus_id();
create index if not exists idx_noleggi_bus_data on public.noleggi_bus(data_partenza,data_ritorno);
create index if not exists idx_noleggi_bus_cliente on public.noleggi_bus(cliente_id);
create index if not exists idx_noleggi_bus_mezzo on public.noleggi_bus_mezzi(flotta_id,noleggio_id);
create index if not exists idx_noleggi_bus_pagamenti on public.noleggi_bus_pagamenti(noleggio_id,data_pagamento);
