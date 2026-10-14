DELGROSSO VIAGGI — SITE PRO

Questa versione usa esclusivamente il progetto Supabase:
https://bhsanrbadsqcpbtxupmr.supabase.co

Ottimizzazioni principali:
- niente Tailwind CDN/AOS/GLightbox sulle pagine principali: CSS/JS locali e vanilla per maggiore velocità;
- homepage cinematografica con carousel reale da carousel_home;
- partenze da viaggi pubblicati (pubblicato = SI);
- flotta da site_fleet;
- Party da site_party_events;
- News da site_posts;
- contatti da site_settings (fallback info_azienda);
- Admin Pro con upload multiplo drag/file picker, anteprima e progressione, direttamente su Storage bucket site-media;
- struttura responsive pensata prima per mobile/iPhone;
- nessuna migrazione SQL inclusa e nessuna modifica allo schema Supabase.

ATTENZIONE:
1. Il bucket Storage deve essere 'site-media' e consentire l'upload all'utente/admin che usa il pannello.
2. L'Admin deve avere le policy Storage/DB già configurate nel progetto. Se il progetto richiede autenticazione, il login Supabase va aggiunto alle policy prima di consentire upload.
3. Prenotazioni: la pagina usa la tabella public.prenotazioni del progetto indicato e non tocca alcun altro progetto.
4. Il file admin.html è un CMS frontend; non inserire password segrete nel codice.
