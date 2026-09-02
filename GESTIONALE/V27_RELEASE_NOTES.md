# DELGROSSO GESTIONALE V27 — DOCUMENTI COMPLETI

## Obiettivo
Chiudere il flusso documentale dopo la registrazione di Acconto/Saldo e allineare la conferma prenotazione alla Edge Function realmente deployata.

## Modifiche
- Dopo un nuovo Acconto/Saldo dal modulo Prenotazioni viene generata e archiviata la ricevuta PDF.
- Se la prenotazione non possiede ancora `confirmation_storage_path`, viene generata e archiviata anche la conferma prenotazione.
- `bookingDocumentsService-v25.js` usa `send-booking-confirmation` (nome della funzione presente in Supabase).
- `send-booking-confirmation` ora archivia il PDF nel bucket `ricevute-prenotazioni`, invia la conferma al cliente e invia un avviso interno a `info@delgrossoviaggi.it` e `prenotazioni@delgrossoviaggi.it`.
- SMTP della conferma viene letto direttamente dalle colonne di `public.impostazioni`: `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_username`, `smtp_password`, `smtp_from_name`, `smtp_from_email`, `smtp_reply_to`.
- `send-booking-confirmation/config.toml` imposta `verify_jwt = false`.
- Anche il modulo Pagamenti verifica/genera la conferma prenotazione dopo un nuovo Acconto/Saldo.
- Service Worker aggiornato a V27 per evitare cache del vecchio JavaScript.

## Deploy Supabase necessario
1. Deployare `supabase/functions/send-booking-confirmation/index.ts` come Edge Function `send-booking-confirmation`.
2. Verificare che il bucket privato `ricevute-prenotazioni` esista.
3. `send-payment-receipt` deve essere già deployata con la versione corretta che legge SMTP da `public.impostazioni`.
