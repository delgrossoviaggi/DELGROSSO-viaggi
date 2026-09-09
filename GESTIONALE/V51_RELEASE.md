# DELGROSSO Gestionale V51 — Ricevute Noleggi Bus

## Funzionalità
- Ogni pagamento di un Noleggio Bus può essere registrato come **Acconto** o **Saldo**.
- Alla registrazione viene generata una **ricevuta PDF** con numero univoco `DG-NB-XXXXXXXX`.
- La ricevuta viene archiviata nel bucket `ricevute-prenotazioni`, percorso `noleggi-bus/`.
- Se il cliente ha una email valida, la ricevuta viene inviata automaticamente via email.
- Se l'email non è disponibile o SMTP non è configurato, la ricevuta resta comunque archiviata.
- Nel pannello Pagamenti del noleggio sono disponibili apertura PDF e reinvio email.
- L'Archivio Gestionale include anche le ricevute dei Noleggi Bus, sia acconti sia saldi.
- Restano disponibili tutte le funzioni precedenti: più bus GT nello stesso noleggio, dashboard e statistiche.

## Database
Migration live: `20260909_noleggi_bus_ricevute`.
La tabella `noleggi_bus_pagamenti` conserva numero ricevuta, percorso PDF, timestamp generazione e stato email.

## Edge Function
`send-noleggio-payment-receipt` — ACTIVE, JWT required.

## Nota operativa
Il noleggio esistente non viene cancellato né alterato automaticamente. I nuovi pagamenti generano la relativa ricevuta; gli eventuali acconti storici privi di riga pagamento non vengono inventati o duplicati.
