# V41 — Stability Release

## Problema corretto
La versione precedente di Prenotazioni includeva un enhancer basato su MutationObserver che riscriveva il tbody della tabella osservata. Questo poteva generare una cascata di mutazioni e saturare il browser, causando blocchi/crash percepiti del Gestionale.

## Soluzione
- Rimosso completamente l'enhancer MutationObserver di Prenotazioni.
- La tabella utilizza direttamente il renderer nativo del modulo Prenotazioni, che già produce codice leggibile, titolo/destinazione del viaggio e residuo.
- Un solo shell V41 per la navigazione.
- Archivio resta collegato alla vista Supabase `public.archivio_documenti`.
- Nessun cambio distruttivo al database.

## Verifiche
- JavaScript V41 shell: sintassi verificata.
- JavaScript Prenotazioni: sintassi verificata.
- Nessun riferimento HTML ai vecchi shell V40/V39/V38/V37/V36.
- Nessun riferimento all'enhancer Prenotazioni rimosso.
