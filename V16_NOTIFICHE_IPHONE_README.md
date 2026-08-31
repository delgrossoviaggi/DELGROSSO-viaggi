# Gestionale V17 — Notifiche iPhone

Questa versione include il client Web Push, Service Worker aggiornato e migration Supabase per `push_subscriptions`.

## Attivazione
1. Eseguire `supabase/migrations/20260831_push_notifications.sql` nel SQL Editor del progetto Supabase del gestionale.
2. Pubblicare la Edge Function `supabase/functions/send-booking-push/index.ts`.
3. Configurare i secrets VAPID richiesti dalla funzione.
4. Su iPhone: aprire il gestionale in Safari, aggiungerlo alla schermata Home, aprire la Web App e premere **Attiva notifiche**.

Il 404 precedente era dovuto alla tabella REST `push_subscriptions` non disponibile sul database; il file SQL incluso crea tabella, indice, RLS e policy di inserimento.
