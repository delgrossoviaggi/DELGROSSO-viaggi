# DELGROSSO VIAGGI — RIPRISTINO SITO V13

Ripristino del sito pubblico DELGROSSO Viaggi & Limousine Bus.

## Cosa contiene
- Homepage completa
- Partenze con sincronizzazione al bridge pubblico Gestionale
- Dettaglio viaggio
- Prenotazione con piantina GT53 / GT63 / GT63B
- Ricevuta PDF automatica dopo la prenotazione
- Totale viaggio = prezzo per persona × numero posti
- Posti scelti riportati nella ricevuta
- Email facoltativa nella prenotazione
- Flotta, Limousine, Party on the Road, Chi siamo, Contatti, News, Preventivo
- Area admin del sito
- Supabase SITO e bridge pubblico già referenziati

## Protezione del Gestionale
La cartella `Gestionale/` è stata mantenuta senza modifiche in questo ripristino. Non va cancellata, rinominata o modificata durante il caricamento.

## Verifiche locali eseguite
- riferimenti locali HTML/CSS/JS/immagini: OK
- sintassi `js/site.js`: OK
- sintassi `js/gestionale.js`: OK
- sintassi `js/ricevuta.js`: OK
- pagine principali servite correttamente dal server locale: OK

## Nota GitHub
Il repository online attualmente contiene una pagina di manutenzione come `main/index.html`. Il connettore GitHub disponibile in questa sessione restituisce HTTP 403 sulle operazioni di scrittura. Per questo il pacchetto è pronto per il caricamento nel repository, ma non è stato dichiarato come pubblicato online.
