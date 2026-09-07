DELGROSSO — VIAGGI + PRENOTAZIONI PUBBLICHE

Questa cartella contiene SOLO i file che vanno nel SITO PUBBLICO.
Il gestionale resta separato.
Entrambi usano lo stesso Supabase: exphxbeqwpwrsigdmilc.

FILE DA COPIARE NEL SITO:
- viaggi.html
- prenota.html
- conferma.html
- js/supabase.js
- js/viaggi.js
- js/prenota.js
- js/conferma.js
- services/viaggiService.js
- services/prenotazioniService.js
- services/bookingNotificationService.js

PRIMA DI PUBBLICARE:
1. Eseguire schema_operativo.sql nel SQL Editor del progetto Supabase.
2. Verificare che la pagina gestionale continui a vedere le tratte.
3. Inserire/valorizzare il campo prezzo nelle tratte se si vuole mostrare il prezzo online.
4. Pubblicare il sito.

SICUREZZA:
- Il browser usa esclusivamente la publishable/anon key.
- Le prenotazioni pubbliche vengono create tramite RPC atomica.
- Il sito non legge direttamente l'elenco delle prenotazioni.
- La conferma pubblica richiede ID + token.
- I posti vengono ricontrollati lato database per evitare doppie prenotazioni contemporanee.
