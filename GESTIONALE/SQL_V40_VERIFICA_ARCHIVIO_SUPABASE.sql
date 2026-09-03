-- V40: verifica finale dell'Archivio sulla stessa sorgente Supabase.
-- Non crea tabelle e non duplica documenti.
select count(*) as documenti_archiviati from public.archivio_documenti;
select * from public.archivio_documenti order by data_documento desc nulls last limit 20;
