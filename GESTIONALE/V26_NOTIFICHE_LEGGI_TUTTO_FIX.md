# V26 — FIX NOTIFICHE “LEGGI TUTTO”

Correzione del pannello notifiche della Dashboard.

## Problema
Il pulsante “LEGGI TUTTO” marcava come lette le notifiche persistenti, ma gli alert operativi della Dashboard venivano rigenerati dal sistema ad ogni sincronizzazione/polling. Dopo alcuni secondi potevano quindi ricomparire.

## Correzione
- “LEGGI TUTTO” salva localmente il momento fino al quale le notifiche sono state lette.
- Dashboard e badge filtrano gli alert già letti.
- Il filtro viene riapplicato anche dopo refresh, focus, realtime e polling.
- Le nuove notifiche con data successiva al momento della lettura continuano a comparire.
- La tabella `public.notifiche` e la stessa Supabase restano invariate: non viene creato un nuovo database.

## Test consigliato
1. Aprire Dashboard.
2. Aprire la tendina 🔔.
3. Premere “LEGGI TUTTO”.
4. Attendere almeno 30–60 secondi.
5. Chiudere e riaprire la tendina.
6. Ricaricare la pagina.
7. Le vecchie notifiche devono restare assenti.
8. Creare una nuova prenotazione/notifica: deve comparire come nuova.
