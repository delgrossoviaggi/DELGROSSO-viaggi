# DEL GROSSO GESTIONALE V101 — Advanced Executive Hotfix

## Fix critico
Risolto l’errore JavaScript `The requested module './pagamenti-CkMIF-LJ.js' does not provide an export named 't'`.

Il layer Executive non importa più il modulo pagina `pagamenti` come se fosse un servizio ES module. Il Dashboard continua a calcolare gli incassi dai dati delle prenotazioni, evitando il caricamento errato che bloccava il layer e generava l’errore visualizzato nel gestionale.

## Stabilità
- asset rinominati/bustati a V101 per evitare cache stale;
- riferimenti HTML aggiornati;
- Service Worker version bumped;
- core Supabase non modificato.
