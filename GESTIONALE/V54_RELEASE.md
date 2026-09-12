# DELGROSSO GESTIONALE V54 — EXECUTIVE
Data: 10 settembre 2026

## Obiettivo
Rendere il Gestionale più fluido, coerente, veloce da usare e pienamente centrato sul progetto Supabase `chkuayhbmitdmzmmvona`.

## UI
- Nuova shell globale V54 con menu laterale, top bar, stato Supabase e azione rapida.
- Menu mobile con drawer e barra di navigazione inferiore.
- Layout responsive per desktop, tablet e smartphone/iPhone.
- Nuovo banner/brand del menu basato sul logo reale fornito.
- Login con logo Del Grosso Viaggi sempre visibile.
- Il contenuto funzionale dei moduli esistenti viene mantenuto: Viaggi, Prenotazioni, Clienti, Flotta, Pagamenti, Preventivi, Archivio, Check-in, Notifiche, Statistiche, Centro Operativo, Noleggi Bus e Impostazioni.

## Supabase
Il layer centrale mantiene il publishable key nel browser e non usa service/secret key.
Tabelle operative sincronizzate: viaggi, prenotazioni, clienti, flotta, pagamenti, preventivi, noleggi bus, mezzi noleggi, pagamenti noleggi, notifiche, check-in, attività e scadenze.
La sincronizzazione usa pull paginato, eventi Realtime, stato online/offline e coda solo per errori transitori di rete/server.

## Performance
- Nessun nuovo polling pesante per le pagine.
- Shell CSS/JS leggera e condivisa.
- Service worker aggiornato a V54 con cache invalidation.
- Gli indici Supabase già presenti per le tabelle operative sono preservati.
