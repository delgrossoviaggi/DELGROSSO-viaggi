# Push iPhone V24 — configurazione definitiva

Il client V24 usa questa chiave pubblica VAPID:

`BGYzb5phslgo0hOA61u4-BXteNGtEx-AbNKWno_oNpMI5y3HlwtZLeeJoTrx5cNJZTzeiQ1EpzyVyXpP27B-Xwo`

In Supabase Edge Function Secrets devono essere configurati:
- `VAPID_PUBLIC_KEY` = esattamente la chiave pubblica sopra
- `VAPID_PRIVATE_KEY` = la chiave privata generata insieme alla stessa coppia
- `VAPID_SUBJECT` = `mailto:info@delgrossoviaggi.it`

Importante: non inserire mai la chiave privata nel codice GitHub o nel gestionale.

Dopo aver aggiornato i secrets, sul server iPhone va eseguito una sola volta `Attiva notifiche`: V24 elimina la vecchia PushSubscription e ne crea una nuova con la chiave corrente.

Il precedente errore Apple `VapidPkHashMismatch` significa che la subscription iPhone e la coppia VAPID del server non erano abbinate. Il codice V24 forza il rinnovo della subscription, ma la coppia pubblica/privata Supabase deve comunque corrispondere.
