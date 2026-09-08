# Correzione collegamento viaggio -> flotta -> piantina

Il sito pubblico deve usare la stessa relazione del Gestionale:
`viaggi.autobus_id` -> `flotta.id` -> `flotta.seat_layout`.

Sono stati corretti anche i fallback del sito per riconoscere la targa GS038BB come GT63.
Nel Supabase del Gestionale i viaggi pubblicati sono stati riallineati alla flotta e GS038BB ha `seat_layout = GT63`.

La cartella `GESTIONALE/` non e' stata modificata.
