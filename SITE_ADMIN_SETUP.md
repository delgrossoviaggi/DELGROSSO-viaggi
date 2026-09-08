# DELGROSSO — Admin Sito

Il CMS usa esclusivamente il progetto Supabase dedicato:
`https://bhsanrbadsqcpbtxupmr.supabase.co`

## Primo accesso
1. Nel Supabase dedicato aprire Authentication → Users.
2. Creare l'utente Admin con la propria email e password.
3. Copiare il suo User ID (UUID).
4. Nel SQL Editor eseguire:

```sql
insert into public.site_admins (user_id)
values ('INCOLLA-QUI-LO-UUID-DELL-ADMIN');
```

Dopo questo passaggio l'utente può accedere da `admin.html`.

## Contenuti gestiti
- Carousel Home
- Carousel Partenze
- Flotta editoriale del sito
- Album Party on the Road con più foto
- Post / News

Le immagini vengono caricate nello Storage `site-media`.

## Separazione
`viaggi.html`, `prenota.html` e `preventivo.html` continuano a usare il Supabase del Gestionale.
La cartella `GESTIONALE/` non viene modificata.
