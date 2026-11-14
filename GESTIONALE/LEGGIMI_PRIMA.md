# DELGROSSO VIAGGI 3.0 ULTIMATE — Versione 2.6 · Cancellazioni e rimborsi controllati

Questa versione nasce dalla multipagina 2.4. Mantiene **33 pagine HTML** e i file condivisi nella cartella `assets`.

**Non esiste una garanzia di sincronizzazione “100%” in assenza di un collaudo sul server aziendale con entrambi gli account.** Il progetto Supabase è configurato; tutte le 332 colonne usate dal client esistono, ma autenticazione reale e scritture non sono state provate con credenziali di produzione.

## Pubblicazione su GitHub (manuale)

1. Conserva la struttura completa `GESTIONALE/ULTIMATE/` e tutte le sue sottocartelle.
2. Carica/sostituisci i file nel repository `delgrossoviaggi/DELGROSSO-viaggi`.
3. Non sovrascrivere la home del sito o `GESTIONALE/index.html`.
4. Su Vercel attendi che il deployment risulti **READY**.
5. Apri `/GESTIONALE/ULTIMATE/`, esci e rientra con ciascun account Supabase.
6. In **Diagnostica integrazioni** clicca **Esegui diagnosi completa** e salva il CSV.
7. Verifica che l'ultima prenotazione e notifica corrispondano a quelle del pannello Supabase e che Realtime sia connesso; dopo una perdita rete il recupero è periodico.
8. Su iPhone ripeti il controllo attraverso il dominio HTTPS; non usare `file://`.

## Modifiche v2.5

- Diagnostica: SELECT autenticata reale (`limit=1`) anziché controllo vuoto `limit=0`.
- Verifica dell'identità dell'operatore e della sessione Supabase.
- Stato del WebSocket in diagnostica; distinzione tra letture, RPC presenti e scritture non collaudate.
- Memoria delle letture riuscite e degli errori recenti, senza token o dati personali.
- Protezione da risposta tardiva di una sessione Nicola/Raffaele sostituita.
- Ogni cambio pagina ricarica le cache per evitare dati obsoleti.
- Sincronizzazione di riserva delle altre pagine ogni 20 secondi quando la pagina è visibile e non è aperto un form.
- Realtime su prenotazioni/notifiche con recupero REST di riserva ogni 15 secondi.
- URL degli script e stili con `?v=2.6.0` per evitare vecchie cache dopo il caricamento GitHub.
- Nessuna password o chiave amministrativa nello ZIP: solo chiave **pubblica** Supabase.

## ATTENZIONE: limitazioni

Il collaudo qui incluso è un collaudo di struttura, codice e simulazione di servizi. Non dimostra che un pagamento, una chiusura di cassa o un cambio data sia riuscito con un operatore reale.

Le fatture restano bozze, senza emissione SdI. WhatsApp automatico richiede il canale ufficiale Meta.

Le scritture del database aziendale NON sono state eseguite per i test di questa release. **Nessuna migrazione SQL viene eseguita dal frontend.**

### Lista delle prove da eseguire prima del rilascio aziendale

- Login Nicola e Raffaele separati, con sessioni valide.
- Diagnostica: verificare autorizzazioni per ogni archivio, non solo che esista.
- Prenotazione di prova autorizzata in ambiente di staging: creazione, posti, modifica, conferma PDF e rollback.
- Spostamento di prova di una prenotazione già pagata in staging, con sedili occupati.
- Nuovo incasso di prova in staging e confronto tra pagamenti, economia e cassa.
- Chiusura cassa di prova in staging con saldo iniziale riconciliato.
- Noleggio: inserimento, modifica e pagamenti in staging.
- Verifica dell'invio manuale WhatsApp e dei PDF su iPhone e PC.
- Backup e prova di ripristino prima dell'attivazione delle scritture reali.

**I file sono pronti per il caricamento GitHub; la certificazione aziendale al 100% resta subordinata a queste prove.**


## Novità 2.6 — Eliminazione prenotazioni, annullamento viaggio e rimborsi

1. **Prenotazioni** → tasto `Elimina prenotazione` → anteprima, motivo obbligatorio, digitare `ELIMINA PRENOTAZIONE`, seconda conferma.
2. Una prenotazione senza incassi e senza riferimenti storici viene eliminata fisicamente dopo la creazione di uno snapshot di audit. Se ha altri riferimenti, viene annullata e nascosta nell'elenco operativo (filtro `Annullate` per consultarla).
3. Una prenotazione con acconti/saldi viene annullata ma resta nello storico; i posti vengono liberati e si apre un allarme per l'importo da restituire. Incassi e ricevute NON vengono cancellati.
4. **Viaggi e partenze** → `Annulla viaggio e prenotazioni` → anteprima, motivo, digitare `ANNULLA VIAGGIO`, seconda conferma. Tutte le prenotazioni attive sono processate in una transazione. Il viaggio diventa `Annullato`, viene archiviato e tolto dalla pubblicazione; non è cancellato definitivamente finché ha registrazioni storiche collegate.
5. **Rimborsi in allarme** → consulta nominativo, viaggio, incassato, quota dovuta, registra il rimborso effettivamente pagato, scarica il CSV. Un rimborso registrato genera movimento contabile e ricevuta secondo il flusso Supabase già esistente. Non trasferisce automaticamente denaro.
6. Notifica aziendale `WARNING` quando viene annullata una prenotazione con importi da rimborsare; dopo l'annullamento non si possono registrare nuovi acconti o saldi su quella prenotazione.

**ATTENZIONE:** le procedure database sono state installate nel progetto Supabase gestionale, ma non sono state esercitate con cancellazioni o rimborsi reali. Prima dell'uso quotidiano, completare un test end-to-end autorizzato in staging e confrontare saldi, ricevute, prenotati e posti. I dati storici di produzione non sono stati cancellati durante lo sviluppo.

**Il modulo non emette note di credito fiscali, non esegue bonifici e non invia comunicazioni automatiche ai clienti.** Queste operazioni restano manuali o legate a servizi esterni.
