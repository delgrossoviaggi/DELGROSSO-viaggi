#!/usr/bin/env python3
"""Genera le pagine pubbliche del sito DELGROSSO (stile 2026).

Uso:  python3 scripts/build-sito.py      (dalla cartella del progetto)

Intestazione, menu e piè di pagina sono uguali per tutte le pagine: si cambiano qui
una volta sola. I contenuti dinamici (partenze, flotta, foto, news) arrivano da
js/sito.js e dalla prenotazione in js/prenota.js.
"""
from pathlib import Path
import html

ROOT = Path(__file__).resolve().parent.parent
V = "20261126-sito3"
SITE = "https://www.delgrossoviaggi.it"
WA = "https://wa.me/393208815899"

I = {
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "wa": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>',
    "phone": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>',
}

NAV = [
    ("viaggi.html", "Partenze"),
    ("flotta.html", "Flotta"),
    ("limousine.html", "Limousine Bus"),
    ("galleria.html", "Foto"),
    ("noleggio.html", "Noleggio"),
    ("chi-siamo.html", "Chi siamo"),
    ("contatti.html", "Contatti"),
]


def head(file, title, desc, extra_js=()):
    js = "".join(f'<script defer src="{src}?v={V}"></script>' for src in extra_js)
    return f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{SITE}/{file}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}/{file}">
<meta property="og:image" content="{SITE}/assets/logo-ufficiale.jpg">
<meta name="theme-color" content="#060A1E">
<link rel="icon" href="favicon.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preload" href="assets/fonts/dmsans-400-700.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="assets/fonts/archivoblack.woff" as="font" type="font/woff" crossorigin>
<link rel="preconnect" href="https://bhsanrbadsqcpbtxupmr.supabase.co" crossorigin>
<link rel="stylesheet" href="assets/sito.css?v={V}">
{js}
</head>"""


def header(active):
    links = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if href == active else ""}>{label}</a>' for href, label in NAV
    )
    return f"""<body>
<a class="skip" href="#main">Vai al contenuto</a>
<header class="site-header" id="top">
 <div class="wrap">
  <a class="brand" href="index.html" aria-label="DELGROSSO Viaggi, pagina iniziale"><img src="assets/logo-bianco.png" alt="DELGROSSO Viaggi &amp; Limousine Bus" width="420" height="210"></a>
  <nav class="nav" id="nav" aria-label="Menu principale">{links}</nav>
  <a class="btn btn-oro btn-piccolo btn-head" href="prenota.html">Prenota</a>
  <button class="menu-btn" type="button" aria-controls="nav" aria-expanded="false" aria-label="Apri il menu">{I['menu']}</button>
 </div>
</header>"""


def footer(scripts=("js/sito.js",)):
    js = "".join(f'<script src="{src}?v={V}" defer></script>' for src in scripts)
    return f"""<footer class="site-footer">
 <div class="wrap">
  <div class="cols">
   <div>
    <img class="logo-foot" src="assets/logo-bianco.png" alt="DELGROSSO Viaggi &amp; Limousine Bus" width="420" height="210" loading="lazy">
    <p>Viaggi organizzati in autobus Gran Turismo, noleggio con conducente e Limousine Bus per eventi privati. Partenze da San Severo, Apricena, San Nicandro Garganico, Lesina e dintorni.</p>
   </div>
   <div>
    <h3>Prenotazioni e informazioni</h3>
    <ul>
     <li><a href="{WA}" target="_blank" rel="noopener">WhatsApp prenotazioni · 320 881 5899</a></li>
     <li><a href="tel:+393205730466">Raffaele · 320 573 0466</a></li>
     <li><a href="tel:+393662127916">Nicola · 366 212 7916</a></li>
     <li><a href="mailto:info@delgrossoviaggi.it">info@delgrossoviaggi.it</a></li>
    </ul>
   </div>
   <div>
    <h3>Pagine</h3>
    <ul>
     <li><a href="viaggi.html">Tutte le partenze</a></li>
     <li><a href="preventivo.html">Chiedi un preventivo</a></li>
     <li><a href="partyontheroad.html">Party on the Road</a></li>
     <li><a href="news.html">News</a></li>
     <li><a href="https://www.facebook.com/profile.php?id=61585620590672" target="_blank" rel="noopener">Facebook</a> · <a href="https://www.instagram.com/delgrosso_viaggi_/" target="_blank" rel="noopener">Instagram</a></li>
    </ul>
   </div>
  </div>
  <div class="fine"><span>© <span data-year>2026</span> DELGROSSO Viaggi &amp; Limousine Bus</span><span><a href="privacy.html">Privacy</a> · <a href="cookie.html">Cookie</a> · <a href="area-riservata.html">Area riservata</a></span></div>
 </div>
</footer>
{js}
</body>
</html>
"""


def page(file, title, desc, active, main, body_page, scripts=("js/sito.js",), head_js=()):
    out = head(file, title, desc, head_js) + header(active).replace("<body>", f'<body data-page="{body_page}">', 1)
    out += f'\n<main id="main">\n{main}\n</main>\n' + footer(scripts)
    (ROOT / file).write_text(out, encoding="utf-8")
    print("scritto", file, len(out), "byte")


def top(crumb, h1, lead, photo=""):
    return f"""<section class="page-top{' has-photo' if photo else ''}"{f' data-photo="{photo}"' if photo else ''}><div class="trails still" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="wrap">{f'<a class="crumb" href="{crumb[0]}">‹ {crumb[1]}</a>' if crumb else ''}<h1>{h1}</h1><p class="lead">{lead}</p></div></section>"""


PEOPLE = f"""<div class="people">
 <a class="person" href="tel:+393205730466"><b>Raffaele</b><span class="tel">320 573 0466</span><span>Tocca per chiamare</span></a>
 <a class="person" href="tel:+393662127916"><b>Nicola</b><span class="tel">366 212 7916</span><span>Tocca per chiamare</span></a>
 <a class="person wa" href="{WA}" target="_blank" rel="noopener"><b>WhatsApp prenotazioni</b><span class="tel">320 881 5899</span><span>Scrivici per posti, acconti e informazioni</span></a>
</div>"""

CONTACT_BAND = f"""<section class="section"><div class="wrap"><div class="contact-band">
 <div><h2>Hai una domanda prima di partire?</h2><p style="margin-top:10px">Chiamaci o scrivici su WhatsApp: ti rispondiamo noi, non un call center.</p></div>
 {PEOPLE}
</div></div></section>"""

TRIP_JS = ("js/gestionale.js", "js/sito.js")

# ---------------- pagine ----------------
page("index.html", "DELGROSSO Viaggi | Gite in pullman e Limousine Bus dal Gargano",
     "Gite in pullman Gran Turismo da San Severo, Apricena, San Nicandro Garganico e Lesina: Napoli, Alberobello, mercatini di Natale. Scegli il posto e prenota online.",
     "index.html", f"""
<section class="hero">
 <div class="trails" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
 <div class="wrap hero-grid">
  <div class="hero-copy">
   <h1>Prossima fermata: la tua gita.</h1>
   <p class="lead">Gite in pullman Gran Turismo con partenza da San Severo, Apricena, San Nicandro Garganico e Lesina. Scegli il posto sulla piantina e prenota in un minuto.</p>
   <div class="hero-actions"><a class="btn btn-oro" href="viaggi.html">Vedi tutte le partenze {I['arrow']}</a><a class="btn btn-chiaro" href="{WA}" target="_blank" rel="noopener">{I['wa']} Scrivici</a></div>
   <p class="live">Posti aggiornati in tempo reale</p>
   <div class="window" id="heroWindow" aria-label="Foto dei nostri viaggi"><img src="assets/bus-extra-1400.jpg" alt="Pullman DELGROSSO in partenza" fetchpriority="high"></div>
  </div>
  <div class="board" aria-live="polite">
   <div class="board-title"><b>Prossime partenze</b><a href="viaggi.html">Tutte</a></div>
   <div class="tickets" id="homeTrips"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
  </div>
 </div>
</section>
<section class="section" style="padding-top:34px"><div class="wrap">
 <div class="section-head"><div><h2>Prenotare è semplice</h2><p class="muted">Tre passaggi, tutti dal telefono.</p></div></div>
 <div class="steps">
  <div class="step"><span class="n">1</span><div><h3>Scegli la gita</h3><p class="muted">Data, prezzo e posti liberi sono aggiornati in tempo reale.</p></div></div>
  <div class="step"><span class="n">2</span><div><h3>Tocca i tuoi posti</h3><p class="muted">Sulla piantina del pullman vedi quali sono liberi e scegli dove sederti.</p></div></div>
  <div class="step"><span class="n">3</span><div><h3>Conferma con l’acconto</h3><p class="muted">Ricevi la conferma in PDF con il numero da chiamare per versare l’acconto entro 2 giorni.</p></div></div>
 </div>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap">
 <div class="section-head"><div><h2>In viaggio con noi</h2><p class="muted">Foto vere delle nostre gite e dei nostri pullman. Tocca una foto per ingrandirla.</p></div><a class="link-freccia" href="galleria.html">Tutte le foto {I['arrow']}</a></div>
 <div class="mosaic" id="homeMosaic"><img src="assets/bus-bianco-reale-1400.jpg" alt="Pullman Gran Turismo DELGROSSO" loading="lazy"><img src="assets/bus-extra-1400.jpg" alt="Pullman Gran Turismo DELGROSSO" loading="lazy"></div>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap">
 <div class="section-head"><h2>Non solo gite</h2></div>
 <div class="services">
  <a class="service" href="noleggio.html"><img src="assets/bus-bianco-reale-1400.jpg" alt="" loading="lazy" data-fleet-img="gt"><div class="in"><h3>Noleggio pullman con autista</h3><p class="muted">Per gruppi, scuole, associazioni, squadre sportive e pellegrinaggi.</p><span class="link-freccia">Scopri {I['arrow']}</span></div></a>
  <a class="service" href="limousine.html"><img src="assets/bus-extra-1400.jpg" alt="" loading="lazy" data-fleet-img="limo"><div class="in"><h3>Limousine Bus</h3><p class="muted">Compleanni, addii al nubilato e celibato, serate speciali: la festa comincia a bordo.</p><span class="link-freccia">Scopri {I['arrow']}</span></div></a>
  <a class="service" href="preventivo.html"><div class="logo-tile"><img src="assets/logo-bianco.png" alt="" loading="lazy" width="420" height="210"></div><div class="in"><h3>Un viaggio su misura</h3><p class="muted">Dicci data, destinazione e numero di persone: ti mandiamo una proposta.</p><span class="link-freccia">Chiedi un preventivo {I['arrow']}</span></div></a>
 </div>
</div></section>
<section class="section" style="padding-top:0" id="homeNewsWrap" hidden><div class="wrap">
 <div class="section-head"><h2>Ultime novità</h2><a class="link-freccia" href="news.html">Tutte le news {I['arrow']}</a></div>
 <div class="grid three" id="homeNews"></div>
</div></section>
{CONTACT_BAND}
""", "home", scripts=TRIP_JS)

page("viaggi.html", "Partenze | DELGROSSO Viaggi",
     "Tutte le gite in pullman in programma: date, prezzi, fermate di partenza e posti liberi aggiornati. Prenota online scegliendo il tuo posto.",
     "viaggi.html", f"""
{top(None, "Tutte le partenze", "Date, prezzi e posti liberi aggiornati in tempo reale. Tocca una gita per vedere il programma e scegliere i posti.", "trip")}
<section class="section" style="padding-top:26px"><div class="wrap">
 <div class="filters" id="monthFilters" role="group" aria-label="Filtra per mese"></div>
 <label class="toggle"><input type="checkbox" id="onlyFree"> Solo gite con posti liberi</label>
 <div id="allTrips" aria-live="polite"><div class="tickets two"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>
</div></section>
{CONTACT_BAND}
""", "viaggi", scripts=TRIP_JS)

page("viaggio.html", "Dettagli della gita | DELGROSSO Viaggi",
     "Programma, prezzo, orario, fermate di partenza e posti liberi della gita. Scegli il tuo posto e prenota online.",
     "viaggi.html", f"""
<section class="page-top" style="padding-bottom:30px"><div class="trails still" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="wrap"><a class="crumb" href="viaggi.html">‹ Tutte le partenze</a><h1 id="tripTitle">Caricamento…</h1><p class="lead" id="tripLead"></p></div></section>
<section class="section" style="padding-top:26px"><div class="wrap" id="tripDetail" aria-live="polite"><div class="skeleton" style="height:420px"></div></div></section>
<section class="section" style="padding-top:0" id="tripPhotosWrap" hidden><div class="wrap"><div class="section-head"><h2>Com’è viaggiare con noi</h2><a class="link-freccia" href="galleria.html">Tutte le foto {I['arrow']}</a></div><div class="strip" id="tripPhotos"></div></div></section>
""", "viaggio", scripts=TRIP_JS)

page("prenota.html", "Prenota il tuo posto | DELGROSSO Viaggi",
     "Prenota online la tua gita in pullman: scegli i posti sulla piantina, la fermata di partenza e ricevi subito la conferma in PDF.",
     "", f"""
<section class="page-top" style="padding:28px 0 30px"><div class="trails still" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="wrap"><a class="crumb" href="viaggi.html">‹ Tutte le partenze</a><h1>Prenota il tuo posto</h1></div></section>
<section class="section" style="padding-top:22px"><div class="wrap">
 <ol class="stepper" id="stepper" aria-label="Passaggi della prenotazione"><li data-s="1">1 · Gita e posti</li><li data-s="2">2 · I tuoi dati</li><li data-s="3">3 · Conferma</li></ol>
 <div id="book" aria-live="polite"><div class="skeleton" style="height:360px"></div></div>
</div></section>
<noscript><div class="wrap"><p class="err">Per prenotare online serve JavaScript attivo. In alternativa scrivici su WhatsApp al 320 881 5899.</p></div></noscript>
""", "prenota", scripts=("js/gestionale.js", "js/ricevuta.js", "js/prenota.js"))

page("flotta.html", "La flotta | DELGROSSO Viaggi",
     "I pullman Gran Turismo e il Limousine Bus di DELGROSSO Viaggi, con foto reali, numero di posti e caratteristiche.",
     "flotta.html", f"""
{top(None, "La nostra flotta", "Pullman Gran Turismo e Limousine Bus: foto reali dei mezzi con cui viaggerai. Tocca una foto per ingrandirla.", "fleet")}
<section class="section" style="padding-top:28px"><div class="wrap"><div class="grid" id="fleetList" aria-live="polite"><div class="skeleton" style="height:320px"></div><div class="skeleton" style="height:320px"></div></div></div></section>
<section class="section" style="padding-top:0"><div class="wrap"><div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between"><div><h2>Organizzi un viaggio di gruppo?</h2><p class="muted" style="margin-top:6px">Dicci quante persone, dove e quando: scegliamo noi il mezzo giusto.</p></div><a class="btn btn-oro" href="preventivo.html?servizio=Noleggio%20Bus%20GT">Chiedi un preventivo {I['arrow']}</a></div></div></section>
""", "flotta")

page("limousine.html", "Limousine Bus | DELGROSSO Viaggi",
     "Limousine Bus per compleanni, feste private, addii al celibato e nubilato e serate speciali in Puglia e Molise. Guarda le foto e chiedi un preventivo.",
     "limousine.html", f"""
{top(None, "Limousine Bus", "La festa comincia appena sali a bordo: luci, musica e spazio per stare insieme. Per compleanni, addii al celibato e nubilato, diciottesimi e serate speciali.", "limo")}
<section class="section" style="padding-top:28px"><div class="wrap">
 <div class="tags"><span class="pill info">Compleanni e diciottesimi</span><span class="pill info">Addii al celibato e nubilato</span><span class="pill info">Feste private</span><span class="pill info">Serate in discoteca</span></div>
 <div class="card"><h2>Guarda gli interni</h2><p class="muted" style="margin-top:6px">Foto reali del nostro Limousine Bus. Tocca una foto per ingrandirla.</p><div class="gallery" id="limoGallery"></div></div>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap">
 <div class="section-head"><h2>Come si organizza</h2></div>
 <div class="steps">
  <div class="step"><span class="n">1</span><div><h3>Raccontaci la festa</h3><p class="muted">Data, orari, partenza e numero di persone.</p></div></div>
  <div class="step"><span class="n">2</span><div><h3>Ricevi la proposta</h3><p class="muted">Verifichiamo la disponibilità e ti mandiamo il prezzo.</p></div></div>
  <div class="step"><span class="n">3</span><div><h3>Sali a bordo</h3><p class="muted">Pensiamo noi al viaggio, voi pensate a festeggiare.</p></div></div>
 </div>
 <p style="margin-top:22px"><a class="btn btn-oro" href="preventivo.html?servizio=Limousine%20Bus">Chiedi un preventivo per il Limousine Bus {I['arrow']}</a></p>
</div></section>
{CONTACT_BAND}
""", "limousine")

page("noleggio.html", "Noleggio pullman con autista | DELGROSSO Viaggi",
     "Noleggio di pullman Gran Turismo con conducente per gruppi, scuole, associazioni, società sportive e pellegrinaggi. Chiedi un preventivo.",
     "noleggio.html", f"""
{top(None, "Noleggio pullman con autista", "Per gruppi, associazioni, società sportive, gite scolastiche, pellegrinaggi ed eventi. Scegliamo il mezzo adatto al vostro itinerario e al numero di persone.", "fleet")}
<section class="section" style="padding-top:28px"><div class="wrap">
 <div class="tags"><span class="pill info">Gruppi e associazioni</span><span class="pill info">Società sportive</span><span class="pill info">Gite scolastiche</span><span class="pill info">Pellegrinaggi</span><span class="pill info">Matrimoni ed eventi</span><span class="pill info">Transfer</span></div>
 <div class="steps">
  <div class="step"><span class="n">1</span><div><h3>Dicci cosa ti serve</h3><p class="muted">Data, itinerario, numero di persone e tipo di servizio.</p></div></div>
  <div class="step"><span class="n">2</span><div><h3>Ti ricontattiamo</h3><p class="muted">Verifichiamo i mezzi disponibili e prepariamo la proposta.</p></div></div>
  <div class="step"><span class="n">3</span><div><h3>Organizziamo insieme</h3><p class="muted">Concordiamo orari, fermate e ogni dettaglio del viaggio.</p></div></div>
 </div>
 <p style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-oro" href="preventivo.html?servizio=Noleggio%20Bus%20GT">Chiedi un preventivo {I['arrow']}</a><a class="btn btn-chiaro" href="flotta.html">Guarda la flotta</a></p>
</div></section>
{CONTACT_BAND}
""", "noleggio")

page("partyontheroad.html", "Party on the Road | DELGROSSO Viaggi",
     "Le feste e le serate organizzate a bordo del Limousine Bus DELGROSSO: foto degli eventi e informazioni per organizzare il tuo.",
     "", f"""
{top(None, "Party on the Road", "Le serate a bordo del nostro Limousine Bus. Guarda le foto degli eventi e organizza il prossimo.", "limo")}
<section class="section" style="padding-top:28px"><div class="wrap"><div class="grid" id="partyList" aria-live="polite"><div class="skeleton" style="height:260px"></div></div>
<p style="margin-top:22px"><a class="btn btn-oro" href="preventivo.html?servizio=Limousine%20Bus">Organizza la tua festa {I['arrow']}</a></p></div></section>
""", "party")

page("galleria.html", "Foto | DELGROSSO Viaggi",
     "Le foto delle gite DELGROSSO Viaggi, dei pullman Gran Turismo e del Limousine Bus.",
     "galleria.html", f"""
{top(None, "Foto", "Le nostre gite, i nostri pullman e le serate sul Limousine Bus. Tocca una foto per ingrandirla.", "trip")}
<section class="section" style="padding-top:26px"><div class="wrap">
 <div class="filters" id="photoFilters" role="group" aria-label="Scegli le foto"><button class="chip" type="button" data-f="tutte" aria-pressed="true">Tutte</button><button class="chip" type="button" data-f="gite" aria-pressed="false">Gite</button><button class="chip" type="button" data-f="pullman" aria-pressed="false">Pullman</button><button class="chip" type="button" data-f="limo" aria-pressed="false">Limousine Bus</button></div>
 <div class="mosaic big" id="photoGrid" aria-live="polite"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
 <p style="margin-top:18px;text-align:center"><button class="btn btn-chiaro" type="button" id="moreFoto" hidden>Mostra altre foto</button></p>
</div></section>
{CONTACT_BAND}
""", "galleria")

page("news.html", "News | DELGROSSO Viaggi",
     "Novità, nuove gite e comunicazioni di DELGROSSO Viaggi & Limousine Bus.",
     "", f"""
{top(None, "News", "Nuove gite, novità e comunicazioni.")}
<section class="section" style="padding-top:28px"><div class="wrap"><div id="newsDetail"></div><div class="grid three" id="newsList" aria-live="polite"><div class="skeleton" style="height:260px"></div></div></div></section>
""", "news")

page("chi-siamo.html", "Chi siamo | DELGROSSO Viaggi",
     "DELGROSSO Viaggi & Limousine Bus: gite in pullman, noleggio con conducente ed eventi a bordo, con partenze dal Gargano e dall'Alto Tavoliere.",
     "chi-siamo.html", f"""
{top(None, "Chi siamo", "Viaggi organizzati in pullman Gran Turismo, noleggio con conducente e Limousine Bus: persone vere, che conosci per nome.", "trip")}
<section class="section" style="padding-top:28px"><div class="wrap">
 <div class="card prose">
  <p>DELGROSSO Viaggi &amp; Limousine Bus organizza gite in pullman Gran Turismo con partenza da San Severo, Apricena, San Nicandro Garganico, Lesina e dalle altre fermate indicate in ogni viaggio.</p>
  <p>Oltre alle gite, offriamo il noleggio di pullman con conducente per gruppi, scuole e associazioni, e il nostro Limousine Bus per feste ed eventi privati.</p>
  <p>Mettiamo al centro una cosa semplice: informazioni chiare, prezzi trasparenti e una persona sempre raggiungibile per ogni domanda, prima e durante il viaggio.</p>
 </div>
 <div class="services" style="margin-top:18px">
  <a class="service" href="viaggi.html"><div class="in"><h3>Gite organizzate</h3><p class="muted">Napoli, borghi di Puglia, mercatini di Natale e nuove mete.</p><span class="link-freccia">Le partenze {I['arrow']}</span></div></a>
  <a class="service" href="flotta.html"><div class="in"><h3>Pullman Gran Turismo</h3><p class="muted">Mezzi comodi e curati, fotografati realmente.</p><span class="link-freccia">La flotta {I['arrow']}</span></div></a>
  <a class="service" href="limousine.html"><div class="in"><h3>Limousine Bus</h3><p class="muted">Per vivere feste ed eventi in modo diverso.</p><span class="link-freccia">Scopri {I['arrow']}</span></div></a>
 </div>
</div></section>
{CONTACT_BAND}
""", "chi")

page("contatti.html", "Contatti | DELGROSSO Viaggi",
     "Contatti di DELGROSSO Viaggi: WhatsApp prenotazioni 320 881 5899, Raffaele 320 573 0466, Nicola 366 212 7916.",
     "contatti.html", f"""
{top(None, "Contatti", "Per una gita, un noleggio o una festa sul Limousine Bus: chiamaci o scrivici, ti rispondiamo noi.", "trip")}
<section class="section" style="padding-top:28px"><div class="wrap">
 <div class="contact-band" style="margin-bottom:22px"><div><h2>Chi chiamare</h2><p style="margin-top:10px">Per acconti e informazioni sulle gite chiamaci o scrivici su WhatsApp.</p></div>{PEOPLE}</div>
 <div class="card" style="max-width:760px">
  <h2>Scrivici un messaggio</h2><p class="muted" style="margin:6px 0 16px">Prepariamo l’e-mail con il tuo messaggio: dovrai solo premere «Invia» nella tua app di posta.</p>
  <form class="form" id="contactForm" novalidate>
   <div class="two"><label class="field">Nome e cognome<input name="name" required autocomplete="name"></label><label class="field">Telefono<input name="phone" type="tel" autocomplete="tel"></label></div>
   <label class="field">E-mail<input name="email" type="email" required autocomplete="email"></label>
   <label class="field">Argomento<select name="service"><option>Informazioni su una gita</option><option>Limousine Bus</option><option>Noleggio pullman</option><option>Altro</option></select></label>
   <label class="field">Messaggio<textarea name="message" rows="5" required></textarea></label>
   <label class="check"><input type="checkbox" required> <span>Ho letto l’<a href="privacy.html">informativa privacy</a>.</span></label>
   <button class="btn btn-oro" type="submit">Prepara l’e-mail {I['arrow']}</button>
   <p class="small muted" id="contactStatus" role="status"></p>
  </form>
 </div>
</div></section>
""", "contatti")

page("preventivo.html", "Chiedi un preventivo | DELGROSSO Viaggi",
     "Richiedi un preventivo per noleggio pullman con autista, Limousine Bus o viaggio di gruppo. Ti ricontattiamo con una proposta.",
     "", f"""
{top(None, "Chiedi un preventivo", "Compila i campi: la richiesta arriva direttamente a noi e ti ricontattiamo con una proposta.")}
<section class="section" style="padding-top:28px"><div class="wrap"><div class="card" style="max-width:820px">
 <form class="form" id="quoteForm" novalidate>
  <div class="two"><label class="field">Nome<input name="nome" required autocomplete="given-name"></label><label class="field">Cognome<input name="cognome" required autocomplete="family-name"></label></div>
  <div class="two"><label class="field">Telefono<input name="telefono" type="tel" required autocomplete="tel"></label><label class="field">E-mail<input name="email" type="email" required autocomplete="email"></label></div>
  <div class="two"><label class="field">Servizio<select name="servizio" id="quoteService" required><option value="">Scegli…</option><option>Noleggio Bus GT</option><option>Limousine Bus</option><option>Viaggio organizzato</option><option>Altro</option></select></label><label class="field">Numero di persone<input name="passeggeri" type="number" min="1" inputmode="numeric" required></label></div>
  <div class="two"><label class="field">Partenza da<input name="partenza" required></label><label class="field">Destinazione<input name="destinazione" required></label></div>
  <label class="field">Data del servizio<input name="dataPartenza" type="date" required></label>
  <label class="field">Dettagli <small>(orari, ritorno, esigenze particolari)</small><textarea name="note" rows="4"></textarea></label>
  <label class="check"><input type="checkbox" required> <span>Ho letto l’<a href="privacy.html">informativa privacy</a> e chiedo di essere ricontattato per questo preventivo.</span></label>
  <button class="btn btn-oro" type="submit" id="quoteSubmit">Invia la richiesta {I['arrow']}</button>
  <p class="small muted" id="quoteStatus" role="status"></p>
 </form>
</div></div></section>
""", "preventivo")

PRIVACY_MAIN = """<section class="section" style="padding-top:28px"><div class="wrap"><div class="card prose">
<p class="note-box">Bozza da completare prima della pubblicazione definitiva: mancano i dati del titolare e i dettagli sui servizi utilizzati.</p>
<h2>Titolare del trattamento</h2><p>Il sito è presentato con il marchio DELGROSSO Viaggi &amp; Limousine Bus. Ragione sociale, sede, partita IVA e recapito per i diritti privacy devono essere inseriti dal titolare.</p>
<h2>Richieste e prenotazioni</h2><p>I dati inseriti nei moduli vengono utilizzati per rispondere alle richieste e gestire il servizio richiesto. Le prenotazioni sono trasmesse al gestionale tramite il collegamento esistente. Occorre confermare soggetti destinatari, basi giuridiche, tempi di conservazione e modalità di tutela dei dati prima della pubblicazione.</p>
<h2>Servizi tecnici</h2><p>Il sito utilizza Supabase per contenuti e servizi collegati. I caratteri tipografici sono ospitati sul sito stesso. Le immagini possono essere caricate dagli indirizzi dei contenuti pubblicati. Queste richieste di rete possono comunicare indirizzo IP e dati tecnici ai rispettivi fornitori. Vanno verificati contratti, localizzazione e garanzie applicabili al trattamento.</p>
<h2>Diritti</h2><p>L’informativa definitiva deve illustrare i diritti applicabili, tra cui accesso, rettifica, cancellazione, limitazione, opposizione, portabilità ove prevista e revoca del consenso, con un recapito utilizzabile e le informazioni sul reclamo al Garante per la protezione dei dati personali.</p>
</div></div></section>"""
page("privacy.html", "Privacy | DELGROSSO Viaggi", "Informativa privacy del sito DELGROSSO Viaggi & Limousine Bus.", "",
     top(None, "Privacy", "Come trattiamo i dati inseriti nel sito.") + PRIVACY_MAIN, "privacy")

COOKIE_MAIN = """<section class="section" style="padding-top:28px"><div class="wrap"><div class="card prose">
<p>Questo sito non usa strumenti pubblicitari o di analisi del traffico e non incorpora chat o mappe di terzi.</p>
<h2>Funzioni del browser</h2><p>L’area riservata utilizza i dati di sessione necessari all’accesso amministrativo. Il sito pubblico non salva dati di profilazione.</p>
<h2>Foto e servizi esterni</h2><p>Le fotografie e le partenze vengono richieste ai servizi del sito (Supabase). Le richieste di rete comportano la trasmissione di dati tecnici anche quando non vengono installati cookie di profilazione.</p>
<h2>Prima di aggiungere altri servizi</h2><p>L’attivazione futura di strumenti di analisi, pubblicità, mappe incorporate o chat esterne richiede una nuova valutazione e, dove necessario, un sistema che li blocchi fino alla scelta dell’utente.</p>
</div></div></section>"""
page("cookie.html", "Cookie | DELGROSSO Viaggi", "Informazioni su cookie e archiviazione locale del sito DELGROSSO Viaggi.", "",
     top(None, "Cookie e archiviazione locale", "Il sito non usa cookie pubblicitari né strumenti di analisi.") + COOKIE_MAIN, "cookie")
