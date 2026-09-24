DELGROSSO GESTIONALE 3.1 — AUDIT AVANZATO

Obiettivo
- Stessa interfaccia grafica di riferimento su PC, iPhone e tablet.
- Su iPhone la struttura resta quella PC: topbar bianca, superfici bianche, sfondo chiaro, menu laterale navy richiamabile dal pulsante ☰. Non viene usata una seconda interfaccia dark separata.

Correzioni applicate
1. Control Room: definito isoToday nel modulo.
2. Control Room: definiti residual e fleet prima del timeline/render, evitando ReferenceError/Temporal Dead Zone.
3. Dossier viaggio: definiti isoToday e liveBadge prima dell'uso.
4. Render dei moduli isolato: un errore di una pagina non viene più interpretato come errore di sincronizzazione Supabase.
5. Aggiunto pannello di errore locale con ricarica del singolo modulo.
6. Mobile: eliminata la grafica mobile separata e ricondotta alla stessa lingua visuale desktop.
7. Mobile: menu laterale navy coerente con la sidebar PC.
8. Mobile: topbar bianca coerente con quella PC, ricerca separata e senza sovrapposizioni.
9. Mobile: modali mantengono le superfici bianche e la gerarchia desktop.
10. Control Room mobile: KPI in griglia compatta e dossier senza grandi blocchi vuoti.
11. Dashboard mobile: mantenuta la composizione DELGROSSO della reference, con dimensioni responsive.
12. Service worker: cache aggiornata a v7 per evitare che iPhone continui a servire il vecchio index.html.

Supabase
- Progetto: chkuayhbmitdmzmmvona
- archivio_documenti presente e interrogabile tramite updated_at.
- economia_movimenti presente.
- dg_reconcile_payments_economia() presente.
- Nessun database locale aggiunto.

Footer
©DELGROSSO VIAGGI 2026
©CREATED CRISTINO NICOLA PIO

Nota
Il pacchetto contiene il gestionale web/PWA. Per usarlo su iPhone tramite Aggiungi alla schermata Home serve un URL HTTPS pubblico; localhost/127.0.0.1 del PC non è raggiungibile dall'iPhone.
