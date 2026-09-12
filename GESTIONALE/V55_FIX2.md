# V55 Fix 2 — Viaggi visibili da Supabase

Correzione critica del layer centrale `dg-supabase-sync-v2.js`: rimossa una doppia dichiarazione di `isTransientError` che causava un errore JavaScript in caricamento (`Identifier 'isTransientError' has already been declared`).

L'errore impediva l'esecuzione del modulo Viaggi, per questo la pagina mostrava 0 statistiche e non visualizzava i 7 viaggi presenti in `public.viaggi`.

Il modulo `viaggi-v55-supabase.js` continua a leggere direttamente `public.viaggi` dal progetto Gestionale e mantiene realtime, ricerca, modifica, eliminazione e creazione.
