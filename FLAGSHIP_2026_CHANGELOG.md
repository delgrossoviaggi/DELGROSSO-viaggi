# DELGROSSO VIAGGI — FLAGSHIP 2026 / V30

## Obiettivo
Trasformare il sito pubblico in una vetrina premium per DELGROSSO Viaggi & Limousine Bus senza cambiare il contratto dati con il Gestionale.

## Interventi principali
- Home completamente rimodulata con hero cinematografico, CTA prenotazione, disponibilita' live e ricerca partenze.
- Nuovo blocco "DELGROSSO LIVE" alimentato dai dati gia' ricevuti dal Gestionale.
- Rail destinazioni dinamico e gerarchia commerciale piu' chiara.
- Nuovo design system unico `assets/flagship-2026.css` caricato per ultimo su tutte le pagine pubbliche.
- Ripulito `js/site.js`: eliminati layer UX storici duplicati (ricerche multiple, back-to-top multipli, vecchi enhancement) e sostituiti con un solo layer Flagship.
- CTA `Prenota` aggiunta alla navigazione e resa primaria.
- Barra rapida mobile a tre azioni: Partenze, Prenota, WhatsApp.
- Footer arricchito automaticamente con i social configurati in `js/site-config.js`.
- JSON-LD Organization iniettato dal frontend usando i dati pubblici gia' configurati.
- Sitemap estesa a prenotazione, noleggio, preventivo e Party on the Road.
- Aggiunto `manifest.webmanifest`.
- Vercel: aggiunti HSTS, DNS prefetch control e cache moderata per asset statici.

## Collegamento con il Gestionale — protetto
Questi elementi sono stati lasciati invariati:
- `js/gestionale.js`
- `gestionale-bridge-v6-index.ts`
- logica inline di prenotazione in `prenota.html`
- logica inline elenco viaggi in `viaggi.html`
- logica inline dettaglio viaggio in `viaggio.html`

I relativi checksum / confronti sono stati verificati durante la build.

## Supabase verificato
- Progetto `delgrosso-sito` presente e ACTIVE_HEALTHY.
- Tabelle pubbliche principali del sito con RLS attivo.
- Edge Function `gestionale-bridge` presente e ACTIVE.
- Versione live della Edge Function rilevata: **8**.
- Il file locale `gestionale-bridge-v6-index.ts` e' quindi da considerare uno snapshot precedente e non va ridistribuito alla cieca.

## Test locali eseguiti
- Sintassi di tutti i file JS esterni con `node --check`.
- Sintassi di tutti gli script inline HTML con `node --check`.
- Parsing CSS Flagship senza errori.
- Verifica riferimenti locali CSS/JS/immagini.
- Verifica assenza ID duplicati nelle pagine pubbliche principali.
- Verifica checksum dei file protetti Supabase/bridge.
