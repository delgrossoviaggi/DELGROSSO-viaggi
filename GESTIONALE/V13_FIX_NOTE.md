# V13 — fix finali gestionale

- Logo: asset duplicato in `/GESTIONALE/assets/logo-sidebar.png`; fallback runtime corretto; login usa logo reale.
- Layout: `assets/dg-universal-v13.css` caricato come ultimo CSS su tutte le pagine interne; shell desktop/mobile uniformata.
- Menu touch: sidebar mobile coerente e link con target touch adeguato.
- Notifiche: drawer indipendente dal layout; `Segna tutte come lette` aggiorna il badge/UI e conserva il fingerprint delle notifiche visualizzate.
- Push: il frontend distingue il 404 della tabella `push_subscriptions`; per push reali va applicata la migration Supabase `supabase/migrations/20260831_push_notifications.sql` e distribuita la funzione Edge.
- Service Worker: cache V13 per evitare asset/cache V12 obsoleti.
