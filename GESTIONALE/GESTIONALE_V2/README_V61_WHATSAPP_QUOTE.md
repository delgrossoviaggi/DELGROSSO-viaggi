# DELGROSSO Gestionale V61 — Quote e WhatsApp

## Installato nel gestionale

- **Cassa → Trasferisci quote gite/noleggi**: trasferisce una quota di un pagamento registrato (non denaro fisico), da Nicola a Raffaele e viceversa. Controlla la quota disponibile e non crea un secondo incasso. Conserva il tracciamento e un identificativo anti-duplicazione. La funzione SQL già presente è `public.dg_transfer_quote_v61`.
- **Quote Nicola / Raffaele**: il riepilogo considera i movimenti di trasferimento e i pagamenti dei noleggi, oltre a quelli dei viaggi.
- **WhatsApp Business**: nuova pagina con numero ufficiale +39 320 881 5899, messaggi preparati, richieste in arrivo, consensi registrati e link ai gruppi per viaggio.
- **Webhook**: `api/whatsapp/webhook.js` può ricevere richieste 1:1 dalla WhatsApp Cloud API e salvarle nella coda "da esaminare". Non prenota posti senza convalida umana.

## NON ATTIVO finché non viene collegato Meta

La ricezione dei messaggi richiede la connessione WhatsApp Business Platform via Embedded Signup/Coexistence e questi segreti **solo nelle variabili Environment di Vercel**:

- `WA_VERIFY_TOKEN` (stringa casuale robusta, usata anche su Meta per verificare il webhook)
- `META_APP_SECRET` (App Secret Meta)
- `SUPABASE_URL` (URL del progetto Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (chiave server, **mai nel browser o in GitHub**)

Endpoint webhook: `https://<DOMINIO_GESTIONALE>/api/whatsapp/webhook`.
Nella configurazione Meta sottoscrivere **messages** e verificare la firma `X-Hub-Signature-256`.
Nessun token o numero di telefono Cloud API viene creato dal solo caricamento dello ZIP.

### Messaggi automatici in uscita

Non sono attivi in V61. Servono il numero connesso alla Cloud API, il suo `phone_number_id`, l'access token custodito nel backend e i **template approvati da Meta** per comunicazioni proattive fuori dalle 24 ore. Servono inoltre consensi documentati dei destinatari.

Workflow approvato da implementare/abilitare dopo l'onboarding:
1. Webhook registra il messaggio. La richiesta compare nel gestionale come bozza *da esaminare*.
2. Operatore verifica viaggio, fermata, disponibilità e dati → conferma prenotazione nel normale flusso gestionale.
3. Conferma inviata solo su stato validato. Ricevuta PDF solo dopo conferma reale di registrazione del pagamento, tramite URL/media sicuri.
4. Promemoria acconto programmato: verificare pagamenti e data di scadenza prima dell'invio, non annullare posti automaticamente.
5. Gruppi dei viaggi: crea manualmente il gruppo da WhatsApp Business e salva il link nel gestionale; invita su base volontaria. Non creare gruppi via API per viaggi da 40–60 persone e **non aggiungere automaticamente clienti**.

## Sicurezza e protezione dati

Le nuove tabelle con RLS sono `dg_whatsapp_inbox_v61`, `dg_whatsapp_trip_invites_v61`, `dg_whatsapp_optins_v61`. Non condividere il repository, i link di gruppo e i telefoni dei clienti pubblicamente. Le richieste WhatsApp non devono diventare prenotazioni ufficiali senza convalida dei dati e della disponibilità.

La scrittura su Supabase da webhook avviene solo con una chiave server configurata su Vercel; il frontend utilizza la sessione già autenticata e le policy RLS. Prima della pubblicazione: collaudare con Nicola e Raffaele, provare la contabilità e fare un backup.
