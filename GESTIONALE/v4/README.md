# DELGROSSO VIAGGI 4.0 ULTIMATE — Staging di ricostruzione

**Ramo:** `build/dg4-rebuild-20261117` (separato dalla produzione). **Entrata:** `GESTIONALE/v4/index.html`.

## Cosa esiste realmente in questa build
- **Login operatore Nicola/Raffaele**: Edge Function `dg2-operator-login` + verifica Supabase Auth `/auth/v1/user` + `is_gestionale_admin` + operatore attivo. Non si memorizzano password; JWT in `sessionStorage` per scheda, logout con revoca best effort.
- **Dashboard**: prossime partenze, posti occupati dai registri, pagamenti, saldo stimato, agenda e notifiche.
- **Viaggi**: elenco e dettaglio, BUS BIS indipendente, stato pubblicazione e capienza ricostruita dal registro prenotazioni.
- **Prenotazioni**: ricerche, filtro viaggio, esclusione cancellate, fermate, check-in, estratto CSV e pagamento collegato.
- **Control Room**: legge `dg28_trip_layouts.configurazione.rows[].cells`, non inventa sedili quando manca una piantina; sovrappone i posti di `prenotazione_posti` e `prenotazioni.posti_selezionati`. Lista autista stampabile/PDF da browser, numeri contatto per uso interno.
- **Piantine**: lettura schemi ufficiali e libreria. Editor **di bozza locale** per GT53/GT57/GT63 con numerazione automatica, modifica celle, esportazione file JSON. Non salva sul database o sul sito finché il backup non è verificato.
- **Cassa Nicola/Raffaele**: vista `dg_cassa_operatori`, registro pagamenti e trasferimenti, CSV.
- **Economia**: `economia_movimenti` e vista redditività viaggi, non ricalcola entrate e uscite con dati inventati.
- **Clienti, noleggi autobus, agenda, flotta GT, documenti, notifiche, diagnostica**: consultazione reale tramite sessione autorizzata.
- **Prestazioni**: caricamento per modulo, cache 25s solo memoria, paginazione REST, GET retry limitato per 502/503/504/429, NO polling in background delle notifiche; POST e modifiche non ripetute automaticamente per evitare duplicazioni.

## Sicurezza e limitazioni esplicite
`core.js` mantiene `WRITES_ENABLED=false`. Le funzioni di scrittura sono predisposte (RPC protette per pagamento, trasferimenti, spostamento posti e CRUD), **ma non sono abilitate**, non provate con dati reali e non vanno considerate operative. Questa è una V4 **alpha read-only**, non un gestionale 4.0 completato al 100%. L'editor piantine produce bozze locali ma **non modifica le piantine Supabase**.

Rilascio vietato senza:
1. Snapshot gestito Supabase verificato con restore possibile, database e Auth.
2. Export fisico di tutti i file Storage (censiti: 493 oggetti tra i due progetti) e verifica SHA256.
3. Restore di prova su staging separato e senza notifiche/invii ai clienti.
4. Test con operatori autorizzati su login, RLS, viaggi, controllo posti, pagamenti, ricevute, contabilità e PDF iOS.
5. Test di creazione/modifica/pubblicazione piantine, inclusa sincronizzazione del sito e verifica di rollback.
6. Revisione delle RPC che aggiornano il database (idempotenza, vincoli, permessi).
7. Analisi dei bug già noti (28 prenotazioni senza seat rows, informazioni di pagamento non riconciliate, PGRST003).
8. Approvazione esplicita dell'uso produttivo.

## Prove già svolte
- Parsing sintattico della build `core.js` / `app.js` e delle viste.
- Rendering mock **14/14** moduli con schema fake di viaggio/prenotazione.
- Controllo posti annullati esclusi dall'occupazione.
- Verifica editor automatico GT53, GT57, GT63 e rigenerazione numerazione.
- Conferma scritture bloccate e nessuna credenziale privilegiata nel codice.
- Vercel ha creato una preview `READY`, **non certificata con login end-to-end reale**. Preview eventualmente soggetta a protezione SSO.

## Come accedere
Su una preview Vercel del ramo `build/dg4-rebuild-20261117`, raggiungere `/GESTIONALE/v4/`. Se Vercel richiede autenticazione SSO, accedere al proprio team Vercel. In seguito utilizzare **l'utente aziendale esistente**. Non scrivere password in chat e non utilizzare un account di terzi.

## Destinazione produzione
Non modificare `main`, Supabase e sito pubblico prima del ripristino di prova e dei test. Il sito continua a utilizzare il proprio bridge Supabase esistente.

Riferimento diagnostico e backup: `docs/DELGROSSO-4.0-BACKUP-INVENTARIO-20261117.md`.
