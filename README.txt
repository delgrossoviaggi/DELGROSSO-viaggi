DELGROSSO SITE V7 - PATCH SICURA
=================================

Questa patch nasce dal controllo del backup DELGROSSO_SITO(1).zip e del repository pubblico dopo il commit d64ea02.

OBIETTIVO
- Flotta pubblica: leggere ESCLUSIVAMENTE dal Supabase SITO, tabella flotta_page.
- Admin upload: rendere più robusto l'upload Cloudinary.
- NON modificare il Supabase Gestionale.
- NON modificare la cartella GESTIONALE.
- NON sostituire l'intero sito.

FILE DA INSERIRE
1) js/bridge.js
   Sostituisce il bridge attuale. getFlottaPubblica() usa il Supabase SITO.
   Le altre funzioni (Partenze/Preventivo/Prenotazione) restano invariate.

2) js/admin-uploadCloudinary-fixed.js
   È una copia di riferimento della nuova funzione uploadCloudinary.
   NON viene caricata automaticamente da admin.html.

3) PATCH/admin-uploadCloudinary-function.txt
   Spiega come sostituire SOLO la funzione in admin.html.

IMPORTANTE
- Non copiare nulla dentro GESTIONALE/.
- Non cambiare tabelle o colonne del Supabase Gestionale.
- Non sostituire index.html, viaggi.html, prenota.html o preventivo.html con versioni del backup.
  Il backup contiene versioni precedenti alla V6 e non deve sovrascrivere il repository attuale.

ORDINE CONSIGLIATO
1. Sostituire js/bridge.js.
2. In admin.html sostituire SOLO uploadCloudinary().
3. Testare Flotta pubblica.
4. Testare upload Carousel Home, Carousel Flotta e Flotta.
5. Solo dopo fare il successivo audit di Home / Partenze / Preventivo.

ROLLBACK
Prima di sostituire js/bridge.js, salvare una copia del file attuale.
Prima di modificare admin.html, salvare una copia.
