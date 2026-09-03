# V1 — Notifica automatica prenotazione

Implementato sul sito pubblico:

- email del cliente facoltativa;
- token univoco per il link di conferma;
- pagina pubblica `conferma.html` protetta da token;
- chiamata alla Edge Function dopo il salvataggio della prenotazione;
- tentativo WhatsApp automatico tramite Twilio Content Template;
- fallback SMS automatico se WhatsApp non viene accettato;
- stato e SID del messaggio salvati nella tabella `prenotazioni`;
- nessuna credenziale Twilio nel browser.

Il servizio richiede configurazione Twilio e deploy della Edge Function prima dell'invio reale.
