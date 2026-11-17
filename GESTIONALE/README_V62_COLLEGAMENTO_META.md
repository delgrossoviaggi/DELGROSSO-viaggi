# DELGROSSO Gestionale V62 — Collegamento Meta pronto per attivazione

## Stato verificato

- WhatsApp Business ufficiale: **+39 320 881 5899** (attualmente attivo nell'app Business).
- Sul progetto Vercel `delgrosso-viaggi` sono state rilevate solo le variabili VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e APPWRITE; **mancano le credenziali server Meta e Supabase**. Senza di esse il numero non è collegato al gestionale.
- La V62 non invia messaggi e non scrive prenotazioni automaticamente. Le notifiche in entrata possono essere ricevute solo dopo onboarding e sottoscrizione del webhook.

## 1 — Collegare il numero usando Meta Coexistence (se idoneo)

1. Aprire **Meta Business Manager** con un account amministratore dell'attività e accedere alla configurazione dell'account WhatsApp Business.
2. Verificare l'idoneità a **Coexistence / Embedded Signup** per conservare WhatsApp Business App con lo stesso numero. Non tentare una registrazione Cloud API ordinaria che comporti la disconnessione dell'app.
3. Autorizzare il numero ufficiale e verificare la titolarità attraverso il flusso Meta.
4. Ottenere l'identificativo **phone_number_id**, il token tecnico con permessi appropriati (server-side), l'App Secret e l'eventuale Business Account ID. **Non incollarli in chat o su GitHub.**
5. I gruppi già gestiti nell'app non sono sincronizzati via Cloud API; non si possono inserire automaticamente 40–60 clienti in un gruppo. Creare il gruppo nell'app e salvare il link d'invito in Gestione WhatsApp.

## 2 — Variabili d'ambiente private Vercel

Impostare nel progetto giusto (ambiente Preview per i test, poi Production):

| Chiave | Valore (solo nei segreti Vercel) |
|---|---|
| `WA_VERIFY_TOKEN` | stringa casuale, usata anche nella configurazione webhook Meta |
| `META_APP_SECRET` | segreto dell'app Meta |
| `WA_PHONE_NUMBER_ID` | ID del numero ufficiale attribuito da Meta |
| `META_WA_ACCESS_TOKEN` | token server con permesso WhatsApp Messaging |
| `SUPABASE_URL` | URL del progetto Supabase usato da DELGROSSO |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave segreta Supabase, server-side esclusivamente |
| `WA_TEMPLATE_CONFIRMATION` | nome template approvato per conferma |
| `WA_TEMPLATE_DEPOSIT` | nome template approvato per acconto |
| `WA_TEMPLATE_BALANCE` | nome template approvato per saldo |
| `META_GRAPH_VERSION` | versione API Graph supportata, opzionale |
| `WA_AUTOMATION_ENABLED` | `false` nei test iniziali; `true` soltanto dopo onboarding, approvazione template e collaudo con telefono di prova |

**Non usare la chiave service_role né il token Meta in JavaScript frontend, in un file .env committato o in un messaggio WhatsApp.**

## 3 — Webhook su Meta

- Callback URL: `https://<dominio-gestionale>/api/whatsapp/webhook` (solo HTTPS).
- Verify Token: lo stesso `WA_VERIFY_TOKEN`.
- Sottoscrivere il campo **messages**. Le richieste POST sono controllate con firma HMAC `X-Hub-Signature-256`.
- Il webhook scarta gli eventi di altri numeri, i duplicati e gli eventi non supportati. I messaggi validi entrano in `dg_whatsapp_inbox_v61` **Da esaminare**.
- Nessuna richiesta entrante crea automaticamente prenotazioni, posti o incassi.

## 4 — Template proposti a Meta (italiano)

I tre modelli ufficiali devono essere **approvati** da Meta prima dell'invio. Ognuno deve avere **4 parametri testuali in quest'ordine**:

**Conferma prenotazione** ({{1}} nome, {{2}} codice, {{3}} viaggio, {{4}} numero partecipanti):

> Gentile {{1}}, DELGROSSO VIAGGI conferma la prenotazione {{2}} per {{3}}. Partecipanti: {{4}}. Per ulteriori informazioni rispondi qui.

**Promemoria acconto** ({{1}} nome, {{2}} codice, {{3}} viaggio, {{4}} scadenza):

> Gentile {{1}}, per la prenotazione {{2}} relativa a {{3}} ti ricordiamo di verificare l'acconto entro {{4}}. Se hai già effettuato il versamento, rispondi qui per un controllo.

**Promemoria saldo** ({{1}} nome, {{2}} codice, {{3}} viaggio, {{4}} importo):

> Gentile {{1}}, per la prenotazione {{2}} relativa a {{3}} risulta un saldo di {{4}}. Se hai già pagato, ti chiediamo di contattarci per verificarlo.

Il servizio invia solo questi template, dopo conferma esplicita dell'operatore autenticato e dopo verifica del consenso registrato. Non invia PDF, non cancella posti e non apre chat di gruppo automaticamente.

## 5 — Modifiche e collaudo

- `api/whatsapp/webhook.js`: verifica firma Meta, numero e salva richieste; aggiorna esiti di consegna.
- `api/whatsapp/status.js`: espone solo la disponibilità booleana, mai token o dati privati.
- `api/whatsapp/send-template.js`: invio manuale server-side con autorizzazione, consenso, controlli prenotazione/pagamenti e chiave anti-duplicazione.
- `lib/whatsapp-auth.js`: controllo sessione Supabase per operatori amministratori.
- `setup/V62_whatsapp_outbound.sql`: tabella di audit **già creata** nel progetto Supabase collegato; NON eseguire una seconda migrazione indiscriminata.
- `dg62-whatsapp-cloud.js`: stato integrazione e pulsante invio, disabilitato in assenza dei segreti.
- `sw.js`: esclude le chiamate API dal caching iPhone.

**Test da completare in Preview Vercel, con un numero di prova autorizzato:** verifica challenge Meta, messaggio in entrata, richiesta da esaminare, approvazione manuale, invio di template, delivery status, revoca consenso e test di idempotenza.

## Limitazioni residue

La registrazione del numero sull'account Meta richiede l'accesso e l'approvazione del titolare. Le ricevute PDF richiedono un ulteriore flusso sicuro di generazione documenti e consegna, che NON è stato attivato. L'automazione degli acconti richiederà uno scheduler e controlli anti-duplicazione, che NON sono attivi; nessuna prenotazione viene eliminata automaticamente. La versione V62 è predisposta per l'attivazione, non è già connessa al numero ufficiale.
