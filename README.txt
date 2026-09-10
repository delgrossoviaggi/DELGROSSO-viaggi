DELGROSSO VIAGGI - SITE PRO

SUPABASE
- Sito / contenuti: https://bhsanrbadsqcpbtxupmr.supabase.co
- Gestionale / partenze / prenotazioni / preventivi: https://chkuayhbmitdmzmmvona.supabase.co

COLLEGAMENTI OPERATIVI
- Partenze / Viaggi: lettura da tabella gestionale "viaggi".
- Prenota: lettura da "viaggi" e invio tramite RPC "create_public_booking"; posti occupati tramite RPC "get_public_booked_seats".
- Richiedi Preventivo: invio tramite RPC "create_public_quote".
- Le pagine di contenuto (Home, Flotta, Party, Contatti, Admin) restano collegate al Supabase del sito.

IMPORTANTE
Le RPC pubbliche devono essere abilitate sul progetto Gestionale con le policy già previste dal progetto. Non vengono effettuate modifiche al Gestionale da questo pacchetto.
