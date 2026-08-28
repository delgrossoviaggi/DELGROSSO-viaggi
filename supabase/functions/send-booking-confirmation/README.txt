SEND-BOOKING-CONFIRMATION
==========================

Questa è la Supabase Edge Function prevista dal progetto per inviare al cliente
la ricevuta PDF già generata dal frontend, con il QR Code già presente.

FILE:
supabase/functions/send-booking-confirmation/index.ts

SECRET DA IMPOSTARE NEL PROGETTO SUPABASE:
SMTP_HOST=smtps.aruba.it
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USERNAME=prenotazioni@delgrossoviaggi.it
SMTP_PASSWORD=LA_PASSWORD_DELLA_CASELLA_ARUBA
SMTP_FROM_EMAIL=prenotazioni@delgrossoviaggi.it
SMTP_FROM_NAME=PRENOTAZIONI DELGROSSO VIAGGI
SMTP_REPLY_TO=prenotazioni@delgrossoviaggi.it

IMPORTANTE:
La configurazione SMTP in Authentication > Emails > SMTP Settings riguarda
le email di autenticazione Supabase. Per questa Edge Function i secret
SMTP_* devono essere disponibili nella funzione.

DEPLOY:
supabase functions deploy send-booking-confirmation

ENDPOINT:
https://<PROJECT-REF>.supabase.co/functions/v1/send-booking-confirmation

PAYLOAD:
{
  "booking": {
    "id": "...",
    "codice": "...",
    "nome": "...",
    "cognome": "...",
    "telefono": "...",
    "email": "cliente@example.com",
    "posti": 2,
    "posti_selezionati": "12,13",
    "totale": 60
  },
  "trip": {
    "id": "...",
    "titolo": "...",
    "destinazione": "...",
    "data_partenza": "...",
    "ora_partenza": "...",
    "luogo_partenza": "..."
  },
  "pdfBase64": "...",
  "pdfFilename": "Ricevuta_Prenotazione_ABC123.pdf"
}

NON modificare qrBookingUtils e non rigenerare il QR.
Il frontend deve generare il PDF esistente, convertirlo in Base64 e chiamare
questa funzione. Se l'invio email fallisce, la prenotazione NON va cancellata.
WhatsApp resta manuale come deciso.
