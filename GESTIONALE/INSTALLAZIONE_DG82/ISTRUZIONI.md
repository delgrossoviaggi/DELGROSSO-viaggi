# DELGROSSO DG82 — Prenotazioni, acconti e blocco posti

**Stato: integrazione gestionale locale pronta per verifica; motore automatico da collaudare e attivare.** Non è stata apportata alcuna modifica al database Supabase o al sito pubblico.

## Regole previste
1. Il cliente seleziona il posto sul sito. Una transazione DB atomica salva la prenotazione e l'occupazione del posto; nessun altro cliente può assegnarsi quel posto. Il sito pubblico non è presente in questo archivio: questa transazione va verificata e integrata sul repository del sito.
2. Subito dopo la prenotazione, è informato che deve versare l'acconto **in contanti**. Per San Nicandro Garganico: **Nicola, 366 212 7916**. Per San Severo: **Raffaele, 320 5730466**. **Le altre fermate non devono essere assegnate automaticamente** senza una scelta del referente.
3. Trascorse 48 ore senza acconto, promemoria WhatsApp e tolleranza per le ulteriori 24 ore. Scadute 72 ore totali, solo se il promemoria risulta inviato e il registro pagamenti è verificato, annullamento e liberazione posti; WhatsApp informativo successivo.
4. Se il pagamento è registrato in gestionale, lo stato diventa `confirmed`, non va liberato dai processi di scadenza e il cliente riceve la conferma.
5. In caso di recesso del cliente, le somme già versate non vanno cancellate; applicare le condizioni contrattuali valide e la normativa applicabile, valutando eventuali rimborsi.

## Cosa è già incluso in questo ZIP
- Sezione **Prenotazioni → Posti in attesa di acconto**, con totale da gestire, posti confermati, dettaglio del cliente, fermata, referente, scadenza e collegamento WhatsApp manuale.
- Tasto rapido **Registra acconto**, collegato alla funzione di pagamento esistente.
- Script SQL `01_SCHEMA_DG82_DA_VERIFICARE.sql` che propone tabella scadenze, coda di notifiche e funzioni, senza schedulare cancellazioni.
- Nessuna cancellazione di dati storici e nessuna migrazione applicata autonomamente.

## Operazioni necessarie per attivare il flusso completo
1. Effettuare backup Supabase, ispezionare schema effettivo di `prenotazioni`, `pagamenti`, `prenotazione_posti` e le RPC `dg_save_booking_v13`, `dg_register_payment`, `sync_prenotazione_pagamenti`; verificare la separazione di contabilità Nicola/Raffaele e pagamenti realmente contabilizzati.
2. Applicare e adattare la migrazione SQL in ambiente di test, definire le policy RLS per soli operatori autorizzati. **Senza queste policy il pannello mostrerà la modalità compatibilità.**
3. Integrare **il repository del sito**: prenotazione atomica e creazione hold, risposta al cliente con importo acconto, telefoni, termini e condizioni accettate, sicurezza per concorrenza sullo stesso posto. Evitare due client che vedono lo stesso posto libero.
4. Configurare WhatsApp Cloud API con template approvati (`initial`, `reminder`, `confirmed`, `release`), opt-in valido, gestione degli errori, idempotenza, webhook delle consegne. Il modulo preesistente `api/whatsapp/send-template.js` è **solo manuale** e non va scambiato per automazione già operativa.
5. Collaudare cron e verificare la consegna del promemoria prima del rilascio. Garantire che `pagato`/`acconto` siano effettivamente sincronizzati con la contabilità, anche dopo correzioni pagamento. Non attivare il cron finché il controllo pagamento non è certo.
6. Test: 2 clienti simultanei per lo stesso sedile; prenotazione 48h; reminder; pagamento alle 71h; pagamento contestuale a scadenza; annullamento; mancata consegna WhatsApp; recesso con acconto; cambio data; prenotazione multi-posto; viaggio prossimo alla partenza.

**Attenzione:** l'eventuale automatismo non deve funzionare per viaggi con partenza anteriore al termine delle 72 ore; in quel caso la regola va adattata e mostrata prima dell'acquisto.

**Politica di rimborso:** non indicare semplicemente “acconto sempre perso”. Nei pacchetti turistici l'art. 41 Codice del Turismo prevede condizioni specifiche per il recesso, inclusi casi di rimborso integrale e penali ragionevoli. Far verificare le condizioni scritte per la tipologia di servizio venduto.
