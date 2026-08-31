# 🔔 Notifiche nuove prenotazioni su iPhone

La V11 prepara il gestionale come Web App iPhone e registra il dispositivo per Web Push.
Su iOS/iPadOS il Web Push funziona per le web app aggiunte alla schermata Home. Safari da solo non è sufficiente per ricevere push in background.

## 1. Pubblicazione del gestionale

Pubblica il contenuto di `GESTIONALE/` su:

`https://www.delgrossoviaggi.it/GESTIONALE/`

Non cambiare maiuscole/minuscole del percorso `GESTIONALE`.

## 2. Supabase: tabella

Apri SQL Editor del progetto `chkuayhbmitdmzmmvona` ed esegui:

`supabase/migrations/20260831_push_notifications.sql`

## 3. VAPID

La chiave pubblica è già incorporata nel client.
La chiave privata NON deve essere messa nel sito.

Configura questi secrets nella Edge Function `send-booking-push`:

- `VAPID_PUBLIC_KEY` = chiave pubblica presente in `push-notifications.js`
- `VAPID_PRIVATE_KEY` = chiave privata generata separatamente e custodita nei secrets Supabase
- `VAPID_SUBJECT` = `mailto:info@delgrossoviaggi.it`
- `PUSH_WEBHOOK_SECRET` = una stringa segreta a tua scelta

## 4. Deploy Edge Function

Deploy:

`supabase functions deploy send-booking-push`

## 5. Database Webhook

Nel progetto Supabase crea un Database Webhook:

- Table: `public.prenotazioni`
- Event: `INSERT`
- Destination: Edge Function `send-booking-push`
- Method: `POST`
- Header `Content-Type: application/json`
- Header `x-push-webhook-secret`: lo stesso valore di `PUSH_WEBHOOK_SECRET`

Il webhook viene eseguito dopo l'inserimento della prenotazione e invia il push a tutti i dispositivi registrati.

## 6. iPhone

1. Apri `https://www.delgrossoviaggi.it/GESTIONALE/login.html` in Safari.
2. Accedi al gestionale.
3. Usa **Condividi → Aggiungi alla schermata Home**.
4. Apri il gestionale dalla nuova icona Home.
5. Nella Dashboard premi **🔔 Attiva notifiche iPhone**.
6. Consenti le notifiche.

Dopo questo passaggio una nuova riga inserita in `prenotazioni` farà partire il push anche con il gestionale non aperto.
