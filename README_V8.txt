# DELGROSSO SITE COMPLETE V8

Pacchetto SOLO SITO PUBBLICO. La cartella GESTIONALE è esclusa intenzionalmente.

## Architettura
- Sito pubblico -> Supabase SITO `exphxbeqwpwrsigdmilc`
- Tabelle pubbliche: `flotta_page`, `tratte`, `carousel_home`, `carousel_flotta`, `gallery_eventi`, `info_azienda`, `prenotazioni`
- Admin -> Supabase SITO + Supabase Auth
- Nessun import o chiamata al Supabase Gestionale nel sito pubblico V8.
- Nessuna cartella `GESTIONALE/` e nessuna funzione server del Gestionale nel pacchetto.

## Installazione
1. Fai una copia del repository attuale.
2. Sostituisci SOLO i file/cartelle presenti in questo ZIP nel root del sito.
3. NON eliminare il tuo progetto Gestionale separato. Questo ZIP non contiene GESTIONALE.
4. Deploy Vercel/GitHub.

## Foto
Le pagine leggono direttamente gli URL presenti nelle colonne Supabase del SITO. `flotta_page` supporta `immagine_url`, `foto_urls`, `foto_gallery`.
Per l'upload binario, continua a usare il tuo sistema di storage/Cloudinary esistente e salva gli URL nel Supabase SITO; il sito V8 li visualizza direttamente.
