DELGROSSO GESTIONALE — COMPLETO SUPABASE
==========================================

Questa versione usa il progetto Supabase gestionale:
https://chkuayhbmitdmzmmvona.supabase.co

AUTENTICAZIONE
--------------
L'accesso non è più simulato in locale.
Il campo "nicola" viene tradotto nell'utente Supabase:
nicola@delgrossoviaggi.it

La password viene verificata da Supabase Auth.

DATI SINCRONIZZATI
------------------
viaggi
prenotazioni
clienti
pagamenti
flotta
notifiche
accessi_checkin
preventivi
impostazioni
noleggi_bus
noleggi_bus_mezzi
noleggi_bus_pagamenti
prenotazione_posti
attivita_gestionale
scadenze_gestionale
audit_log_gestionale

BRAND
-----
Il logo ufficiale fornito dall'utente è:
assets/delgrosso-logo-ufficiale.jpg

NOTE
----
- Non contiene service_role key.
- Usa la publishable key e il token autenticato Supabase.
- Le operazioni di scrittura su viaggi/flotta/posti vengono eseguite con ruolo authenticated.
- È presente refresh del token quando scade.
- La sincronizzazione completa può essere avviata da Impostazioni.
- È stata aggiunta una policy authenticated INSERT per audit_log_gestionale.
