# DELGROSSO VIAGGI 4.0 ULTIMATE — collaudo separato da produzione
Data tecnica: 17 novembre 2026.

**Ramo di sviluppo:** `build/dg4-rebuild-20261117`. **Percorso web:** `/GESTIONALE/v4/`. **Database operativo originale:** Supabase `chkuayhbmitdmzmmvona`. **Sito prenotazioni:** progetto Supabase `bhsanrbadsqcpbtxupmr`.

> ATTENZIONE: questa versione è una **build V4 di collaudo read-only**. Tutte le chiamate di modifica sono bloccate in `core.js` mediante `WRITES_ENABLED=false`. I flussi di scrittura sono implementati ma **non certificati su DB di staging né autorizzati in produzione**. NON sostituire la versione usata dall'azienda.

## 20 pagine implementate

| Pagina | Tabelle / viste principali | Consultazione | Operazioni di modifica |
|---|---|---|---|
| Dashboard | viaggi, prenotazioni, pagamenti, scadenze, notifiche | sì | non previste |
| Viaggi | viaggi, prenotazioni, posti | sì, dettaglio e bus BIS | creazione, modifica e archiviazione implementate, non abilitate |
| Prenotazioni | prenotazioni, prenotazione_posti, pagamenti | sì, ricerca/filtro e conferme | RPC atomica, annullamento/rimborso da verificare, non abilitate |
| **Spostamenti posti/BUS BIS/date** | prenotazioni, viaggi, posti, pagamenti, layout | sì, scelta sedili, BUS principale/BIS, anteprima cambio data | RPC `dg_manage_booking_seats_v1` e `dg3_sposta_prenotazione_data_v1` con anteprima `dg3_preview_spostamento_data_v1`, conferma bloccata fino a backup certificato |
| Control Room | viaggi, prenotazioni, dg28_trip_layouts, fermate | sì, numeri e check-in | scritture non abilitate |
| Piantine | dg2_layout_library, dg28_trip_layouts, dg28_bus_layouts | sì, editor bozza in memoria, JSON | salvataggio/validazione/pubblicazione tramite RPC implementati ma bloccati |
| Contabilità e casse | dg_cassa_operatori, pagamenti, noleggi_bus_pagamenti, trasferimenti | sì, operatori separati, incassi e ricevute | registrazione gite/noleggi via RPC, trasferimenti, bloccate |
| Economia e costi | economia_movimenti, dg_viaggi_redditivita | sì | scritture non abilitate |
| Clienti | clienti, prenotazioni, pagamenti | sì, fascicolo PDF con correlazione esatta nome+telefono | nuova anagrafica preparata, bloccata |
| Noleggi bus | noleggi_bus, noleggi_bus_pagamenti | sì, scheda e pagamenti | registrazione noleggio/incassi implementata ma bloccata |
| Preventivi | preventivi | sì, scheda PDF | nuovo preventivo e PDF professionale predisposti, bloccati |
| Fatturazione / bozze | dg3_fatture_bozze | sì | **nessuna emissione FE/SDI**, solo lettura PDF bozza |
| Lista d'attesa | lista_attesa | sì | inserimento senza occupazione sedili predisposto, bloccato |
| Agenda e scadenze | scadenze_gestionale | sì, CSV e PDF | creazione/aggiornamento predisposti, bloccati |
| Flotta GT | flotta | sì, senza pubblicizzare van | modifiche non abilitate |
| Documenti | archivio_documenti, dg_receipt_archive, Supabase Storage | sì, indici e accesso JWT agli originali | no archiviazioni automatiche in safe mode |
| Notifiche | notifiche | sì | nessun polling aggressivo |
| WhatsApp Business | dg_whatsapp_inbox_v61, outbound, optins | sì, consensi e storico | **nessun invio automatico ai clienti** |
| Centro PDF e report | viste autorizzate | sì, pulsanti aggregati | file scaricati localmente |
| Diagnostica | dg_system_health, dg_data_quality_issues | sì | nessun SQL di modifica |

## Motore PDF aziendale incorporato
- `pdf-engine.js`: generatore PDF autonomo con logo aziendale embedded, A4, intestazioni/paginazione/xref; offline nel browser, senza CDN e senza usare chiavi server.
- `pdf-reports.js`: conversione dati letti da Supabase in report, download PDF via Blob adatto anche a Safari iOS.
- Documenti supportati e testati con fixture: conferma prenotazione, elenco prenotati per viaggio / tutti i viaggi / BUS BIS, report operativi con piantina e fermate, riepilogo singolo pagamento, contabilità casse, agenda, fascicolo cliente, scheda noleggio, economia, flotta, anagrafica, registro noleggi, indice archivio, preventivo, **bozza** fattura, piantina 53/57/63.
- **Originali Storage:** il browser apre soltanto URL firmati dallo Storage aziendale per utenti Auth autorizzati. La presenza degli oggetti è stata ricontrollata (89/89 ricevute professionali, 88/88 standard e 47/47 conferme referenziate).
- **Funzioni server esistenti** verificate: `dg2-booking-pdf`, `professional-receipts`, `professional-quotes`; creazione PDF+archiviazione predisposta dopo salvataggio transazionale. Il fallimento del documento non provoca una seconda registrazione pagamento/prenotazione. In safe mode anche questo salvataggio documenti è bloccato.
- Non qualificare i PDF riepilogativi come ricevute fiscali/fatture elettroniche e non inviare bozze FE come documenti emessi.

## Conferme cumulative dello stesso referente per fermata di partenza
- Dalla scheda della prenotazione, quando sono presenti **due o più prenotazioni attive** con **nome e cognome completi uguali**, **numero di telefono uguale** (anche con/senza prefisso internazionale italiano) e **lo stesso viaggio logico nella stessa data**, compare `Conferma unica (N prenotazioni)`.
- Riconosce gli autobus principale/BIS soltanto se collegati tramite `bis_parent_id`; non accorpa semplici viaggi distinti che hanno lo stesso titolo o la stessa data.
- PDF A4 con logo in `makeCombinedBookingPdf` e adattatore `pdfCombinedBooking`: intestazione unica, sezioni separate per `fermata_partenza`, dettaglio per prenotazione, codici, posti, autobus, passeggeri, subtotali per fermata, totale complessivo, netto incassato e saldo.
- Somma le quote delle prenotazioni distinte e usa `pagamenti` per ciascun ID, deduplicando i movimenti e sottraendo i rimborsi negativi. Se il registro incassi non coincide con `prenotazioni.pagato`, il PDF **evidenzia la differenza** invece di certificarne falsamente la riconciliazione.
- Non include prenotazioni annullate o riserve aziendali. Se manca l'identità completa, non effettua accorpamenti automatici.
- Il PDF è **generato localmente nel browser**, anche su iPhone, ed è scaricabile dalla scheda. **Non viene ancora emesso automaticamente dal sito, inviato per email o salvato come nuovo originale nello Storage**: richiede una successiva estensione dei workflow server, da provare dopo backup/restore.
- La conferma singola e le ricevute già archiviate rimangono disponibili e non vengono sovrascritte.
- Test regressione: `tests/dg4-v4-confirmations.test.mjs`, `tests/dg4-v4-pdf.test.mjs`.

## Trasferimento partecipanti, numerazione sedili e BUS BIS
- La procedura `Gestisci` è raggiungibile da **Prenotazioni** e dalla pagina dedicata **Spostamenti posti / BUS BIS / date**.
- **Stessa data**: solo autobus che appartengono alla stessa partenza logica (stesso `bis_parent_id`/ID capofila), con scelta manuale di sedili liberi e capienza verificata. Il server rifiuta le sovrapposizioni tramite `dg_manage_booking_seats_v1`. Il client esclude posti aziendali riservati, posti fuori servizio e altre prenotazioni.
- **Data differente**: stessa destinazione, partenza non archiviata e futura, anche **anteriore** alla data originaria se ancora nel futuro. L'anteprima server `dg3_preview_spostamento_data_v1` conserva ove possibile i numeri originali, altrimenti propone altri posti; la conferma usa `dg3_sposta_prenotazione_data_v1` e verifica che i posti previsti non siano cambiati.
- **Importi**: nessun incasso automatico; acconto/saldo/totale e ricevute storiche restano collegati. La conferma prenotazione si rigenera dopo lo spostamento solo se il server lo ha realmente eseguito. Qualunque guasto PDF non provoca un secondo spostamento.
- **Dati partecipanti**: aggiornamento separato dei recapiti, nominativo, fermata e note, con confronto `updated_at` per non sovrascrivere le modifiche di un altro operatore. Il cambio del numero persone/quote resta nel modulo prenotazione completo e richiede la selezione di tutti i sedili.
- **Limite del modello dati**: ogni prenotazione registra un **referente + numero passeggeri**, non un'anagrafica personale distinta per ciascun sedile. Gli spostamenti riguardano per ora **l'intera prenotazione**; dividere uno solo dei partecipanti richiede una procedura separata e riconciliazione degli incassi, non è operativo.
- **Integrità storica**: 28 prenotazioni potrebbero avere differenze fra posti dichiarati e righe `prenotazione_posti`. In caso di anomalia la schermata blocca le assegnazioni manuali invece di creare collisioni.
- **Sicurezza**: tutte le azioni definitive mantengono `WRITES_ENABLED=false` finché manca il backup/restore verificato; il wizard può generare anteprime in sola lettura. Non confondere "READY" di Vercel con l'autorizzazione alle scritture.

## Impostazioni e sicurezza
- Login: `dg2-operator-login`, validazione JWT `/auth/v1/user`, `is_gestionale_admin`, operatore attivo. Nessuna password memorizzata nel codice, nessuna service role nel browser.
- Letture con RLS, token in `sessionStorage`, niente salvataggio permanente sul dispositivo; cache dati 25 s solo in memoria, niente N+1 indiscriminati.
- GET riprovati solo per errori temporanei della Data API; POST/RPC di scrittura mai ripetute automaticamente; lato server verifiche di posti/capienza.
- In V4 `WRITES_ENABLED=false`: nessuna operazione salva/modifica/elimina viaggi, clienti, posti, pagamenti o documenti.
- Tutte le nuove richieste SQL osservate nei 30 SELECT configurati sono state verificate contro `information_schema.columns`: **nessuna colonna mancante**.
- Nessun link WhatsApp viene inviato automaticamente; consensi prima di qualunque invito a gruppi.

## Prove effettuate
- **GitHub Actions** `.github/workflows/dg4-v4-tests.yml`: parsing sintattico, fixture di 20 schermate, numerazione GT53/GT57/GT63, vincoli safe-mode e test di 16 formati PDF con logo, struttura xref e paginazione. Run `https://github.com/delgrossoviaggi/DELGROSSO-viaggi/actions/runs/44059118088` con esito success sul commit `495531b78723372fc7cc162ea28be0fbe0c989f7`.
- Vercel integra automaticamente il ramo e segnala `READY` per la preview. **READY non equivale a un login reale o a funzionamento scritture**.
- Ultima baseline letta senza mutazioni: 16 viaggi, 139 prenotazioni, 96 pagamenti, 642 posti.

## Mancano prima di una V4 realmente operativa al 100%
1. Verifica snapshot gestito Supabase Pro e backup cifrato del DB, Auth e **tutti i 493 oggetti Storage** dei due progetti.
2. Prova di restore su Supabase staging isolato e senza inviare email o WhatsApp reali.
3. Test delle RPC e scritture su staging con account operatori di test, anticollisione sedili, annullamenti e rimborsi, receipt generation e idempotenza sui timeout.
4. Collaudo reale del login Nicola/Raffaele su PC + iPhone, controllo RLS, apertura PDF Storage privati, download e condivisione Safari, gestione gruppi.
5. Verifica end-to-end sito → ponte `gestionale-bridge` → prenotazione → sedile → pagamento → archiviazione; nessuna disponibilità inventata.
6. Validazione delle 28 prenotazioni con possibili differenze fra `posti` e `prenotazione_posti`; non risolverle con UPDATE indiscriminati.
7. Stress/monitoring PostgREST per precedente incidente `PGRST003`, gestione pool senza down del sito.
8. Approvazione esplicita del deploy e piano rollback prima di sostituire `main`.

## Come aprire il collaudo
Aprire l'URL preview Vercel del ramo e aggiungere `/GESTIONALE/v4/`. Se Vercel richiede accesso SSO, usare il proprio account del team; quindi accesso al gestionale con credenziali già esistenti. **Non inviare password, chiavi o dump in chat**.

## Data safety
Nessun deploy su `main`, nessun SQL mutativo, nessuna modifica a prenotazioni o pagamenti durante la realizzazione della V4. L'attuale sito pubblico rimane sul suo branch/deploy di produzione.
