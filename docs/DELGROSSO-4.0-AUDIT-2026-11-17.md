# DELGROSSO VIAGGI 4.0 ULTIMATE — AUDIT INIZIALE E PIANO DI RECUPERO
Data: 17 novembre 2026. Stato: ANALISI PARZIALE; NESSUNA AUTORIZZAZIONE A DICHIARARE IL SISTEMA PRONTO.

## Regole di sicurezza
- Questo documento deriva da interrogazioni prevalentemente di sola lettura di Supabase, da ispezione di codice GitHub e dai log operativi.
- Nessuna cancellazione, migrazione, modifica Auth, cambio RLS o operazione contabile è stata eseguita.
- Il database di produzione NON è stato copiato né è disponibile un backup integrale verificato in questo audit. NON fare deploy o migrazioni prima del backup e del test di ripristino.
- NON creare prenotazioni/pagamenti reali per i test; utilizzare staging con dati sintetici o anonimizzati.
- I conteggi rappresentano uno snapshot, non un inventario immutabile.

## Risorse confermate
| Risorsa | ID/URL | Stato rilevato |
|---|---|---|
| Supabase gestionale | chkuayhbmitdmzmmvona | ACTIVE_HEALTHY (indicatore di progetto, non garantisce PostgREST operativo) |
| Supabase sito | bhsanrbadsqcpbtxupmr | ACTIVE_HEALTHY |
| GitHub | https://github.com/delgrossoviaggi/DELGROSSO-viaggi | repository public; default main |
| Vercel | prj_yjPLZhZcVbPk5wTgHGMuRRLOGXuc | produzione READY, commit 255d4e24b85382076e3fc2bd9b495ef2d3402b27 |
| Dominio pubblico | https://www.delgrossoviaggi.it | homepage con catalogo di emergenza in HTML |
| Bridge sito | Edge Function gestionale-bridge | ACTIVE versione 11; usa REST/RPC del database principale |
| Login bridge | Edge Function dg2-operator-login | ACTIVE versione 2; richiede REST e Auth del database principale |

## Problema P0 (conferma nei log)
Alle 07:29–07:30 UTC del 17/11/2026 PostgREST del gestionale ha emesso PGRST003: "Timed out acquiring connection from connection pool", anche durante il caricamento della schema cache. Il bridge del sito ha registrato "Could not query the database for the schema cache. Retrying" alle 07:27 UTC. Gli errori PGRST003 si ripetono in gruppi di decine per intervallo di 5 minuti. In seguito due interrogazioni SQL diagnostiche via connettore hanno risposto "Database is possibly not accessible at the moment".

Interpretazione: database e dati esistenti, ma Data API/connessioni temporaneamente non affidabili. Non è ancora dimostrato se il collo di bottiglia sia costituito da query lunghe, connessioni occupate, limiti di pool, infrastruttura o retry/polling dell'applicazione. Non basta che Vercel mostri READY. La pagina status pubblica Supabase non indicava un incidente diffuso nello stesso momento.

**Recupero immediato da applicare solo dopo accesso affidabile e autorizzazioni:**
1. Mettere in sicurezza il sistema, mantenere il fallback pubblico chiaramente identificato e non esporre disponibilità non verificate.
2. Ottenere dal dashboard Supabase il grafico Database Connections / CPU / RAM / Disk e l'inventario delle query attive; preservare i log prima di qualunque restart.
3. Misurare connessioni attive, idle-in-transaction, wait events, tempi delle query, contesa e richieste al REST.
4. Verificare e ridurre richieste ripetute, fetch multipli su ogni navigazione, polling e interrogazioni che leggono intere tabelle.
5. Aprire ticket al supporto Supabase se PGRST003 persiste, allegando Project ID, timestamp UTC, estratti dei log SENZA credenziali e grafici.
6. Solo una volta ripristinato PostgREST, validare login, lettura viaggi, prenotazioni e navigazione dell'operatore senza effettuare scritture non autorizzate.

Riferimenti: https://supabase.com/docs/guides/api/rest/postgrest-error-codes ; https://docs.postgrest.org/en/stable/references/connection_pool.html .

## Baseline di sola lettura
Gestionale: 63 tabelle public, 16 viaggi, 12 pubblicati, 139 prenotazioni, 150 clienti, 96 pagamenti, 642 righe in prenotazione_posti, 3 dg2_piantine, 4 dg2_layout_library, 0 dg28_bus_layouts, 0 dg28_trip_layouts, 170 notifiche, 4 scadenze, 2 operatori attivi, 2 utenti Auth.
Storage gestionale: 7 bucket; ricevute-prenotazioni 237 oggetti, locandine 56 oggetti, gli altri bucket 0 oggetti al momento della lettura. Gli oggetti non sono stati scaricati o controllati per checksum.
Sito: 15 tabelle public, 0 righe in viaggi e prenotazioni locali, 30 site_media, un bucket Storage; contenuti e media separati.
Integrità di primo livello: 0 riferimenti orfani prenotazione->viaggio, 0 orfani posti->prenotazione, 0 orfani posti->viaggio, 0 duplicazioni fisiche (viaggio_id, posto), 0 pagamenti con prenotazione_id inesistente, 0 righe posti con viaggio diverso dalla prenotazione.
**Da approfondire:** 28 prenotazioni con posti > 0 e nessuna riga in prenotazione_posti; 16 "In attesa acconto", 10 annullate (una riserva aziendale), 2 "Acconto Ricevuto". L'assenza di righe non prova di per sé un'anomalia; validare cancellazioni, storicità e posti_selezionati prima di rettificare.
Vincoli accertati: UNIQUE (viaggio_id, posto) in prenotazione_posti; le FK prenotazione_posti->viaggi e prenotazioni->viaggi hanno ON DELETE CASCADE. NON eliminare viaggi in produzione: usare archiviazione e workflow autorizzati.
RLS: abilitato su tutte le 63 tabelle public elencate. Policy selettive per operatori verificate su viaggi, prenotazioni, posti, pagamenti e piantine. Non è un audit di sicurezza completato.
RPC pubbliche rilevate: create_public_booking_v3, get_public_booked_seats, get_public_trip_stops; la prima valida i parametri e delega a dg_public_api.create_public_booking_v3. La funzione delegata e le autorizzazioni effettive sono DA VERIFICARE quando il database torna disponibile.
Funzioni di gestione prenotazioni trovate: dg2_save_booking_guarded_v1, dg_move_bookings_auto_seats_v1, dg_manage_booking_seats_v1, dg_reseat_bookings_multibus_v2 (nomi rilevati, logica da verificare).
GitHub: molteplici UI legacy (GESTIONALE/index.html > 1 MB, GESTIONALE/nuovo, GESTIONALE/suite) convivono con interventi DG36–DG41. Identificare l'URL realmente usato e ridurre la frammentazione; preservare le rotte fino a migrazione verificata.

## Mappa esistente → modulo → operazioni e controlli
Legenda: R=lettura autorizzata, W=scrittura autorizzata da collaudare, H=storico immutabile/append, F=funzione futura opzionale. Le operazioni non rappresentano permessi RLS già certificati.

| Tabella/i del gestionale | Modulo target | Operazioni proposte | Dipendenze/controllo |
|---|---|---|---|
| viaggi | Viaggi | R/W, archivio logico | autobus_id, fermate, prenotazioni; pubblicazione lato sito |
| viaggi_fermate | Fermate | R/W | FK viaggio, ordine e orari |
| flotta | Flotta | R/W | layout, noleggi, viaggi; capacità effettiva |
| prenotazioni | Prenotazioni/Control Room | R/W, annullamento logico | viaggio_id, pagamenti, posti, storico |
| prenotazione_posti | Posti | R/W transazionale | UNIQUE viaggio/posto, prenotazione e layout |
| clienti | Anagrafica | R/W | possibile matching con prenotazioni non FK |
| pagamenti | Cassa | R/W controllato, H rettifiche | prenotazione, viaggio, operatore |
| economia_movimenti | Economia | R/H | evitare doppio conteggio con pagamenti |
| cassa_trasferimenti | Trasferimenti interni | R/H | operatori; quadratura contabile |
| cassa_chiusure | Chiusure | R/H | riconciliazione operatore/data |
| dg_quote_transfers_v61 | Quote interne | R/H | correlazione con cassa_trasferimenti |
| dg3_richieste_rettifica_cassa | Rettifiche | R/W approvazione | audit e importi |
| dg11_costi_viaggio | Margine | R/W | viaggio, costi documentati |
| noleggi_bus | Noleggi | R/W, archivio | clienti, date, contratto |
| noleggi_bus_mezzi | Assegnazione flotta | R/W | sovrapposizione di impegni |
| noleggi_bus_pagamenti | Cassa noleggi | R/H | noleggio, ricevuta |
| preventivi | Preventivi | R/W | cliente/noleggio, PDF |
| preventivi_versioni | Versioni preventivi | R/H | documento e numerazione |
| preventivi_contatori | Contatori | R/W in transazione | prevenire numeri duplicati |
| ricevute_versioni | Versioni ricevute | R/H | pagamenti e Storage |
| documenti_gestionali | Archivio | R/W permessi | bucket, signed URL, conferma upload |
| dg2_piantine | Editor legacy | R/W con versioning | flotta, JSON schema da validare |
| dg2_layout_library | Libreria piantine | R/W | versioni condivise |
| dg28_bus_layouts | Layout ufficiali flotta | R/W | vuota oggi; migrazione no distruttiva |
| dg28_trip_layouts | Layout ufficiali viaggio | R/W | vuota oggi; verifiche prima del passaggio |
| accessi_checkin | Accessi/Check-in | R/W | relazioni prenotazione e operatore |
| dg_viaggi_chiusure | Chiusure viaggio | R/H | viaggio |
| dg3_cancellazioni_prenotazioni | Annullamenti/rimborsi | R/H | pagamenti e debito di rimborso |
| lista_attesa | Lista attesa | R/W | viaggio e posti |
| notifiche | Notifiche | R/W | operatori e cronologia |
| dg_notification_reads | Letto per utente | R/W | notifiche/operatore |
| push_subscriptions | Push | R/W con consenso | notifiche e dispositivi |
| attivita_gestionale | Agenda | R/W | operatore e priorità |
| scadenze_gestionale | Agenda | R/W | viaggi, acconti, operatori |
| crm_attivita | CRM | R/W | clienti |
| fornitori | Costi/Fornitori | R/W | economia_movimenti |
| carburante_flotta | Flotta/Costi | R/W | mezzo |
| manutenzioni_flotta | Flotta/Manutenzione | R/W | mezzo |
| checklist_mezzi | Controlli mezzo | R/W | mezzo/autista |
| dg_blocchi_flotta | Indisponibilità flotta | R/W | conflitti viaggi/noleggi |
| operatori_gestionale | Utenti/Ruoli | R/W solo admin | auth.users, permessi, RLS |
| dg_biometric_credentials | Autenticazione | R/W secondo policy | Auth e WebAuthn, non password storage |
| dg_biometric_challenges | Autenticazione | R/W scadenze | autorizzazione server |
| dg_operator_communications | Messaggistica interna | R/W | mittente/destinatario |
| audit_log_gestionale | Audit | R/H | append only, nessuna cancellazione arbitraria |
| anomalie_gestionale | Monitoraggio | R/W | workflow risoluzione |
| backup_log_gestionale | Tracciamento backup | R/H | prova restore esterna |
| assistente_eventi | Audit assistente | R/H | verificare privacy/retention |
| ai_conversations | Assistente | R/W limitato | non critico P0 |
| ai_pending_plans | Assistente | R/W | autorizzazioni azioni |
| ai_operazioni | Assistente | R/H | audit |
| dg_whatsapp_inbox_v61 | WhatsApp | R/W | privacy e canale ufficiale |
| dg_whatsapp_trip_invites_v61 | Gruppi/Inviti | R/W | consenso partecipanti |
| dg_whatsapp_optins_v61 | Consensi | R/W | revoca |
| dg_whatsapp_outbound_v62 | Invii | R/H | esito e idempotenza |
| dg_comms_queue_v65 | Coda comunicazioni | R/W | retry controllato |
| dg_trip_group_consents_v65 | Consensi gruppo | R/W | revoca |
| dg3_wa_manual_logs | Storico manuale | R/H | invio manuale != API automatiche |
| dg3_fatture_bozze | Fatturazione | R/W bozza | NON equivale a emissione SdI |
| dg3_autisti | Autisti | F | nessun dato attuale |
| dg3_anomalie_verifiche | QA/Dati | R/H | riconciliazioni |
| dg3_impostazioni | Configurazione | R/W admin | precedenza e compatibilità impostazioni |
| impostazioni | Configurazione legacy | R/W admin | unificare lettura dopo verifica |

**Schema sito**: site_media (media), site_fleet (vetrina flotta), site_settings (impostazioni contatto), flotta_page (pagine), carousel_home / carousel_flotta / site_carousel_viaggi (carousel), gallery_eventi (gallery), info_azienda (contatti legacy), site_posts (news), site_party_events (eventi), site_admins (admin), viaggi/prenotazioni/preventivi (tabelle locali vuote, NON eleggere a fonte autorevole). Preservare sito e bridge.

**Schemi non-public rilevati**: auth (27 tabelle), dg_private (3), dg_security_backup (1), realtime (10), storage (10), supabase_migrations (1), vault (1). Struttura e policy di dettaglio NON ancora censite per instabilità connessione.

## Architettura proposta DOPO il recupero
- React/TypeScript con moduli separati e routing affidabile, build bloccata da lint, TypeScript, test e schema contract; scegliere Next.js soltanto se giustificato dall'integrazione.
- Supabase gestionale rimane unica fonte operativa per viaggio, posti, prenotazioni, pagamenti, agenda e flotta. Supabase sito rimane editoriale. Bridge server-side o RPC pubbliche strettamente validate.
- Auth Supabase esistente; autorizzazioni esclusivamente server-side e RLS. Niente service_role/secret nei client o nei log.
- API e RPC critiche con transazioni e idempotenza, chiavi uniche e invarianti verificati. Niente sincronizzazione fragile di record operativi su due database.
- Cache selettiva con invalida dopo scritture; no polling globale, chiamate deduplicate e cancellazione richieste obsolete. Optimistic update solo con rollback UI su errore.
- Source di piantina per viaggio definita/versionata in modo esplicito, fallback controllato ai layout esistenti; ogni variazione con preview impatto posti.
- Rimborsi: stato pratica e importo dovuto separati dal movimento reale; nessun falso rimborso.
- PDF: Storage privato, signed URL e controllo accesso, verifica oggetto dopo il salvataggio; scaricabile su Safari iOS.

## Gating di ripartenza / test
P0 (bloccante): accesso affidabile a PostgREST, verifica Auth su PC/iPhone, 12 viaggi pubblicati consultabili dal sito, lettura elenco prenotazioni e pagamenti, lettura piantine senza errori. Non testare scritture in produzione.
P1: backup completo esterno verificato (DB/schema/Auth/Storage/config), staging isolato, restore di prova; schema map, FK, trigger, RLS e contratti RPC. Sotto questo gate NON eseguire migrazioni/deploy produttivi.
P2: implementare e testare per moduli: CRUD prenotazioni, gestione posti e trasferimenti, pagamenti, Control Room, contabilità, agenda, documenti, noleggi.
P3: test concorrenza, PDF su iPhone, perf, a11y e sicurezza; preview Vercel con dati non reali; rollback testato e deploy controllato.
P4: osservabilità, reportistica, WhatsApp ibrido, pagamenti online predisposti ma disattivi, fatturazione dopo verifica fiscale.

## Prove NON ancora eseguite
- Full backup e restore, download/hash integrità oggetti Storage, esportazione account Auth.
- Autenticazione end-to-end con credenziali degli operatori; controllo sessioni sul dispositivo reale.
- Verifica funzionale reale di nuovo pagamento, nuova prenotazione, cambio posto, invio email, PDF, annullamento/rimborso.
- Diagnosi connessioni con pg_stat_activity (query fallite per temporanea inaccessibilità) e query plan.
- Collaudo mobile, build dei moduli, test concorrenza e deploy in staging.
- Mappa completa delle FK e delle policy di TUTTI gli schemi.

## Criterio di avanzamento
NON indicare DELGROSSO 4.0 come pronto. La situazione iniziale è RECUPERO API BLOCCATO/DA STABILIZZARE, dati identificati e in gran parte presenti; sviluppo applicativo e deployment futuri soggetti a backup verificato, staging e collaudo.
