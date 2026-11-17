# DELGROSSO 4.0 — VERIFICA BACKUP E INVENTARIO (17 novembre 2026)

## Ambito e limite fondamentale
Operazioni effettuate mediante collegamento Supabase: query SQL di **sola lettura**, inventario dei bucket Storage, conteggio dati, lettura stato progetto e advisory di sicurezza. Sono stati inoltre creati **soltanto file tecnici su ramo GitHub di audit**, non sono stati eseguiti deploy, SQL di modifica, restore o cancellazioni.

**I backup automatici in Database > Backups non sono consultabili con le azioni di connessione attualmente disponibili.** Il progetto appartiene a un'organizzazione Pro, per cui la piattaforma prevede backup schedulati, ma **nessuno snapshot specifico (ora/data e possibilità di restore) è stato certificato**. `public.backup_log_gestionale` ha 0 righe: questo registro applicativo non misura gli snapshot gestiti dalla piattaforma.

## Baseline database principale
Project ID: `chkuayhbmitdmzmmvona`
- 16 viaggi; 139 prenotazioni; 96 pagamenti; 642 assegnazioni posti.
- 2 utenti Auth; 2 operatori applicativi attivi.
- 157 righe nello storico versioni ricevute e 22.820 eventi audit al momento della verifica (dato variabile).
- Stato progetto: `ACTIVE_HEALTHY`, senza implicare uptime garantito.
- La diagnostica PGRST003 è documentata nel rapporto di audit precedente.

## Inventario Storage necessario per un vero backup fisico
| Progetto | Bucket | Privato | File | Byte (metadata) |
|---|---|---|---:|---:|
| gestionale | ricevute-prenotazioni | sì | 237 | 13.658.426 |
| gestionale | locandine | no | 56 | 104.017.535 |
| sito | site-media | no | 200 | 228.096.377 |
| gestionale | gestionale-documenti | sì | 0 | 0 |
| gestionale | preventivi-pdf | sì | 0 | 0 |
| gestionale | buses | no | 0 | 0 |
| gestionale | bus-images | no | 0 | 0 |
| gestionale | trip-images | no | 0 | 0 |

Totale 493 oggetti, 345.772.338 byte (~345,8 MB). **Si tratta di metadati, non di copia dei file.** Il backup gestito PostgreSQL NON include i contenuti binari di Supabase Storage: esportarli e testare un ripristino separatamente.

## Legacy security schema
La tabella `dg_security_backup.comms_grants_before_fix_20261021` ha **30 righe** reali, anche se le statistiche di catalogo `list_tables` indicavano un conteggio stimato diverso. Ha RLS disabilitata: advisory di attenzione. Una verifica dei GRANT ha trovato `USAGE` dello schema e `SELECT` della tabella **false** sia per `anon` che per `authenticated`; dunque non è dimostrata un'esposizione pubblica. Non modificare la policy senza verificare le dipendenze.
Altri advisory (richiedono valutazione separata): funzione `public.dg28_public_trip_layout_v1` SECURITY DEFINER invocabile da ruoli pubblici/autenticati; tabella `ai_operazioni` RLS senza policy; protezione Auth contro password compromesse non abilitata. Nessuna modifica eseguita.

## Procedure pronte, NON ANCORA ESEGUITE IN PRODUZIONE
1. `scripts/dg4-backup-db.ps1`: esportazione locale *integrativa* di ruoli/schema/dati operativi tramite CLI collegata, manifest SHA256. Non sostituisce snapshot gestito Auth e Storage.
2. `scripts/dg4-export-storage.mjs`: copia fisica dei bucket tramite API autenticata configurata localmente, checksum SHA256 per ciascun file e manifest privato. Richiede chiavi soltanto in variabili d'ambiente sulla postazione autorizzata.
3. `tests/dg4-storage-export-offline.test.mjs`: test offline predisposti; il loro esito NON è certificato in questa verifica.
4. `.github/workflows/dg4-backup-tests.yml`: workflow CI dedicato al ramo di audit, senza credenziali né accesso ai dati reali. Nessuna esecuzione verificata in questa sessione.
5. `docs/DELGROSSO-4.0-BACKUP-AND-SUPPORT-RUNBOOK.md`: procedura di ripristino e modello supporto.

## Criterio di accettazione per procedere alle modifiche in produzione
- [ ] Snapshot Supabase gestito presente, data/ora registrata in inventario PRIVATO.
- [ ] Dump SQL integrativo eseguito e SHA256 verificati.
- [ ] 493 oggetti della baseline (o conteggio aggiornato al momento del backup) esportati; checksum e dimensioni verificati.
- [ ] Credenziali, Edge Functions e configurazioni di ripristino archiviate in luogo privato sicuro.
- [ ] Ripristino di prova COMPLETATO su ambiente isolato, con confronto di righe, vincoli, RLS, account fittizi, documenti e simulazione lettura.
- [ ] Staging separato e senza invii automatici a clienti.
- [ ] Possibilità di rollback documentata e verificata.

## Come certificare lo snapshot gestito
Aprire dal proprio account:
https://supabase.com/dashboard/project/chkuayhbmitdmzmmvona/database/backups/scheduled
Registrare (in archivio privato): più recente snapshot, stato e modalità restore; NON premere Restore sulla produzione.
Ripetere per il progetto sito:
https://supabase.com/dashboard/project/bhsanrbadsqcpbtxupmr/database/backups/scheduled

Documentazione ufficiale:
https://supabase.com/docs/guides/platform/backups
https://supabase.com/docs/reference/cli/supabase-db-dump
https://supabase.com/docs/guides/storage/management/download-objects
