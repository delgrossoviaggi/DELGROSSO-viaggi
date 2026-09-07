-- DELGROSSO GESTIONALE V4.8 - schema alignment for stable client/booking editing
-- Safe: only adds nullable/defaulted columns; existing data is preserved.

alter table public.clienti
  add column if not exists codice_cliente text,
  add column if not exists data_nascita date,
  add column if not exists stato_cliente text default 'Attivo',
  add column if not exists provenienza text;

update public.clienti
set stato_cliente = coalesce(nullif(stato_cliente, ''), 'Attivo')
where stato_cliente is null or stato_cliente = '';

alter table public.prenotazioni
  add column if not exists data_prenotazione date;

update public.prenotazioni
set data_prenotazione = coalesce(data_prenotazione, (created_at at time zone 'Europe/Rome')::date)
where data_prenotazione is null;
