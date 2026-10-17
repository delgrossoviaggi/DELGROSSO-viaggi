DELGROSSO GESTIONALE OPERATIVO V3

Base UI: interfaccia DELGROSSO approvata dall'utente.
Logo: logo ufficiale fornito dall'utente, usato senza ridisegnarlo; viene solo ritagliato dai margini bianchi per una resa corretta nell'interfaccia.

SUPABASE GESTIONALE
Project ref: chkuayhbmitdmzmmvona
URL: https://chkuayhbmitdmzmmvona.supabase.co
Stato progetto verificato: ACTIVE_HEALTHY

Dati presenti verificati nel progetto:
- 15 viaggi
- 36 prenotazioni
- 27 clienti
- 7 pagamenti
- 5 mezzi in flotta
- 1 noleggio bus
- 159 assegnazioni posti
- 22 notifiche

AUTH
- Operatore: nicola / account Supabase nicola@delgrossoviaggi.it
- L'accesso usa Supabase Auth.
- La password NON viene più salvata nel file distribuito.

OPERATIVITA'
- CRUD viaggi
- CRUD prenotazioni
- Piantina posti con controllo conflitti tramite RPC Supabase
- Clienti
- Acconti / saldi / rimborsi tramite RPC Supabase
- Sincronizzazione pagamento -> prenotazione
- Conferma prenotazione
- Check-in
- Control Room
- Flotta
- Noleggi & Limousine BUS
- Preventivi
- Notifiche
- Documenti
- Agenda
- Economia / incassi
- Statistiche
- Backup JSON e CSV
- Audit log
- Sincronizzazione integrità Supabase
- Auto-sync ogni 20 secondi quando il gestionale è visibile
- Refresh sessione Supabase

RPC usate dal gestionale:
- dg_register_payment
- sync_prenotazione_pagamenti
- dg_sync_booking_seats
- dg_generate_confirmation
- dg_assign_seats
- sync_gestionale_integrity

NOTE
La verifica diretta HTTP dal container non è stata possibile per assenza di DNS nella sandbox; il progetto Supabase è stato invece verificato tramite l'integrazione Supabase, compresa la presenza delle tabelle, RPC, dati e utente Auth.
