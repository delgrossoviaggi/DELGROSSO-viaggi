# DELGROSSO VIAGGI 3.0 ULTIMATE — Versione 2.1 (14/11/2026)

## Attivazioni Supabase effettuate

Sul progetto gestionale `chkuayhbmitdmzmmvona` sono state APPLICATE cinque migrazioni additive:
- dg3_ultimate_safe_new_archives_20261114: sette nuove tabelle RLS protette.
- dg3_ultimate_cash_and_costs_safe_rpcs_20261114: quattro RPC per cassa e costi.
- dg3_ultimate_cost_atomicity_correction_20261114: verifica atomica dell'uscita contabile.
- dg3_ultimate_atomic_booking_move_rpcs_20261114: anteprima e spostamento data/riservazione posti.
- dg3_ultimate_operator_diagnostics_readonly_20261114: diagnostica RPC in sola lettura.

Nessuna prenotazione, pagamento o chiusura storica è stata alterata da queste migrazioni.
Questa release è predisposta per accesso autentico Nicola/Raffaele; le operazioni con scrittura reale non sono state
eseguite in collaudo in assenza di una sessione aziendale autorizzata. Eseguire la prova controllata prima di usarle
per incassi effettivi o trasferimenti di prenotazione pagata.

L'emissione e trasmissione fatture XML allo SdI NON è stata attivata; le fatture sono solo bozze gestionali.
WhatsApp API e creazione automatica gruppi NON sono attive.

## GitHub

Carica l'intera struttura `GESTIONALE/ULTIMATE/` nel repository, mantenendo `assets/` e tutte le pagine .html.
Non sovrascrivere `GESTIONALE/index.html` o la home pubblica del sito.
Dopo il deploy, esci e rientra nel gestionale, premi Aggiorna ed esegui la pagina **Diagnostica**.

## Checklist minima con accesso reale

1. Login con Nicola e con Raffaele; assicurarsi che non compaiano dati all'utente anonimo.
2. Diagnostica: 18 tabelle più 6 RPC, tutte visibili come raggiungibili (fermo restando RLS).
3. Cassa: solo anteprima non mutante; confrontare saldo con ultimo registro e non chiudere se disallineato.
4. Fornitori: registrare solo un fornitore reale autorizzato, verificando successivamente lo storico.
5. Fatturazione: generare una bozza con dati di prova non reali senza emettere SdI.
6. Sposta data: controllare l'anteprima di una prenotazione reale, SENZA confermare lo spostamento finché
   non siano stati verificati check-in, contatori posti, pagamenti e conferme pregresse.
7. Conferme PDF: verificare archiviazione e intestazione logo dal browser iPhone e PC.

## Nota contabile

I movimenti esistenti non sono stati ricalcolati. Gli importi sono vincolati ai permessi dell'operatore e al DB.
La funzione di chiusura restituisce un saldo teorico che va riconciliato con i contanti fisici.

## Verifiche eseguite il 14 novembre 2026

- 7 nuove tabelle presenti, ciascuna con RLS e policy di accesso.
- 6 procedure di business SQL e una diagnostica di sola lettura presenti nel progetto Supabase.
- Esecuzione pubblica/anonima delle procedure revocata; solo authenticated con controlli sui permessi.
- Verifiche statiche JavaScript passate e 31 pagine testate in Chromium con dati simulati.
- Conferma A4 PDF con logo verificata. ZIP controllato.
- Registro contabile storico invariato: 132 prenotazioni, 96 pagamenti, 98 movimenti, 13 chiusure al controllo.

**Limiti del collaudo:** non è stata eseguita una prenotazione o una chiusura in un account reale; serve la
prova operativa autorizzata e la verifica da parte dei responsabili prima di registrare nuovi pagamenti.

**Servizi esterni non abilitati:** invio fatture XML allo SdI, conservazione fiscale e WhatsApp API.


## Novità versione 2.2 — Viaggi archiviati

- Apri **Viaggi archiviati** dal menu o dal pulsante in **Viaggi e partenze**.
- Cerca i viaggi precedentemente archiviati.
- Seleziona **Verifica eliminazione**: Supabase controlla in tempo reale le dipendenze storiche.
- I viaggi con prenotazioni, pagamenti, costi, documenti, BUS BIS e altri collegamenti **NON** possono essere cancellati definitivamente.
- Solo per viaggi archiviati privi di altri collegamenti, la cancellazione può includere le sole fermate del viaggio.
- Per completarla serve digitare **ELIMINA** e confermare una seconda volta. Nessuna cancellazione avviene automaticamente.
- Il pulsante **Ripristina** mantiene il viaggio e lo riporta in programmazione secondo i controlli della funzione Supabase esistente.
- Le RPC `dg3_archived_trip_check_v1` e `dg3_delete_archived_trip_v1` sono state installate nel Supabase gestionale in data 14/11/2026.
- Gli utenti anonimi non possono eseguire queste RPC; chiavi amministrative e password non sono presenti nel frontend.
- La verifica browser utilizza dati simulati: provare la funzione con l'operatore reale prima di eliminare dati aziendali.


## Novità versione 2.3 — Gestisci autobus e stato del viaggio

- In **Viaggi e partenze** trovi **Autobus e stato** per ogni viaggio non archiviato.
- Puoi scegliere fra gli autobus GT / Limousine Bus realmente disponibili per la data, cambiare mezzo o selezionare **Nessun autobus / Da assegnare**.
- Puoi scegliere **Programmato, Confermato, Annullato, SOLD OUT**: l’operazione non genera rimborsi o notifiche automatiche.
- **Registra autobus disponibile** consente di aggiungere un mezzo reale a `flotta`; non modifica la capienza delle piantine di viaggi già creati.
- La disponibilità viene verificata sul server prima di salvare e viene controllata nuovamente durante la transazione.
- Un viaggio Annullato o senza bus viene rimosso dalla pubblicazione, non eliminato; prenotazioni e pagamenti restano invariati.
- Supabase: procedure aggiuntive `dg3_disponibilita_autobus_viaggio_v1` e `dg3_aggiorna_viaggio_autobus_stato_v1` installate il 14/11/2026.
- **Nessun dato aziendale è stato modificato durante questo rilascio**, salvo l’aggiunta delle funzioni SQL. Collaudare un salvataggio reale controllato prima dell’uso quotidiano.
