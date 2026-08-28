# Integrazione prenotazioni – DELGROSSO Viaggi

## Flusso operativo
1. Il cliente effettua una prenotazione.
2. La prenotazione viene salvata nel gestionale.
3. L'email al cliente resta automatica tramite il modulo Aruba.
4. Il messaggio WhatsApp è MANUALE: l'operatore apre WhatsApp dal pulsante della prenotazione e preme Invia.
5. Il messaggio informa il cliente che la prenotazione è confermata e che riepilogo + QR Code sono stati inviati via email.

## Sicurezza
Non inserire mai la password della casella `prenotazioni@delgrossoviaggi.it` nel codice o nel repository GitHub.
Le credenziali SMTP devono essere configurate come variabili d'ambiente/server-side.

## Nota
Il modulo `email-aruba` contiene il materiale di configurazione già fornito; non modificare le credenziali direttamente nel frontend.
