# DELGROSSO GESTIONALE V59 — SUPABASE AUTH FIRST

## Obiettivo
Versione ricostruita per usare il progetto Supabase del Gestionale come fonte operativa e Supabase Auth come autenticazione reale.

## Correzioni
- Central client `dg-supabase-sync-v4.js` con sessione Supabase persistente.
- Login Nicola/Raffaele tramite Supabase Auth.
- Entrambi gli account sono amministratori applicativi.
- Modulo Viaggi usa una sessione autenticata e può leggere tutti i viaggi consentiti dalla policy `authenticated`.
- Rimossi i vecchi layer sync v2/v3 dal pacchetto per evitare collisioni/caching.
- Service Worker V59.
- Procedura `setup-amministratori.html` per creare i due account Auth se non esistono ancora.

## Stato Supabase verificato
Il database contiene 7 viaggi, 24 prenotazioni, 23 clienti, 5 mezzi, 1 noleggio bus e 1 pagamento.
Nel momento della verifica `auth.users` non conteneva ancora gli account Nicola/Raffaele: per questo la prima configurazione Auth è necessaria.

## Nota sicurezza
Non sono state aggiunte policy anonime per esporre i dati gestionali. Il browser usa esclusivamente la publishable key; l'accesso completo deve avvenire con un JWT Supabase Auth. Supabase indica che la publishable key è soggetta a RLS e che le secret/service-role key non devono mai essere esposte nel browser.
