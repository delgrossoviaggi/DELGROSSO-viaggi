DELGROSSO VIAGGI
EMAIL PRENOTAZIONI - ARUBA + QR

COSA CONTIENE
1. api/send-booking-email.js
   Endpoint server-side Vercel che invia la mail al cliente tramite Aruba.
2. src/services/sendBookingConfirmationEmail.js
   Funzione frontend da chiamare dopo la conferma della prenotazione.
3. package-addition.txt
   Dipendenza necessaria.

CONFIGURAZIONE ARUBA GIÀ IMPOSTATA NEL CODICE
SMTP server: smtps.aruba.it
Porta: 465
SSL: true
Username: prenotazioni@delgrossoviaggi.it
From: prenotazioni@delgrossoviaggi.it

UNICO DATO CHE NON PUÒ ESSERE INSERITO NEL CODICE
La password della casella email.
Va inserita in Vercel:
ARUBA_EMAIL_PASSWORD = [PASSWORD DELLA CASELLA]

IMPORTANTE
NON inserire la password in HTML, JavaScript frontend, GitHub o repository pubblico.

FLUSSO FINALE
Cliente prenota sul sito
        ↓
Gestionale salva la prenotazione
        ↓
Gestionale genera il PDF con QR Code
        ↓
1) WhatsApp: arriva SOLO a Nicola una notifica sintetica
2) Email: parte da prenotazioni@delgrossoviaggi.it verso il cliente
        ↓
Email con ricevuta PDF + QR Code allegato

NOTA TECNICA
Il PDF/QR non viene rigenerato da questo modulo: viene riutilizzato quello già prodotto dal gestionale.

INSTALLAZIONE
- Copiare api/send-booking-email.js nella cartella api/ del repository.
- Copiare src/services/sendBookingConfirmationEmail.js nel progetto gestionale.
- Aggiungere nodemailer alle dipendenze del package.json.
- Impostare ARUBA_EMAIL_PASSWORD nelle Environment Variables di Vercel.
- Collegare la funzione al punto in cui la prenotazione viene confermata e il PDF QR è già disponibile.

NOMI CAMPI PAYLOAD
email
nome
viaggio
data
posti
totale
codicePrenotazione
pdfBase64
pdfFilename
