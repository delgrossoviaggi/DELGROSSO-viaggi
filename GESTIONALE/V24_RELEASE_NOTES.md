# Gestionale V24 — Mobile + Ricevute + Push

## Mobile iPhone
- Layout mobile-first per tutte le pagine principali.
- Form e pulsanti touch-friendly, safe-area iPhone, modali scrollabili e tabelle orizzontali.
- Registrazione Acconto/Saldo resa più semplice su iPhone 17 Pro.

## Ricevute Acconto / Saldo
- Ogni nuovo Acconto o Saldo genera una ricevuta PDF distinta.
- La ricevuta contiene partecipante, viaggio, quota totale, importo ricevuto, totale pagato, residuo, metodo e data.
- La copia PDF viene archiviata nel bucket `ricevute-prenotazioni` e il movimento conserva il riferimento.
- Il gestionale mostra il pulsante `Ricevuta PDF` nello storico.
- Il fascicolo cliente può mostrare le ricevute archiviate.
- L'invio email usa le impostazioni SMTP già presenti in Gestionale > Impostazioni > Comunicazione.

## Push iPhone
- Service Worker cache-bust V24.
- La sottoscrizione viene rigenerata con la chiave VAPID pubblica configurata nel client.
- Il server deve usare la chiave privata corrispondente alla stessa identica chiave pubblica.

## Supabase
Applicare `supabase/migrations/20260902_payment_receipts_v24.sql` e pubblicare `supabase/functions/send-payment-receipt`.
