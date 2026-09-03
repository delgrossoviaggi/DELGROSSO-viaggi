# Del Grosso Viaggi — WhatsApp automatico + SMS fallback

Questa versione aggiunge l'invio automatico della conferma della prenotazione al numero di telefono indicato dal cliente.

## Flusso

1. Il cliente completa la prenotazione sul sito.
2. Il sito crea un `confirmation_token` univoco.
3. La prenotazione viene salvata nel Gestionale/Supabase.
4. Il sito chiama la Edge Function `send-booking-notification`.
5. La funzione prova prima WhatsApp.
6. Se l'invio WhatsApp non viene accettato dall'API, prova automaticamente SMS.
7. L'esito viene registrato nella prenotazione.
8. Il messaggio contiene un link personale a `conferma.html`.

## Secret Supabase da configurare

Nel progetto Supabase: **Edge Functions → Secrets**.

Obbligatori:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_WHATSAPP_TEMPLATE_SID`
- `TWILIO_SMS_FROM` oppure `TWILIO_MESSAGING_SERVICE_SID`
- `PUBLIC_SITE_URL` = `https://www.delgrossoviaggi.it`

Non inserire mai `TWILIO_AUTH_TOKEN` nel codice del sito.

## Template WhatsApp

Creare in Twilio Content Template Builder un template di tipo utility/conferma prenotazione e farlo approvare per WhatsApp.

La funzione invia queste variabili:

- `{{1}}` = nome
- `{{2}}` = numero prenotazione
- `{{3}}` = destinazione
- `{{4}}` = data
- `{{5}}` = ora
- `{{6}}` = posto/i
- `{{7}}` = link conferma

Esempio di testo:

Ciao {{1}}, la tua prenotazione {{2}} è stata registrata.

Viaggio: {{3}}
Data: {{4}} - Ore: {{5}}
Posto: {{6}}

Consulta la tua conferma:
{{7}}

Del Grosso Viaggi & Limousine Bus

## SMS

L'SMS non richiede un template WhatsApp: viene usato come fallback se la richiesta WhatsApp non viene accettata.

## Deploy

1. Applicare `supabase/migrations/20260903000000_booking_notifications.sql`.
2. Deploy della funzione `supabase/functions/send-booking-notification`.
3. Configurare i secret sopra indicati.
4. Pubblicare il sito aggiornato.
5. Eseguire una prenotazione di prova con un numero reale autorizzato dal proprio account Twilio.

Per il primo test WhatsApp è possibile usare il Sandbox Twilio, secondo la configurazione prevista dal proprio account.
