# DELGROSSO GESTIONALE V52 — SUPABASE CENTRAL SYNC

## Obiettivo
Centralizzare la connessione del Gestionale al progetto Supabase operativo:
`https://chkuayhbmitdmzmmvona.supabase.co`

## Cosa è stato fatto
- Aggiunto `assets/dg-supabase-sync-v2.js` come layer centrale.
- Integrato il layer in tutte le 17 pagine operative/autenticate del Gestionale; `login.html` resta volutamente escluso.
- Unico client Supabase browser-safe basato sulla publishable key.
- Health check e stato connessione.
- Sincronizzazione iniziale in background delle tabelle operative.
- Refresh automatico della tabella interessata quando arriva un evento Realtime.
- Coda offline per sole operazioni realmente transient/network.
- Retry automatico della coda.
- API centralizzata disponibile come `window.DG_SUPABASE_SYNC`.
- I moduli Noleggi Bus e statistiche Noleggi usano ora il client centrale invece di creare un client separato.
- Realtime abilitato sul database per le tabelle operative necessarie al sync.

## Tabelle sincronizzate
- viaggi
- prenotazioni
- clienti
- flotta
- pagamenti
- preventivi
- noleggi_bus
- noleggi_bus_mezzi
- noleggi_bus_pagamenti
- notifiche

## Sicurezza
Il file usa esclusivamente la publishable key. Non contiene né deve contenere `service_role` o altre chiavi segrete.
Il layer non bypassa RLS.

## Nota architetturale
La sincronizzazione centrale rende uniforme la connessione e il canale Realtime, ma non sostituisce automaticamente ogni funzione CRUD già presente nei singoli moduli. I moduli che possiedono logiche specifiche continuano a usare le proprie operazioni Supabase, ora con il client centrale dove già integrato.
