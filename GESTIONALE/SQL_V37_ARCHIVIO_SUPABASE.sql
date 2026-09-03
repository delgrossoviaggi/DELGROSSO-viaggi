-- DELGROSSO VIAGGI V37
-- Rende la vista Archivio leggibile via PostgREST senza trasformarla in un secondo archivio.
-- La vista resta derivata da prenotazioni + pagamenti.

alter view public.archivio_documenti set (security_invoker = true);

grant usage on schema public to anon, authenticated;
grant select on public.archivio_documenti to anon, authenticated;

-- Verifica rapida
select count(*) as documenti_archiviati
from public.archivio_documenti;
