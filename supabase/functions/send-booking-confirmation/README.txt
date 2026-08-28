SEND-BOOKING-CONFIRMATION — FILE COMPLETO
===========================================

QUESTA FUNZIONE INVIA AUTOMATICAMENTE AL CLIENTE:
- email di conferma;
- riepilogo della prenotazione;
- PDF già generato dal gestionale;
- QR Code già presente nel PDF.

WHATSAPP RESTA MANUALE, COME DECISO.

PERCORSO NEL PROGETTO:
supabase/functions/send-booking-confirmation/index.ts

SECRETS SUPABASE DA CREARE:
SMTP_HOST=smtps.aruba.it
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USERNAME=prenotazioni@delgrossoviaggi.it
SMTP_PASSWORD=LA_PASSWORD_DELLA_CASELLA_ARUBA
SMTP_FROM_EMAIL=prenotazioni@delgrossoviaggi.it
SMTP_FROM_NAME=PRENOTAZIONI DELGROSSO VIAGGI
SMTP_REPLY_TO=prenotazioni@delgrossoviaggi.it

NON INSERIRE MAI LA PASSWORD NEL CODICE O SU GITHUB.

DEPLOY:
Da Supabase > Edge Functions creare/aggiornare la funzione
send-booking-confirmation e incollare il contenuto di index.ts.

ENDPOINT:
https://<PROJECT-REF>.supabase.co/functions/v1/send-booking-confirmation

PAYLOAD ATTESO:
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

IMPORTANTE:
- Il frontend/gestionale deve generare il PDF e convertirlo in Base64.
- La funzione NON rigenera il QR Code.
- La prenotazione NON deve essere cancellata se l'email fallisce.
- WhatsApp resta manuale.
- Non modificare la cartella GESTIONALE durante questo passaggio se stai usando il deploy diretto da Supabase.
