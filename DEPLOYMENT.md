# Deployment

1. Root del repository = sito pubblico.
2. `/GESTIONALE/` = Gestionale.
3. Le Edge Functions presenti in `/GESTIONALE/supabase/functions/` sono il codice corrente per documenti, ricevute e push.
4. Non eseguire migrazioni già applicate solo per effettuare il deploy statico.
5. Non inserire chiavi private, password SMTP o VAPID private nel repository.
