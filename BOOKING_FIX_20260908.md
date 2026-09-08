# DELGROSSO — Fix prenotazione pubblica 2026-09-08

- Il flusso pubblico continua a usare esclusivamente il Supabase Gestionale `chkuayhbmitdmzmmvona.supabase.co`.
- La lettura della flotta è stata resa opzionale nella pagina pubblica: eventuali RLS sulla tabella `flotta` non bloccano più il booking.
- Il layout dei posti continua a usare il bus esatto presente nel viaggio quando la flotta non è leggibile pubblicamente.
- La risposta della RPC `create_public_booking` viene normalizzata per compatibilità con risposte oggetto/array e con gli identificativi `id`, `booking_id`, `prenotazione_id`, `id_prenotazione`.
- Gli errori della RPC vengono propagati senza nasconderli.
