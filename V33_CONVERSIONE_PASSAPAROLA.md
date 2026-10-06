# DELGROSSO VIAGGI — FLAGSHIP V33

## Obiettivo
Rendere il sito più accattivante e orientato a due azioni reali: prenotazione e passaparola.

## Novità V33
- Nuovo messaggio commerciale nella Home: meta + persone con cui partire.
- Nuovo messaggio nella pagina Viaggi: trova, condividi, prenota.
- Sezione dinamica "Trova la partenza. Mandala al gruppo." nelle prime pagine pubbliche.
- Nuova sezione Home "Perché prenotare con DELGROSSO" basata solo su funzioni reali del sito.
- Pulsante di condivisione aggiunto automaticamente ai viaggi disponibili.
- Condivisione della singola partenza tramite Web Share API; fallback copia link.
- Pulsante WhatsApp nella scheda del singolo viaggio.
- Fascia "Questo viaggio ti piace? Non tenerlo per te" nella scheda viaggio.
- Invito a condividere la partenza direttamente nella pagina Prenota.
- Dopo una prenotazione confermata viene proposta la condivisione della stessa partenza su WhatsApp.
- La CTA mobile della scheda viaggio mantiene l'ID della partenza e porta direttamente alla prenotazione corretta.
- Micro-animazione sugli stati "ultimi posti" solo quando la disponibilità reale lo giustifica.

## Sicurezza funzionale
Nessuna modifica a database, RLS, RPC, Edge Function o schema Supabase.
Nessuna modifica ai file core:
- js/gestionale.js
- js/site.js
- js/public-data.js
- js/quote.js

Lo script operativo inline di prenota.html è identico alla V32.

## Filosofia UX
La V33 evita contatori finti, recensioni inventate, sconti non esistenti o urgenza artificiale. Le leve commerciali usate sono: chiarezza, disponibilità reale, scelta del posto, contatto umano e condivisione semplice.
