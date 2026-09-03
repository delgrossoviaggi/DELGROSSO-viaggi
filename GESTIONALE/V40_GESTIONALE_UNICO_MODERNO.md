# DELGROSSO VIAGGI — V40

V40 è la revisione grafica unificata del Gestionale.

## Pagine incluse
Dashboard, Viaggi, Prenotazioni, Prenotazione singola, Clienti, Flotta, Pagamenti, Archivio, Preventivi, Preventivo nuovo, CHECK-IN, Notifiche, Statistiche, Impostazioni e Centro Operativo.

## Navigazione
Un solo shell/menu V40 condiviso da tutte le pagine. Archivio è una voce nativa del menu.

## Responsive
Layout adattivo per iPhone/iOS, Android, iPad/tablet, notebook e desktop. Include Safe Area, menu touch, focus tastiera, modali scrollabili e tabelle con overflow interno.

## Archivio/Supabase
L'Archivio continua a usare `public.archivio_documenti`, derivata dalle tabelle esistenti `prenotazioni`, `pagamenti` e `viaggi`. Nessuna seconda banca dati.

Nota: se Supabase restituisce 0 documenti, significa che non esistono ancora PDF con `confirmation_storage_path` o `receipt_storage_path` valorizzati.
