# DEL GROSSO GESTIONALE V102 — Advanced Stable Fix

- Eliminato il rischio di collisione tra moduli della pagina Pagamenti e il layer Executive: V102 usa import dinamici e si attiva solo sulla Dashboard.
- Nuovi asset versionati `dg-v102-advanced.*` per evitare riferimenti obsoleti.
- Service Worker/cache namespace aggiornato a V102 e asset Executive inseriti nel precache.
- Control Room: caricamento del servizio pagamenti corretto (summary + movimenti reali) invece di trattare il servizio come funzione.
- Control Room: cambio posto aggiorna anche `posti_occupati` e `posti_liberi` del viaggio.
- Control Room: apertura senza `?trip=` non produce più una pagina rotta; mostra un percorso di recupero verso Viaggi.
- Precisione monetaria V98 mantenuta.
