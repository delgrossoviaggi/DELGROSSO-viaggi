# Diagnostica e sincronizzazione — versione 2.5

**Supabase gestionale:** progetto `chkuayhbmitdmzmmvona`.

## Controlli server eseguiti in sola lettura

- 33 relazioni o viste mappate dal client, 332 nomi colonna confrontati: nessuna colonna mancante.
- Le tabelle `prenotazioni` e `notifiche` figurano nella pubblicazione Postgres Realtime.
- Le funzioni di prenotazioni, pagamenti, flotta, spostamento data, cassa e costi risultano presenti.
- Le tabelle esposte usate dall’applicazione hanno politiche di SELECT per operatori; le due viste cassa e ricevute sono `security_invoker=true` e non sono leggibili dagli anonimi.
- Il progetto è identificato con la **chiave pubblicabile**, non con service_role.

## Cosa il collaudo NON prova

- Password effettive di Nicola e Raffaele e funzionamento della Edge Function login dal dominio finale.
- Lettura di record con JWT reale e verifica di ogni singola policy RLS.
- Trasmissione Realtime di un evento reale verso il browser.
- Creazioni/modifiche/contabilizzazioni reali e nessuna perdita di dati durante operazioni concorrenti.
- Fatture elettroniche SdI o WhatsApp API.

Nella pagina **Diagnostica integrazioni** sono previsti SELECT autenticati, verifica sessione ed esistenza RPC. Le RPC di scrittura NON vengono chiamate dal pulsante diagnostico.

## Troubleshooting

- **401**: verifica utente e password effettivamente impostati in Supabase Auth; non aggiungere password al codice GitHub.
- **403**: politica RLS, permessi operatore o origine CORS non autorizzata.
- **404/PGRST202**: RPC non presente o non esposta nello schema API, ricaricare schema PostgREST.
- **Realtime disconnesso**: l’app riprova e legge le ultime prenotazioni ogni 15 secondi mentre è aperta.
- **Pagina obsoleta**: forzare aggiornamento, ricaricare URL con `?v=2.5.0` negli asset.
- **iPhone bloccato o scheda chiusa**: nessun push nativo, sincronizzazione alla riapertura.


## Collaudo annullamenti e rimborsi 2.6

- Assicurarsi che le RPC `dg26_anteprima_cancellazione_v1`, `dg26_elimina_prenotazione_v1`, `dg26_annulla_viaggio_e_prenotazioni_v1` risultino disponibili e protette (no `anon`).
- Testare in staging: prenotazione senza pagamenti (eliminazione controllata), prenotazione con pagamento (allarme e posti liberati), pagamento di rimborso parziale, rimborso finale, annullamento intero viaggio, tentativo senza autorizzazione e doppio clic.
- Verificare che il registro `dg3_cancellazioni_prenotazioni` e la vista `dg3_rimborsi_prenotazioni` abbiano policy/permessi per i soli operatori.
- Verificare che la notifica di rimborso sia visibile a Nicola e Raffaele in ordine cronologico.
- Controllare con il commercialista eventuali note di credito/rettifiche fiscali, laddove necessarie.
