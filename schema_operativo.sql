-- DELGROSSO VIAGGI — collegamento SITO PUBBLICO ↔ SUPABASE GESTIONALE
-- Progetto: exphxbeqwpwrsigdmilc
-- Eseguire una sola volta nel SQL Editor di Supabase.

begin;

-- Campi aggiuntivi necessari al flusso pubblico.
alter table public.tratte
  add column if not exists prezzo numeric(10,2);

alter table public.prenotazioni
  add column if not exists cognome_cliente text,
  add column if not exists email_cliente text,
  add column if not exists note_cliente text,
  add column if not exists totale numeric(10,2),
  add column if not exists stato text default 'da_confermare',
  add column if not exists numero_prenotazione text,
  add column if not exists public_token text;

-- Indici utili.
create index if not exists idx_prenotazioni_tratta_id
  on public.prenotazioni(tratta_id);

create unique index if not exists idx_prenotazioni_public_token
  on public.prenotazioni(public_token)
  where public_token is not null;

create unique index if not exists idx_prenotazioni_numero
  on public.prenotazioni(numero_prenotazione)
  where numero_prenotazione is not null;

-- Sicurezza: il sito pubblico NON deve poter leggere/modificare le prenotazioni di altri clienti.
drop policy if exists "Permetti lettura a tutti" on public.prenotazioni;

-- Rimuoviamo la vecchia policy troppo permissiva sulle tratte.
drop policy if exists "Admin totale tratte" on public.tratte;

-- Le partenze pubblicate sono leggibili dal sito.
drop policy if exists "Accesso pubblico tratte" on public.tratte;
drop policy if exists "Permetti lettura a tutti" on public.tratte;
create policy "Sito pubblico legge tratte"
on public.tratte for select
to anon, authenticated
using (true);

-- Disponibilità: restituisce SOLO i numeri dei posti già prenotati per una tratta.
create or replace function public.get_public_trip_seats(p_tratta_id uuid)
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct s order by s), '{}'::text[])
  from public.prenotazioni p
  cross join lateral unnest(coalesce(p.posti_selezionati, '{}'::text[])) as u(s)
  where p.tratta_id = p_tratta_id
    and coalesce(lower(p.stato), 'da_confermare') not in ('annullata', 'cancellata', 'rifiutata');
$$;

revoke all on function public.get_public_trip_seats(uuid) from public;
grant execute on function public.get_public_trip_seats(uuid) to anon, authenticated;

-- Prenotazione atomica: blocca la tratta durante il controllo dei posti e l'inserimento.
create or replace function public.create_public_booking(
  p_tratta_id uuid,
  p_nome text,
  p_cognome text,
  p_telefono text,
  p_email text,
  p_note text,
  p_posti text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.tratte%rowtype;
  v_existing text[] := '{}';
  v_conflict text[] := '{}';
  v_id uuid;
  v_token text;
  v_numero text;
  v_total numeric(10,2);
  v_clean_seats text[];
  v_seat text;
begin
  if p_tratta_id is null then
    raise exception 'Viaggio non specificato';
  end if;

  if nullif(trim(coalesce(p_nome,'')), '') is null
     or nullif(trim(coalesce(p_cognome,'')), '') is null
     or nullif(trim(coalesce(p_telefono,'')), '') is null then
    raise exception 'Nome, cognome e telefono sono obbligatori';
  end if;

  if coalesce(array_length(p_posti, 1), 0) < 1 then
    raise exception 'Seleziona almeno un posto';
  end if;

  -- Un lock per tratta impedisce due prenotazioni contemporanee sugli stessi posti.
  perform pg_advisory_xact_lock(hashtextextended(p_tratta_id::text, 0));

  select * into v_trip
  from public.tratte
  where id = p_tratta_id;

  if not found then
    raise exception 'Viaggio non trovato';
  end if;

  -- Normalizza e deduplica i posti richiesti.
  select coalesce(array_agg(x order by x), '{}'::text[])
  into v_clean_seats
  from (
    select distinct trim(x) as x
    from unnest(p_posti) x
    where trim(x) <> ''
  ) q;

  if coalesce(array_length(v_clean_seats,1),0) = 0 then
    raise exception 'Seleziona almeno un posto valido';
  end if;

  -- Recupera i posti già occupati.
  select coalesce(array_agg(distinct s order by s), '{}'::text[])
  into v_existing
  from public.prenotazioni p
  cross join lateral unnest(coalesce(p.posti_selezionati, '{}'::text[])) u(s)
  where p.tratta_id = p_tratta_id
    and coalesce(lower(p.stato), 'da_confermare') not in ('annullata', 'cancellata', 'rifiutata');

  select coalesce(array_agg(x), '{}'::text[])
  into v_conflict
  from unnest(v_clean_seats) x
  where x = any(v_existing);

  if coalesce(array_length(v_conflict,1),0) > 0 then
    raise exception 'Posti non più disponibili: %', array_to_string(v_conflict, ', ');
  end if;

  v_total := coalesce(v_trip.prezzo, 0) * coalesce(array_length(v_clean_seats,1), 0);
  v_token := encode(gen_random_bytes(18), 'hex');
  v_numero := 'DG-' || to_char(now() at time zone 'Europe/Rome', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.prenotazioni (
    nome_cliente,
    cognome_cliente,
    telefono_cliente,
    email_cliente,
    note_cliente,
    tratta_id,
    posti_selezionati,
    totale,
    stato,
    numero_prenotazione,
    public_token
  ) values (
    trim(p_nome),
    trim(p_cognome),
    trim(p_telefono),
    nullif(trim(coalesce(p_email,'')), ''),
    nullif(trim(coalesce(p_note,'')), ''),
    p_tratta_id,
    v_clean_seats,
    v_total,
    'da_confermare',
    v_numero,
    v_token
  )
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'numero', v_numero,
    'token', v_token,
    'totale', v_total,
    'posti', v_clean_seats
  );
end;
$$;

revoke all on function public.create_public_booking(uuid,text,text,text,text,text,text[]) from public;
grant execute on function public.create_public_booking(uuid,text,text,text,text,text,text[]) to anon, authenticated;

-- Conferma pubblica protetta da token: non espone l'elenco delle prenotazioni.
create or replace function public.get_public_confirmation(
  p_booking_id uuid,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'numero', p.numero_prenotazione,
    'cliente', trim(coalesce(p.nome_cliente,'') || ' ' || coalesce(p.cognome_cliente,'')),
    'destinazione', t.titolo,
    'data', t.data_partenza,
    'ora', null,
    'partenza', t.data_partenza,
    'posti', p.posti_selezionati,
    'totale', coalesce(p.totale, 0),
    'stato', p.stato
  )
  into v
  from public.prenotazioni p
  left join public.tratte t on t.id = p.tratta_id
  where p.id = p_booking_id
    and p.public_token = p_token;

  if v is null then
    raise exception 'Prenotazione non trovata o token non valido';
  end if;

  return v;
end;
$$;

revoke all on function public.get_public_confirmation(uuid,text) from public;
grant execute on function public.get_public_confirmation(uuid,text) to anon, authenticated;

-- Il browser pubblico usa solo RPC per inserire. Nessun accesso diretto alle prenotazioni.
drop policy if exists "Sito pubblico inserisce prenotazioni" on public.prenotazioni;

commit;
