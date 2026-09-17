# Audit tecnico DELGROSSO Gestionale V48

Data: 2026-09-09

## Esito statico
- Pagine HTML: 18
- File JavaScript: 51
- File CSS: 34
- Riferimenti locali mancanti: 0
- Errori sintattici JavaScript: 0
- Service Worker: aggiornato a V48, cache network-first per evitare asset vecchi dopo deploy

## Moduli verificati nel pacchetto
- Dashboard
- Viaggi
- Prenotazioni
- Nuova prenotazione
- Clienti
- Flotta
- Pagamenti
- Archivio
- Preventivi
- Nuovo preventivo
- CHECK-IN
- Notifiche
- Statistiche
- Centro Operativo
- Noleggi Bus
- Impostazioni

## Noleggi Bus
- Selezione multipla dei mezzi.
- Supporto esplicito a 2 o più Bus GT nello stesso noleggio.
- Mezzi caricati dinamicamente dalla tabella flotta.
- Controllo conflitti per mezzo e intervallo temporale.
- Recupero delle assegnazioni precedenti se l'inserimento delle relazioni fallisce.

## Supabase rilevato
Tabelle gestionali presenti: accessi_checkin, archivio_documenti, attivita_gestionale, clienti, dashboard_operativa, flotta, impostazioni, noleggi_bus, noleggi_bus_mezzi, noleggi_bus_pagamenti, notifiche, pagamenti, passeggeri, prenotazioni, preventivi, push_subscriptions, scadenze_gestionale, statistiche, viaggi.

Dati presenti al momento dell'audit: 22 clienti, 5 mezzi, 23 prenotazioni, 7 viaggi, 1 noleggio bus con 2 assegnazioni mezzo. Il noleggio esistente non è stato modificato o cancellato.

## Sicurezza: criticità ancora aperta
L'audit RLS mostra policy anon permissive (`ALL` con `true`) su diverse tabelle gestionali, incluso `impostazioni`. Questa configurazione è incompatibile con una vera protezione dei dati se si continua a usare l'autenticazione locale del browser. Non è stata modificata automaticamente in V48 perché irrigidire le policy senza migrare il frontend a Supabase Auth/RPC autorizzate bloccherebbe le funzioni attuali.

## Autenticazione: criticità architetturale
Il modulo attuale di login usa credenziali e sessione lato client/localStorage. Questo è funzionale per l'uso attuale ma non costituisce autenticazione server-side sicura. La correzione definitiva richiede Supabase Auth + ruoli/claims e RLS basate sull'identità autenticata.
