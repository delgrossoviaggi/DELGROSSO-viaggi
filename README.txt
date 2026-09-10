DELGROSSO VIAGGI — SITE PRO

SUPABASE SITO
URL: https://bhsanrbadsqcpbtxupmr.supabase.co
Admin: l'area admin usa Supabase Auth + tabella public.site_admins.

IMPORTANTE
L'errore "new row violates row-level security policy" compariva perché Storage e tabelle del sito consentono scrittura solo a utenti authenticated che risultano in site_admins. La nuova admin.html effettua quindi il login Supabase prima di permettere upload/salvataggi.

L'utente amministratore deve avere un account Supabase Auth il cui user_id sia presente in public.site_admins. Il pacchetto non contiene password hardcoded.

STORAGE
Bucket: site-media
Categorie usate: carousel, fleet, party, posters.
I file vengono registrati anche in public.site_media.

GESTIONALE
Le pagine operative Partenze/Viaggi/Prenota/Richiedi Preventivo devono usare il Supabase Gestionale:
https://chkuayhbmitdmzmmvona.supabase.co

Non inserire service-role key nel frontend.
