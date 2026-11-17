# DELGROSSO 4.0 — aggiornamento ripresa API (17/11/2026)

## Stato misurato
- Progetto gestionale `chkuayhbmitdmzmmvona`: ACTIVE_HEALTHY.
- Alle 07:33 UTC PostgREST 14.5 ha registrato "Successfully connected to PostgreSQL 17.6", cache schema caricata, internal connection pool = 10.
- Campionamento pg_stat_activity: **28/60** connessioni PostgreSQL, **2** attive, **0** transazioni inattive aperte, **0** attese sui lock.
- Ultimo PGRST003 individuato nei log: 07:30:05 UTC. Errore: timeout del pool PostgREST durante ricostruzione schema cache.
- Dall'API principale risultano GET 200 su `/rest/v1/viaggi`, `/rest/v1/viaggi_fermate` e `/rest/v1/notifiche` anche dopo la ripartenza.
- Dal bridge del sito `gestionale-bridge` risultano POST HTTP 200 fino alle 08:03 UTC; questo NON verifica automaticamente il contenuto restituito o il checkout di una prenotazione.
- Auth ha registrato risposte HTTP 200 per la verifica di sessione e un login password in mattinata; non è stato eseguito un login end-to-end con dispositivo effettivo.
- 2 operatori attivi con corrispondenza a utenti Auth valida.
- Conteggi immutati rispetto all'audit precedente: 16 viaggi, 12 pubblicati e futuri, 139 prenotazioni, 96 pagamenti, 642 righe posti.
- Storage metadata: 237 oggetti in `ricevute-prenotazioni` e 56 in `locandine`. Non sono stati scaricati né verificati contenuti e checksum.
- `pg_stat_statements`: chiamate ripetute alla lettura `notifiche` (~55 ms in media su campione); 4.7k chiamate a routine del decoder Realtime (~9.7 ms in media), ma nessuna prova del motivo del PGRST003. Nel client sono state osservate più letture uguali al minuto; da deduplicare.
- Indicazioni di salute attuali sono **puntuali**, NON garanzia di stabilità continua.

## Decisione tecnica
**Nessun SQL di modifica, deploy o restart di emergenza autorizzato eseguito.** La Data API è ora nuovamente raggiungibile in richieste osservate. Non riavviare servizi che stanno rispondendo senza prima esaminare le metriche storiche. Preparare subito backup di DB+Auth e Storage, provare ripristino su staging prima di modifiche produttive.

## Test live non distruttivi
Un controllo di sola lettura dell'health endpoint `GET /functions/v1/gestionale-bridge?health=1` e del catalogo con `POST {"action":"trips"}` è possibile con il test in `tests/dg4-live-readonly-health.mjs` se eseguito su una macchina con accesso alla rete. NON eseguire azioni `booking` su produzione per collaudo.

## Se il guasto si ripresenta
Registrare ora UTC, frequenza dei PGRST003, statistiche pg_stat_activity e grafici connections/CPU/RAM/I/O nel dashboard. Aprire ticket https://supabase.com/dashboard/support/new con le prove (modello nel file di backup/supporto) e segnalare mancata disponibilità Data API con impatto commerciale. Nessuna chiave o dato cliente nel ticket.

## Backups
La disponibilità effettiva dei backup NON è stata accertata con tool: dashboard Supabase Database > Backups e copia separata dei file Storage. Backup DB senza oggetti Storage NON è una protezione completa.