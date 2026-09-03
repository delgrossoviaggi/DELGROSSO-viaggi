# V34 — Menu unico + accesso Prenotazioni

## Fix principale
- Eliminato il doppio `brandShell` presente nelle build precedenti.
- Tutti i moduli che importavano il vecchio `brandShell-CwQ6UnLs.js` ora usano esclusivamente `brandShell-CIWNUkWr.js`.
- Il menu unico ora include sempre **Archivio**.
- La voce **Prenotazioni** usa il percorso `./prenotazioni.html` dalla mappa centralizzata.
- Eliminato il vecchio chunk shell duplicato per evitare che una pagina carichi un menu differente.

## Responsive
Restano attivi i CSS V32/V33 per iPhone, Android, tablet/iPad e PC.

## Dati e funzioni
Nessuna modifica a Supabase, prenotazioni, pagamenti, Archivio, PDF, email, CHECK-IN o notifiche.
