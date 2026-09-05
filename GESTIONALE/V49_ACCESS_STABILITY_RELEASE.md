# DELGROSSO GESTIONALE V4.9 — ACCESS & STABILITY

## Correzioni
- Connessione Supabase del Gestionale fissata alla configurazione compilata del progetto, evitando override locali obsoleti.
- Supabase client senza ripristino automatico di sessioni Auth estranee al login locale del Gestionale.
- RLS aggiunto anche al ruolo `authenticated` per clienti, prenotazioni, viaggi, preventivi e impostazioni.
- Flusso nuova prenotazione: creazione/recupero cliente eseguito dentro la transazione applicativa con rollback corretto.
- Cache Service Worker portata a V49 per forzare il rinnovo degli asset.
- DB V48 già applicato; DB V49 access policy applicato.

## Verifiche
- Inserimento cliente diretto su PostgreSQL: OK (test rollback).
- Inserimento prenotazione diretto su PostgreSQL: OK (test rollback).
- Inserimento con ruolo `authenticated`: OK (test rollback).
- JavaScript: `node --check` su tutti i file JS: OK.
