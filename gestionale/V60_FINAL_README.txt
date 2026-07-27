GESTIONALE DEL GROSSO VIAGGI - FINAL BUILD

Analisi pacchetto originale:
- moduli presenti: login, dashboard, viaggi, flotta, clienti, pagamenti, report
- individuati file con funzioni sovrapposte (vecchie versioni e versioni PRO)

Regola finale consigliata:
Usare come moduli principali:
- dashboard-master.html
- gestione-viaggi.html
- nuovo-viaggio.html
- gestione-mezzi.html
- clienti.html
- pagamenti.html (da collegare alla versione definitiva)
- report-viaggio.html

Prima del deploy finale verificare:
1) collegamento Supabase
2) nomi tabelle
3) script caricati nelle pagine
4) RLS Supabase
5) test prenotazione reale

Modifiche richieste applicate come impostazione:
- flotta senza targa
- flotta senza anno
- niente autisti
- niente manutenzione
- pagamenti solo manuali contanti
- clienti collegati alle prenotazioni
