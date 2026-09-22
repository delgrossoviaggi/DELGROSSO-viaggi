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
