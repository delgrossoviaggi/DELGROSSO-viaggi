# DELGROSSO GESTIONALE V53 — VIAGGI SUPABASE FIX

## Problema corretto
La pagina Gestione Viaggi del pacchetto V52 utilizzava il servizio viaggi già esistente in parallelo al nuovo layer centrale. La pagina V53 ora interroga direttamente il client Supabase centrale configurato sul progetto Gestionale:
`https://chkuayhbmitdmzmmvona.supabase.co`

## Comportamento
- Carica tutti i record da `public.viaggi` senza filtri impliciti.
- Mantiene ordinamento per data/ora di partenza.
- Mostra `id_viaggio` (DG-V-XXXXXXXX) quando presente.
- Mantiene modifica, creazione ed eliminazione.
- Carica dinamicamente la flotta da `public.flotta`.
- Aggiorna la tabella su eventi Realtime e quando torna online.
- Mantiene il layer centrale `dg-supabase-sync-v2.js`.

## Verifica database
Il progetto Supabase contiene attualmente 7 viaggi nella tabella `public.viaggi`.
La richiesta di aggiunta a `supabase_realtime` non è stata applicata perché Supabase ha restituito che `viaggi` è già membro della publication `supabase_realtime`.
