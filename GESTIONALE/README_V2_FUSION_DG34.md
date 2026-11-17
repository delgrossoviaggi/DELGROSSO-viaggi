# DELGROSSO GESTIONALE V2 FUSION DG34

L'interfaccia aziendale principale resta la precedente V2, mantenendo login, dashboard, agenda e Control Room.

### Recuperato dal V2
Dashboard e dati viaggi, prenotazioni, BUS BIS, posti e check-in, clienti, rubrica, flotta, noleggi, agenda, preventivi, notifiche, documenti, WhatsApp e moduli della suite.

### DG33 conservato
Piantine ufficiali/bozze, variante 57 posti, PDF Control Room con piantina nominativa e liste per fermata, export BUS/BIS. Le piantine non ufficiali sono chiaramente distinte.

### DG34 nuovo
Contabilità Nicola e Raffaele visibili direttamente nel menu principale V2, cassa generale, separazione noleggi/viaggi/economia, filtri e riconciliazione, PDF contabili corretti, CSV e pagina Stato Supabase.

La contabilità DG34 usa esclusivamente SELECT con JWT utente autenticato e le RLS Supabase. Non modifica prenotazioni, posti, quote, pagamenti o ricevute. Le operazioni di registrazione usano le procedure originali V2 e vanno collaudate separatamente.

Vedere ISTRUZIONI_INSTALLAZIONE_DG34.md nella cartella principale del file ZIP.
