-- V158 BATCH 1: idempotenza prenotazioni pubbliche
-- Progetto: gestionale (chkuayhbmitdmzmmvona)

alter table public.prenotazioni
  add column if not exists request_id text;

create unique index if not exists ux_prenotazioni_request_id
  on public.prenotazioni(request_id)
  where request_id is not null;

-- La funzione create_public_booking_v2 è stata applicata direttamente al progetto.
-- Questo file documenta la migration applicata; non rieseguire alla cieca se la funzione esiste già.
