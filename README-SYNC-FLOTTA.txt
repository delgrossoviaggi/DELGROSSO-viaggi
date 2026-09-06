SINCRONIZZAZIONE FLOTTA DELGROSSO

FIX APPLICATO
- public.flotta (Gestionale Supabase) e' la tabella canonica della flotta.
- admin.html usa il progetto Gestionale per leggere/scrivere la flotta.
- flotta.html legge la stessa tabella canonica.
- index.html legge la stessa tabella canonica.
- La migrazione automatica da flotta_page importa i mezzi legacy una sola volta tramite legacy_id.
- Fix errore screenshot: la colonna public.flotta.targa e' stata resa opzionale, perche' i vecchi record non contengono necessariamente una targa.
- Anche i posti possono restare vuoti quando il dato non e' presente nel record legacy.

DOPO IL DEPLOY
1. Aprire admin.html.
2. Ricaricare con CTRL+F5.
3. Attendere il messaggio di importazione completata.
4. Aprire flotta.html e index.html e ricaricare CTRL+F5.

NON MODIFICARE IL PROGETTO SUPABASE VECCHIO PER LA FLOTTA:
la flotta deve essere gestita da public.flotta nel progetto Gestionale.
