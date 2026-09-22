DELGROSSO GESTIONALE — PWA IPHONE
====================================

Questa versione è preparata per essere installata su iPhone come Web App
(aggiunta alla schermata Home), senza App Store Connect e senza file .ipa.

COSA USA
--------
- stesso gestionale HTML/JS già operativo;
- stesso progetto Supabase;
- nessun database locale duplicato;
- icone DELGROSSO dedicate a iPhone/PWA;
- manifest.webmanifest;
- service worker aggiornabile;
- interfaccia mobile già ottimizzata.

IMPORTANTE
----------
Per essere installata come app su iPhone deve essere pubblicata su un
indirizzo HTTPS pubblico. NON usare file:// e NON usare 127.0.0.1 dal telefono.

INSTALLAZIONE SU IPHONE
-----------------------
1. Pubblicare questa cartella su un hosting HTTPS (GitHub Pages, Cloudflare
   Pages, Netlify o altro hosting statico).
2. Aprire l'indirizzo HTTPS con Safari su iPhone.
3. Accedere al gestionale.
4. Premere Condividi.
5. Scegliere "Aggiungi alla schermata Home".
6. Aprire l'icona "DELGROSSO".

SINCRONIZZAZIONE
----------------
PC e iPhone continuano a usare lo stesso Supabase. Una prenotazione, pagamento,
cliente, viaggio o modifica salvata da un dispositivo viene letta dagli altri
dispositivi tramite il database centrale.

GITHUB
------
La cartella è pronta per essere copiata nel repository.
Il database NON va messo su GitHub.

AGGIORNAMENTI
-------------
Dopo una modifica al gestionale basta pubblicare i nuovi file sullo stesso
indirizzo HTTPS. Il service worker usa una strategia network-first per la
pagina principale, così gli aggiornamenti vengono recuperati dal server.

NOTA
----
Questa è una PWA/Web App, non una .ipa firmata da Apple.
Non richiede App Store Connect per l'uso come Web App sulla schermata Home.


FUNZIONI PRENOTAZIONI
---------------------
Dal gestionale è possibile:
- creare una nuova prenotazione direttamente;
- scegliere il viaggio;
- inserire cliente, telefono ed email;
- selezionare i posti dalla pianta;
- impostare totale e stato;
- modificare una prenotazione esistente;
- annullare una prenotazione liberando i posti;
- eliminare definitivamente una prenotazione (se consentito dalle policy Supabase);
- stampare la conferma di prenotazione.

Il salvataggio sincronizza la pianta posti tramite la funzione Supabase
dg_sync_booking_seats.


FUNZIONI OPERATIVE AGGIUNTE / VERIFICATE
------------------------------------------
- Prenotazione manuale direttamente dal gestionale.
- Selezione posti dalla pianta del viaggio.
- Modifica prenotazioni.
- Annullamento prenotazioni con liberazione posti.
- Eliminazione definitiva prenotazioni (con RPC quando disponibile e fallback REST).
- Stampa conferma prenotazione.
- Modulo Preventivi con creazione e modifica.
- Inbox richieste preventivo: le righe provenienti dal sito vengono evidenziate come richieste online.
- Filtri per stato e provenienza.
- Presa in carico richiesta e cancellazione.
- Il gestionale legge la tabella Supabase `preventivi`: il modulo del sito deve scrivere nella stessa tabella per far arrivare automaticamente le richieste.
- Layout corretto a larghezze tablet/desktop strette: niente sovrapposizione tra sidebar e contenuto.

NUOVE FUNZIONI V5
------------------
- Prenotazione manuale dal gestionale con piantina posti.
- Modifica, annullamento e cancellazione prenotazioni.
- Preventivi e richieste dal sito in un'unica sezione.
- Notifica Supabase per nuove richieste preventivo.
- Presa in carico delle richieste.
- Conversione di un preventivo in prenotazione con assegnazione posti.
- Layout tablet/iPhone corretto per evitare sovrapposizione sidebar/menu.
