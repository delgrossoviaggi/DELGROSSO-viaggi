# Del Grosso Gestionale V5.0.2 – Critical Booking Fix

## Critical bug fixed
La creazione di una nuova prenotazione costruiva il payload usando `d.nome` e `d.cognome` quando `d` era ancora `null`, prima di eseguire `St()`. Questo causava un errore JavaScript immediato e impediva qualsiasi nuova prenotazione.

È stato inoltre corretto il rollback per non generare un secondo errore quando il cliente non è ancora stato creato.

## Stability
- cache Service Worker aggiornata a V5.0.2;
- gestione cliente → prenotazione resa sequenziale;
- payload prenotazione costruito solo dopo la risoluzione del cliente;
- rollback cliente/occupazione protetto;
- mantenuti i fix V4.8/V4.9 già applicati a Supabase.
