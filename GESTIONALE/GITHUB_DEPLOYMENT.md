# DELGROSSO Gestionale — pacchetto GitHub

Questa cartella va pubblicata nel repository GitHub `DELGROSSO-viaggi` come:

`/GESTIONALE/`

Il sito pubblico resta alla root del repository.

## Perché questa versione è GitHub-safe

- I percorsi del gestionale non usano più `/GESTIONALE/...` hardcoded: sono relativi alla cartella dell'app.
- Questo permette di funzionare sia con dominio personalizzato sia con GitHub Pages in una sottocartella del repository.
- Manifest e Service Worker calcolano dinamicamente il proprio scope.
- Le notifiche push usano la nuova VAPID Public Key configurata in Supabase.
- La VAPID Private Key non è presente nei file e deve restare solo nei Secrets Supabase.

## Aggiornamento

Sostituisci la cartella `GESTIONALE/` esistente con questa versione. Non copiare la cartella `supabase/` su GitHub Pages aspettandoti che venga eseguita dal sito: la Edge Function è già stata pubblicata nel progetto Supabase. La cartella `supabase/` è solo sorgente/versionamento.

## Dopo il push su GitHub

1. Attendi il completamento della pubblicazione GitHub Pages/Vercel.
2. Apri il gestionale dalla nuova URL.
3. Su iPhone, se usi Web App, rimuovi la vecchia icona dalla Home e aggiungi nuovamente il gestionale per ottenere il nuovo Service Worker/scope.
4. Premi `Attiva notifiche`.
5. Verifica in Supabase: `select * from public.push_subscriptions;`

## Sicurezza

Non inserire mai in GitHub `VAPID_PRIVATE_KEY`, `service_role` o altri secret.
