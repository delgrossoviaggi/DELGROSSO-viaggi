DELGROSSO VIAGGI - FILE DI ALLINEAMENTO GITHUB / SUPABASE
Data: 01/10/2026

CONTENUTO
1. EDGE_FUNCTION_VERSION.txt
   Aggiorna la documentazione del bridge alla versione 8 e alla RPC
   create_public_booking_v3.

2. SUPABASE_GESTIONALE_FIX.sql
   Registra la patch performance applicata al Supabase gestionale.
   Gli indici usano IF NOT EXISTS, quindi il file e' idempotente.

COME INSERIRLO SU GITHUB
- Apri il repository DELGROSSO-viaggi.
- Sostituisci EDGE_FUNCTION_VERSION.txt con quello presente in questo pacchetto.
- Puoi salvare SUPABASE_GESTIONALE_FIX.sql in una cartella sql/ o migrations/.
- README_INSTALLAZIONE.txt e' solo una guida e puo' essere rimosso dopo l'installazione.

ATTENZIONE
Questo pacchetto NON sostituisce prenota.html, js/gestionale.js o il gestionale.
Non contiene chiavi private.
Non revoca ancora i permessi delle RPC SECURITY DEFINER: farlo senza prima
allineare tutte le chiamate del bridge potrebbe interrompere sito e gestionale.
