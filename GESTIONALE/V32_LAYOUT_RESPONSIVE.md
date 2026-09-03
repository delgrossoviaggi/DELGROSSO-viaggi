# V32 — Layout Responsive Unificato

## Obiettivo
Uniformare il design system del Gestionale Del Grosso Viaggi su iPhone/iOS, Android, tablet e PC.

## Modifiche
- Nuovo `assets/dg-responsive-v32.css` globale.
- Menu laterale/drawer unificato: stesso componente e stesso comportamento sulle pagine interne e sulla Dashboard.
- Dashboard: sidebar nativa nascosta e sostituita dal drawer del brand shell per evitare due menu diversi.
- Breakpoint dedicati a desktop, tablet e smartphone.
- Safe-area iOS e dynamic viewport support.
- Touch target minimo 48px per controlli e navigazione.
- Form e griglie fluidi senza overflow orizzontale.
- Tabelle contenute in aree scrollabili indipendenti.
- Modali adattivi all'altezza dinamica del dispositivo.
- Riduzione animazioni con `prefers-reduced-motion`.
- Nessuna modifica a dati, Supabase, servizi, Edge Functions o logica applicativa.
