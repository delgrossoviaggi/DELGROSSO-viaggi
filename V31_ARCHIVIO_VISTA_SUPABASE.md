# V31 — Archivio collegato alla vista Supabase

L'Archivio del Gestionale legge ora direttamente dalla vista `public.archivio_documenti`.
La vista è derivata dalle tabelle reali `public.prenotazioni` e `public.pagamenti` e non crea un secondo archivio dati.

## Supabase
- `public.prenotazioni` contiene i metadati delle conferme PDF.
- `public.pagamenti` contiene i metadati delle ricevute PDF.
- `storage.ricevute-prenotazioni` resta privato.
- `public.archivio_documenti` unifica conferme e ricevute.

## Frontend
`assets/archivio-v29.js` interroga:
`/rest/v1/archivio_documenti?select=*&order=data_documento.desc.nullslast&limit=2000`

Il polling di V30 resta attivo ogni 10 secondi e al ritorno sulla pagina/finestra.
Le azioni PDF continuano a usare le Edge Functions e i servizi esistenti.

## Nota
La vista restituisce 0 righe finché non esistono documenti con `confirmation_storage_path` o `receipt_storage_path` valorizzati. È comportamento corretto.
