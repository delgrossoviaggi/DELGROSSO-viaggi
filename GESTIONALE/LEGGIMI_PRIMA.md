# DELGROSSO VIAGGI 3.0 ULTIMATE — Versione 2.5 Supabase verificabile

Questa versione nasce dalla multipagina 2.4. Mantiene **32 pagine HTML** e i file condivisi nella cartella `assets`.

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
- URL degli script e stili con `?v=2.5.0` per evitare vecchie cache dopo il caricamento GitHub.
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
