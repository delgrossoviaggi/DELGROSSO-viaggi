INTEGRAZIONE EMAIL AUTOMATICA PRENOTAZIONI

Questo pacchetto collega il modulo Prenotazione alla Edge Function Supabase:
send-booking-confirmation

Flusso:
prenotazione salvata -> PDF/QR generato -> Edge Function -> SMTP Aruba -> email al cliente con PDF allegato.

IMPORTANTE:
La Edge Function attualmente deve essere invocabile dal gestionale. Se in Supabase
Settings della funzione "Verify JWT with legacy secret" è attivo, una chiamata dal
gestionale con autenticazione locale (localStorage) non possiede un JWT Supabase.
Per questa integrazione, disattivare "Verify JWT with legacy secret" sulla funzione
send-booking-confirmation, quindi salvare.

I Secrets SMTP restano quelli già configurati in Supabase e NON vanno inseriti nel codice.

WhatsApp resta manuale tramite il flusso già presente nel gestionale.

NON modificare la cartella supabase del progetto.
NON modificare la generazione del PDF/QR.
