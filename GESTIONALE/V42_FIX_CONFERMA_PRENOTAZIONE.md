# V42 — Fix conferma prenotazione

Correzione mirata del flusso di creazione prenotazione del Gestionale.

## Comportamento

Quando viene creata una nuova prenotazione:

1. viene generato sempre il PDF di conferma localmente;
2. il PDF viene scaricato automaticamente sul dispositivo dell'operatore;
3. il PDF viene inviato alla Edge Function `send-booking-confirmation`;
4. la Edge Function archivia il PDF nel bucket privato `ricevute-prenotazioni`;
5. se l'email del cliente è presente e SMTP è configurato, viene inviata la conferma via email;
6. i metadati `confirmation_*` vengono aggiornati su `prenotazioni` e quindi la conferma entra nella vista `public.archivio_documenti`.

Il download locale avviene prima della chiamata di rete: se Supabase/Edge Function/SMTP ha un problema, l'operatore non perde comunque il PDF.

Non sono state introdotte nuove tabelle o database.
