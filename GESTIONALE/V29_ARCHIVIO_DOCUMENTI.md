# V29 — Archivio Documenti

Aggiunta pagina `archivio.html` al menu del Gestionale.

L’Archivio raccoglie automaticamente i documenti già archiviati in Supabase:
- conferme di prenotazione viaggio (`prenotazioni.confirmation_storage_path`)
- ricevute acconto (`pagamenti.receipt_storage_path`)
- ricevute saldo (`pagamenti.receipt_storage_path`)

Funzioni disponibili: ricerca, filtri, visualizza PDF, scarica PDF, reinvia email.
La pagina non crea una seconda copia dei documenti: usa gli stessi PDF ufficiali già presenti nel bucket privato `ricevute-prenotazioni`, evitando duplicati.
