# DELGROSSO 4.0 — Backup, verifica e supporto PGRST003

Data 17/11/2026. Progetto **gestionale**: `chkuayhbmitdmzmmvona`. Progetto **sito**: `bhsanrbadsqcpbtxupmr`. **NON RIPRISTINARE DIRETTAMENTE IN PRODUZIONE.**

## Checklist operativa backup
1. Accedere a https://supabase.com/dashboard/project/chkuayhbmitdmzmmvona/database/backups/scheduled e verificare se esiste un backup ripristinabile e la data/ora effettiva. Registrare la data in un inventario PRIVATO, non nel repository pubblico. La presenza del progetto non prova che un backup esista.
2. Esportare in uno storage cifrato e privato il database PostgreSQL (ruoli, schema, dati, Auth e policy pertinenti) con procedura di dump ufficiale o backup gestito. Conservare una copia esterna al progetto Supabase. Non pubblicare dump o credenziali su GitHub, nemmeno in un branch privato di repo pubblico.
3. Esportare **fisicamente tutti gli oggetti Storage**, non solo la tabella `storage.objects`. I backup PostgreSQL di Supabase conservano i metadati, NON i file. Inventario iniziale: 237 ricevute e 56 locandine; numero oggetti e relativi checksum devono coincidere tra export e origine. Includere inoltre gli eventuali oggetti del progetto sito.
4. Salvare in archivio privato configurazioni indispensabili al ripristino: elenco dei bucket e loro policy, versioni delle Edge Functions, env var **solo con gestore segreti**, Auth settings, redirect URLs, procedure di rotazione; **mai** inserire token e password nel repository.
5. Creare uno staging davvero isolato solo previa verifica dei costi e del consenso. Preferire dati sintetici/anonimizzati, nessuna email/WhatsApp di produzione e nessuna condivisione di chiavi della produzione. La branch Supabase **non copia automaticamente** i dati di produzione.
6. Ripristinare copia su staging; verificare integrità schema, funzioni, utenti simulati e Storage, confrontare righe e checksum. Il solo completamento di un download non certifica il backup.
7. Solo dopo backup e restore verificati, proporre ottimizzazioni/patch e deploy controllati con rollback.

Riferimenti ufficiali: https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/storage/management/download-objects

## Modello ticket Supabase (da inviare solo se il guasto persiste/ricompare)

Oggetto: Production incident — PostgREST PGRST003 connection pool timeouts, project chkuayhbmitdmzmmvona

Hello Supabase Support,

On 2026-11-17 our production project `chkuayhbmitdmzmmvona` (eu-west-3, PostgreSQL 17.6, PostgREST 14.5) experienced intermittent Data API unavailability. Between approximately 07:00 and 07:30 UTC, many PostgREST log entries reported:

`PGRST003: Timed out acquiring connection from connection pool.`

Examples:
- 2026-11-17 07:29:55 UTC: Failed to query role settings, PGRST003.
- 2026-11-17 07:30:05 UTC: Failed to load schema cache, PGRST003.
- Site project's Edge Function `gestionale-bridge` was unable to query the schema cache at 07:27:17 UTC.
- Public trip listing and internal management reads were affected; REST requests returned 503.

Later, at 07:33 UTC PostgREST logged a successful connection to PostgreSQL and schema cache loading. At a subsequent read-only snapshot, PostgreSQL used 28 of max 60 connections, 2 active, 0 idle-in-transaction, 0 lock waits. PostgREST reported its internal pool max size 10. API GET 200 results were subsequently recorded. This may be an intermittent condition.

Please investigate infrastructure/service-side changes, connection-pool saturation, long-running queries and any incidents or restarts during this interval. Please confirm any corrective actions or recommended configuration changes to avoid recurrence. We have not intentionally reset users, modified RLS, destroyed data, or run recovery SQL.

Business impact: customer trip availability and bookings, plus internal reservations and payments.
Related site Supabase project: `bhsanrbadsqcpbtxupmr`.
We can share sanitized logs and diagnostics through a secure support channel. Please do not request credentials by email.

Thank you.

Support portal: https://supabase.com/dashboard/support/new
