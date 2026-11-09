# DELGROSSO Gestionale V63 — WhatsApp Business a costo WhatsApp aggiuntivo zero

**Base:** V62 completa. Nessun requisito di Meta Cloud API per la modalità gratuita. Mantiene intatte le funzioni V61/V62: quote Nicola/Raffaele, piantine, Control Room, noleggi, Cassa, ricavi, notifiche e iPhone.

## Novità operative

1. **WhatsApp Business → Centro clienti da contattare**: tre filtri: acconti scaduti/in scadenza entro sette giorni (solo se non risultano somme già incassate), saldi da verificare a ridosso della partenza e prenotazioni future. La lista è **un suggerimento operativo**, non un registro di messaggi effettivamente inviati.
2. **Messaggi contestuali**: scelta prenotato, conferma o richiesta da verificare, acconto, saldo, ricevuta, invito. Rilevamento di prenotazioni non confermate e pagamenti già registrati per ridurre messaggi errati.
3. **Ricevute**: elenco pagamenti REALI collegati alla prenotazione; pulsante per aprire/stampare la ricevuta esistente nel gestionale. Esportare o salvare il PDF, aprire WhatsApp e allegarlo **manualmente**. Nessun PDF viene allegato automaticamente da WhatsApp.
4. **Noleggi GT / Limousine**: il modulo gratuito prepara conferme, residui calcolati dai pagamenti registrati e ricevute autentiche dei noleggi. Anche questi invii restano manuali.
5. **Gruppi**: copia del nome gruppo suggerito e lista dei prenotati con pulsante "Invita" abilitato solo quando il link gruppo è salvato e il consenso al contatto è registrato. Il gruppo va creato a mano nell'app; il cliente entra tramite link volontario.
6. **Consenso WhatsApp**: usa le tabelle e i moduli della V61. Non aggira consensi, pagamenti, né cancella automaticamente posti.
7. **iPhone**: non verifica Cloud API a ogni avvio. Se si vorrà passare alle API in futuro, la funzione è conservata nelle opzioni avanzate, ma NON è abilitata nella modalità gratuita.
8. **Documenti**: i due footer di ricevuta e preventivo mostrano WhatsApp aziendale 320 881 5899; il recapito telefonico Nicola resta distinto.

## Limiti importanti

- **Gratis** si riferisce alla mancanza di un nuovo abbonamento WhatsApp/API. Rimangono i normali costi già sostenuti per Supabase, dominio o Vercel.
- WhatsApp Business non inoltra automaticamente al gestionale i messaggi ricevuti nell'app. Le prenotazioni dal sito continuano a sincronizzarsi in Supabase come prima.
- Un operatore deve premere "Apri WhatsApp", controllare il testo e poi premere **Invia** nell'app. Il gestionale non può conoscere se la persona abbia effettivamente ricevuto/letto il messaggio.
- Il salvataggio PDF dipende dalle funzioni documenti già presenti e va collaudato su iPhone/Safari.
- Nessuna azione di invio, cancellazione posti, contabilizzazione o creazione gruppo è automatica.
- Filtri acconto/saldo sono prudenziali: verificare dati e scadenze prima di inviare. Se mancano date, importi o conferme, non promettere un automatismo.

## Pubblicazione GitHub

1. Effettuare backup del branch attuale. Distribuire tutti i file dello ZIP nella root del repository gestionale, mantenendo le cartelle `assets/`, `api/`, `lib/`, `setup/`.
2. Verificare la Preview Vercel prima di aggiornare la produzione.
3. Sul telefono: chiudere/riaprire Safari, ricaricare V63; controllare Cassa, Quote, Prenotazioni e pagina WhatsApp.
4. Collaudare prima con una prenotazione di prova o un numero autorizzato: conferma, scadenza, importo, link invito, generazione PDF. Non inviare messaggi di test ai clienti reali.
5. La versione V62 Cloud API rimane nel repository ma **non si attiva** senza credenziali; non creare variabili Vercel e non impostare `WA_AUTOMATION_ENABLED` a `true` per la modalità gratuita.

## Dati e sicurezza

Non sono state apportate modifiche alle tabelle né ai pagamenti Supabase. I nuovi file JS contengono solo logica lato client; non ci sono token Meta né chiavi di servizio. Non pubblicare cartelle di backup con dati privati.
