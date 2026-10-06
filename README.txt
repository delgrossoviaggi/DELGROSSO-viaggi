DELGROSSO VIAGGI & LIMOUSINE BUS — FLAGSHIP 2026
Versione sito: 30
Data: 06/10/2026

ARCHITETTURA DATI (DA NON CONFONDERE)
1) SUPABASE SITO
   https://bhsanrbadsqcpbtxupmr.supabase.co
   Contenuti pubblici: carousel, flotta, news, impostazioni sito e CMS.

2) SUPABASE GESTIONALE
   https://chkuayhbmitdmzmmvona.supabase.co
   Dati operativi: viaggi, disponibilita', posti, prenotazioni e logica gestionale.

3) BRIDGE PUBBLICO
   Il browser NON scrive direttamente nel database operativo.
   js/gestionale.js usa la Edge Function:
   https://bhsanrbadsqcpbtxupmr.supabase.co/functions/v1/gestionale-bridge

PROTEZIONE COLLEGAMENTO GESTIONALE
- js/gestionale.js NON e' stato modificato dal restyling Flagship 2026.
- La logica inline di prenota.html, viaggi.html e viaggio.html e' rimasta invariata.
- gestionale-bridge-v6-index.ts NON e' stato modificato.
- La funzione live verificata su Supabase risulta ACTIVE, versione 8.
- NON ridistribuire il file locale v6 sopra la funzione live v8 senza confronto preventivo.

FLAGSHIP 2026
- Nuova Home orientata a conversione e prenotazione.
- Hero premium con contenuti reali del carousel.
- Pannello prossima partenza e disponibilita' live.
- Command Center pubblico con dati letti dal Gestionale.
- Destinazioni dinamiche, partenze, flotta e news.
- Ricerca globale partenze unica e semplificata.
- Navigazione ripulita, CTA Prenota prioritaria.
- Barra mobile Partenze / Prenota / WhatsApp.
- Design system unico assets/flagship-2026.css.
- Rimossi dalle pagine pubbliche due vecchi layer palette/refresh e il vecchio auto-contrast, evitando sovrapposizioni inutili.
- Miglioramenti SEO, social preview, manifest, sitemap e header sicurezza Vercel.
- Responsive per iPhone, Android, tablet e PC.
- Accessibilita': skip link, focus visibile, target touch, riduzione animazioni.

DEPLOY
Il pacchetto puo' essere caricato nel repository GitHub del sito e distribuito da Vercel.
NON serve applicare SQL e NON serve modificare Supabase per questo aggiornamento grafico.
