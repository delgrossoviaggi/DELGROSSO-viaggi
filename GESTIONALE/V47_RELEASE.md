# DELGROSSO GESTIONALE V47

Data: 2026-09-09

## Inclusioni
- Nuova sezione **Noleggi Bus** per bus interi.
- Mezzo selezionabile esclusivamente per **nome del bus**, mai per targa.
- La targa viene conservata come dato interno storico del mezzo assegnato.
- Nessuna gestione di autisti, secondo autista, accompagnatori o personale.
- Tutta la flotta viene caricata dinamicamente dalla tabella `flotta` di Supabase.
- Gestione cliente, referente, azienda, telefono, email, tratta, fermate, date/orari, passeggeri, tipo servizio, prezzo, acconto, saldo, stato pagamento e stato noleggio.
- Controllo anti-conflitto per evitare l'assegnazione dello stesso mezzo a intervalli sovrapposti.
- ID automatico `DG-NB-XXXXXXXX`.
- Tabelle Supabase: `noleggi_bus`, `noleggi_bus_mezzi`, `noleggi_bus_pagamenti`.
- Banner globale **DELGROSSO VIAGGI & LIMOUSINE BUS** nuovamente animato e visibile anche su tablet/smartphone/iPhone.
- Cache Service Worker portata a V47.
- Stabilizzazione del salvataggio in Prenotazioni: il cliente viene risolto prima della costruzione del payload, con validazioni più chiare e rollback protetto.

## Flotta presente al momento della realizzazione
1. IRIZAR SCANIA CENTURY ( GRIGIO 53 POSTI)
2. IRIZAR SCANIA PB
3. IRIZAR SCANIA PB ( BIANCO GT63 POSTI)
4. LIMOUSINE BUS
5. MERCEDES V250D

La pagina non usa una lista fissa: al caricamento legge la tabella `flotta`, quindi eventuali nuovi mezzi aggiunti in futuro compariranno automaticamente.

## Audit Supabase
Sono state verificate struttura, relazioni, RLS e tabelle operative del progetto Gestionale. È stata confermata una criticità architetturale preesistente: il Gestionale usa un'autenticazione locale lato browser e molte tabelle sono accessibili tramite ruolo `anon`; inoltre la tabella `impostazioni` contiene campi SMTP sensibili. Non vengono copiati o esposti segreti in questo pacchetto.

La messa in sicurezza completa richiede la migrazione dell'autenticazione del Gestionale a Supabase Auth (o a un backend/Edge Function con sessione verificata) prima di poter rimuovere in sicurezza l'accesso `anon` alle tabelle interne senza rompere il Gestionale. V47 evita quindi modifiche RLS distruttive che potrebbero interrompere l'operatività.
