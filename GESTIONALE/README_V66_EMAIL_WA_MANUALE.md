# DELGROSSO Gestionale V66 — Email automatiche + WhatsApp manuale

- WhatsApp Business: numero +39 320 881 5899. Il gestionale prepara i messaggi di prenotazione, acconto e saldo; l'operatore apre la chat, allega il PDF e preme Invia manualmente.
- Niente Cloud API, template Meta, o abbonamenti aggiuntivi per WhatsApp.
- Email: già predisposte nella coda Supabase V65. Le email diventano automatiche SOLO DOPO distribuzione, configurazione e programmazione del worker server V66, disponibile nello ZIP PRIVATO SEPARATO.
- Reinvio email di conferme e ricevute già archiviate accessibile dal Centro WhatsApp Business, con conferma dell'operatore.
- I rimborsi e i pagamenti non registrati non hanno pulsanti WhatsApp per ricevute.
- Non caricare BACKEND_PRIVATO nella root del sito. Pubblicare solo `GESTIONALE/`.
- Le vecchie prenotazioni e le ricevute storiche non vengono inviate in massa.
