DELGROSSO GESTIONALE — ECONOMIA & FLOTTA 2.0

Implementato:
- Economia: Entrate, Uscite, saldo, categorie, filtri, collegamento a viaggio/noleggio/mezzo, export CSV.
- Pagamenti prenotazioni: sincronizzazione automatica in economia.
- Pagamenti noleggi: sincronizzazione automatica in economia.
- Carburante flotta: litri, prezzo/litro, km, distributore, viaggio e costo; l'uscita viene registrata automaticamente in Economia.
- Manutenzioni flotta: intervento, costo, officina, km, prossima scadenza/data; l'uscita viene registrata automaticamente in Economia.
- Audit log: creazione/modifica/eliminazione dei movimenti economici, carburante e manutenzioni.
- Statistiche: entrate, uscite e saldo inclusi nei KPI.
- Flotta: accesso rapido a rifornimenti e manutenzioni.
- Supabase: il database resta unico; PC/iPhone leggono e scrivono sullo stesso progetto.

Database Supabase utilizzato:
chkuayhbmitdmzmmvona

Nuove tabelle:
- public.economia_movimenti
- public.carburante_flotta
- public.manutenzioni_flotta

Le automazioni database sincronizzano i pagamenti esistenti e futuri in Economia.

Nota: il modulo Autisti NON è stato aggiunto, come richiesto.
