# DELGROSSO V29 — monitoraggio esterno e fallback automatico

**NON ANCORA ATTIVO:** questo pacchetto prepara il sistema, ma va configurato e pubblicato su Cloudflare.

## Architettura
Cloudflare Worker davanti al sito pubblico + cron ogni minuto + KV persistente + Resend per e-mail. Usa l’URL diretto `*.vercel.app` come `ORIGIN_URL`, **mai il dominio pubblico** (evita il loop). Non includere `/GESTIONALE/*` nelle route del Worker: il Gestionale resta separato. Se il Gestionale risiede sullo stesso hosting Vercel, una caduta totale di Vercel può colpirlo comunque: serve hosting indipendente per vera continuità.

## Configurazione
1. Crea un Worker Cloudflare, una KV Namespace e configura la binding `MONITOR_KV` con il relativo ID. Copia `wrangler.toml.example` in `wrangler.toml` e compila l’URL Vercel diretto.
2. Verifica un dominio mittente in Resend e configura `ALERT_FROM` (es. `Monitor DELGROSSO <monitor@delgrossoviaggi.it>`), `ALERT_TO=info@delgrossoviaggi.it`. Aggiungi `RESEND_API_KEY` come secret del Worker con `wrangler secret put RESEND_API_KEY`.
3. Aggiungi `MONITOR_SECRET` come secret con `wrangler secret put MONITOR_SECRET` per proteggere l’endpoint diagnostico.
4. Pubblica prima la V29 su Vercel, verificando `https://TUO-VERCEL.vercel.app/health.txt` e la Home; poi pubblica il Worker e assegna SOLO le route del sito pubblico. Evita di instradare `/GESTIONALE/*` al Worker. La route esatta dipende dalla configurazione Cloudflare: se non puoi escluderla in sicurezza, usa un sottodominio pubblico separato.
5. Testa in ambiente di prova: disattiva temporaneamente l’origine di test, attendi 3 controlli falliti (circa 3 minuti), verifica pagina 503 e prima e-mail; ripristina, attendi 2 controlli riusciti e verifica seconda e-mail. Testa anche un errore 500 su una pagina pubblica.

## Comportamento
- Monitoraggio ogni minuto: `health.txt` + Home. Tre fallimenti consecutivi → modalità manutenzione; due successi consecutivi → ripristino automatico.
- Errore HTTP 5xx o timeout su una richiesta pubblica: pagina manutenzione 503 immediata, anche prima della soglia globale; il monitor verifica in background.
- Email di guasto/ripristino a `info@delgrossoviaggi.it` con errore e timestamp; eventuali errori di invio sono registrati nei log Cloudflare, non garantiti come consegna immediata.
- Le verifiche controllano disponibilità HTTP, NON dimostrano che tutte le prenotazioni o Supabase funzionino: per quelli servono test sintetici separati e senza prenotazioni reali.
- Se Cloudflare stesso non è disponibile, nessun fallback su Cloudflare può garantire la continuità. Un sistema non può garantire zero crash.
- La pagina `index.manutenzione.html` è presente anche nel sito; il Worker serve un HTML equivalente incorporato, indipendente da Vercel, in caso di blackout dell’origine.

## Sicurezza
Non inserire API key Resend nel sito o nel repository. Limita l’accesso ai log e verifica SPF/DKIM del dominio mittente. Il monitor non modifica Supabase né il Gestionale.
