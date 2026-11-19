# DG83 — Sicurezza acconti e collegamento WhatsApp Business Cloud API

## Stato della consegna
- Patch locale pronta, **non pubblicata** e **non applicata** ai database Supabase. Nessun posto è stato liberato.
- In DG82 il vecchio schema SQL prevedeva cancellazione dei posti dopo scadenza basandosi soprattutto su `prenotazioni.pagato`: questa versione disattiva **ogni cancellazione automatica** e impone una verifica manuale, anche dopo 72 ore.
- La schermata del gestionale considera `prenotazioni.pagato`, `prenotazioni.acconto`, e `pagamenti` con riferimento `prenotazione_id`, sottraendo i rimborsi. La salvaguardia finale deve essere **server-side e transazionale**.
- Il sito pubblico non è in questo ZIP. Prima di automatizzare il rilascio occorre verificare la prenotazione atomica lato sito e l'unicità `(viaggio_id, posto)` sul DB effettivo.
- Dai progetti esistenti risultano DUE Supabase distinti: `delgrosso-sito` e `gestionale`. **Non applicare lo SQL in entrambi** né presumere che siano sincronizzati. Identificare quale è autoritativo per i posti in produzione.

## Come ottenere il numero API Meta mantenendo app Business
1. Aprire https://business.facebook.com/ e usare l'attività che controlla il numero.
2. Aprire https://developers.facebook.com/apps/ e creare/selezionare l'app Meta dedicata all'azienda; aggiungere WhatsApp nel pannello di configurazione.
3. Poiché +39 320 881 5899 è indicato come già attivo in WhatsApp Business, verificare il percorso Meta **Business App + API coexistence** e la sua idoneità. Non registrare il numero con il normale percorso Cloud API senza avere verificato che l'app Business non venga scollegata.
4. Completato l'onboarding, nella sezione WhatsApp/API Setup identificare `Phone Number ID` e `WhatsApp Business Account ID`. Il numero non sostituisce il Phone Number ID.
5. Creare un token di sistema durevole con gli appropriati permessi (`whatsapp_business_messaging`, `whatsapp_business_management`) e collegare l'asset. Un token temporaneo di test NON va usato in produzione.
6. Configurare webhook Meta con callback HTTPS `https://DOMINIO-GESTIONALE/api/whatsapp/webhook`, e verify token segreto corrispondente a `WA_VERIFY_TOKEN`; sottoscrivere `messages`. Impostare `META_APP_SECRET` per verificare le firme.
7. Approvare template in italiano iniziale, promemoria 48h, conferma acconto, posto liberato. Per i messaggi proattivi fuori dalla finestra di assistenza utilizzare template approvati e consenso documentato.

## Dove inserire i dati tecnici
Nel progetto di hosting **Vercel** che serve `/api/whatsapp`, aprire **Project → Settings → Environment Variables**. Inserire le variabili **solo server-side**, negli ambienti corretti (prima Preview poi Production):

| Chiave | Significato |
|--|--|
| `WA_PHONE_NUMBER_ID` | identificativo numerico assegnato da Meta |
| `META_WA_ACCESS_TOKEN` | token tecnico Meta, segreto |
| `META_APP_SECRET` | segreto dell'app Meta |
| `WA_VERIFY_TOKEN` | stringa casuale scelta dall'azienda, uguale su Meta e Vercel |
| `SUPABASE_URL` | URL del progetto del gestionale effettivamente utilizzato |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave segreta Supabase: **MAI nel frontend** |
| `WA_TEMPLATE_CONFIRMATION` | nome del template già approvato per conferma |
| `WA_TEMPLATE_DEPOSIT` | nome del template approvato per acconto |
| `WA_TEMPLATE_BALANCE` | nome del template approvato per saldo |
| `WA_AUTOMATION_ENABLED` | `false` inizialmente, non attivare prima del collaudo |
| `META_GRAPH_VERSION` | versione API Graph supportata attualmente dal Meta App |

**Non inserire token, App Secret o Service Role Key in chat, HTML, JavaScript, GitHub o schermate pubbliche.** Dopo la configurazione ridistribuire il progetto Vercel. Verificare `GET /api/whatsapp/status`: `inboundReady` e `outboundReady` sono solo controlli configurazione, non prova di invio effettivo.

## Vincoli per il rilascio automatico definitivo
Un processo schedulato lato server (Cron/Edge Function) può liberare il posto **solo** dopo tutto questo, all'interno di una transazione con lock:
- prenotazione in attesa da oltre 72 ore, viaggio ancora futuro; messaggio promemoria 48h effettivamente inviato; concessa l'intera finestra bonus;
- nessun movimento netto positivo in `pagamenti`, nessun importo positivo in `prenotazioni.acconto` o `prenotazioni.pagato`, nessuna registrazione pendente; verifica in caso di correzioni contabili e data/ora;
- nessuna modifica/cambio data in corso, nessun conflitto di sincronizzazione tra sito e gestionale;
- aggiornamento coerente di prenotazione, posti assegnati e outbox in modo atomico; invio template «posto liberato» dopo commit;
- registrazione di audit, blocco in caso di errore o mancata consegna notifiche.

**La patch DG83 non attiva tale rilascio automatico**: per ora a 72 ore passa a `manual_review`, senza liberare posti. Anche lo SQL incluso deve essere adattato e verificato sui database reali prima di essere eseguito.

## Test obbligatori
Pagamento a 47h, 49h, 71h e 73h; solo acconto su `pagamenti`; pagamento e rimborso; pagamento e scadenza simultanei; due clienti sullo stesso posto; errore WhatsApp; 2 posti per una prenotazione; cambio viaggio; sito e gestionale con due diversi progetti Supabase; conferma manuale e annullamento. Fare un backup e utilizzare un ambiente test prima di qualsiasi deploy.
