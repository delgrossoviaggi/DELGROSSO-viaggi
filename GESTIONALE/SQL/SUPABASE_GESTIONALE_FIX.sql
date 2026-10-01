-- DELGROSSO VIAGGI - patch prudente Supabase Gestionale
-- Progetto: chkuayhbmitdmzmmvona
-- Data: 2026-10-01
--
-- NOTA:
-- I tre indici seguenti risultano gia' applicati al database live.
-- Il file serve anche a mantenere GitHub allineato con Supabase.
-- CREATE INDEX IF NOT EXISTS rende comunque l'esecuzione idempotente.

create index if not exists assistente_eventi_prenotazione_id_idx
  on public.assistente_eventi(prenotazione_id);

create index if not exists assistente_eventi_viaggio_id_idx
  on public.assistente_eventi(viaggio_id);

create index if not exists noleggi_bus_flotta_id_idx
  on public.noleggi_bus(flotta_id);

-- IMPORTANTE:
-- Non vengono modificati automaticamente i permessi SECURITY DEFINER.
-- La bonifica dei privilegi va eseguita solo dopo aver verificato quali RPC
-- sono chiamate dalla Edge Function gestionale-bridge e dal gestionale autenticato.
