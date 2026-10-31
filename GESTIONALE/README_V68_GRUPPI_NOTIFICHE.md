# DELGROSSO — V68 | Gruppi viaggio e prenotazioni da controllare

## Funzionalità
- Centro WhatsApp → «Gruppi viaggio · BUS 1 / BUS BIS» con viaggi da Supabase, filtro per autobus, numeri unici deduplicati, numero di prenotazioni e di posti, fermate e assenze di telefono.
- Copia numeri e copia elenco completo senza importare contatti nella rubrica; non scrive archivi sui dispositivi.
- BUS BIS rilevato da `viaggi.bis_parent_id` e `viaggi.bis_numero`: i link WhatsApp devono essere salvati separatamente per ogni record `viaggi.id`.
- Pulsante «Invita» apre WhatsApp con destinatario e testo precompilato **solo quando** risultano un link invito valido e il consenso specifico al gruppo (`dg_trip_group_consents_v65`) per quella prenotazione.
- Panoramica delle prenotazioni degli ultimi 7 giorni e notifiche interne non lette; nessun invio automatico alla chat Business dell'azienda.
- Nessuna automazione per la creazione dei gruppi: usare l'app WhatsApp Business, scegliere nome e privacy del gruppo, copiare il link e incollarlo nel Centro WhatsApp.

## Sicurezza e dati
- Non modifica, cancella o migra prenotazioni, pagamenti, viaggi o Supabase.
- Non invia email e non manda WhatsApp da solo.
- Il numero in prenotazione è quello del referente: potrebbero mancare i numeri dei singoli passeggeri.
- La tabella dei consensi viene letta tramite RLS operatore; se non è disponibile gli inviti restano disabilitati.
- Copia contatti negli appunti solo dopo esplicito clic dell'operatore.

## Installazione
- Estrarre lo ZIP direttamente nella root repository **mantenendo la directory `GESTIONALE/`**.
- Non caricare questi file nella root pubblica `index.html` del sito in manutenzione.
- Prima di sostituire la V67 eseguire backup della cartella gestionale.
- Controllare nel gestionale la visualizzazione di un viaggio BUS 1 e BUS BIS con prenotazioni reali (senza inviare messaggi), verificare che l'elenco non mostri prenotazioni annullate, e testare copia elenco e permessi.
- I servizi email automatici restano da collaudare e attivare sul server. Per ricevere messaggi automatici sul WhatsApp Business aziendale serve un'integrazione ufficiale.
