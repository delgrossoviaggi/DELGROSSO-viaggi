# DELGROSSO GESTIONALE V48 — Stability Release

## Obiettivo
Rendere tutti i moduli del Gestionale raggiungibili, coerenti e resilienti su desktop, tablet e smartphone.

## Moduli inclusi
Dashboard, Viaggi, Prenotazioni, Clienti, Flotta, Pagamenti, Archivio, Preventivi, CHECK-IN, Notifiche, Statistiche, Centro Operativo, Noleggi Bus, Impostazioni.

## Fix V48
- fallback menu completo anche nella sidebar legacy della Dashboard;
- Noleggi Bus sempre raggiungibile dal menu;
- selezione multipla dei bus, inclusi 2+ GT nello stesso noleggio;
- recupero assegnazioni bus in caso di errore durante il salvataggio;
- guard globale per errori JS e promise non gestite;
- protezione da doppio submit dei form;
- registrazione/aggiornamento Service Worker con `updateViaCache: none`;
- Service Worker network-first per HTML/CSS/JS con cache solo come fallback;
- responsive già presente mantenuto e rafforzato;
- controlli statici eseguiti: riferimenti locali mancanti = 0; errori sintattici JS = 0.

## Nota sicurezza
L'audit Supabase rileva ancora policy anon permissive sulle tabelle gestionali, incluso `impostazioni`. Non sono state irrigidite automaticamente perché l'autenticazione attuale del frontend usa una sessione locale e una modifica RLS non coordinata bloccherebbe le operazioni. La messa in sicurezza completa richiede il passaggio dell'autenticazione applicativa a Supabase Auth/ruoli o RPC autorizzate.
