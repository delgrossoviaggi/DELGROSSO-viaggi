# V30 — Archivio integrato nel Gestionale

- Archivio aggiunto anche al menu/banner del Dashboard, oltre al menu universale.
- Archivio legge direttamente dalle tabelle Supabase `prenotazioni` e `pagamenti` e dagli stessi PDF nel bucket `ricevute-prenotazioni`.
- Sincronizzazione automatica ogni 10 secondi, più aggiornamento al ritorno sul tab/focus.
- Ricerca e filtri restano locali sui dati appena sincronizzati.
- Collegamenti rapidi a Prenotazione/Pagamento.
- Nessun database parallelo e nessuna copia separata dei PDF.
