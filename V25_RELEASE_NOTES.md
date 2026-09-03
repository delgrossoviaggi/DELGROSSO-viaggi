# GESTIONALE V25 — DOCUMENTI & COMUNICAZIONI

## Obiettivo
Completa il ciclo prenotazione → conferma PDF → email → archivio → pagamento → ricevuta PDF → reinvio.

## Novità
- Conferma prenotazione PDF archiviata nel bucket privato `ricevute-prenotazioni/conferme/`.
- Metadati conferma salvati nella tabella `prenotazioni`.
- Email conferma al partecipante tramite SMTP configurato in Gestionale > Impostazioni > Comunicazione.
- Avviso nuova prenotazione inviato a `info@delgrossoviaggi.it` e `prenotazioni@delgrossoviaggi.it` con PDF allegato.
- Acconto iniziale inserito insieme alla prenotazione: generazione e archiviazione automatica della ricevuta.
- Ricevute Acconto/Saldo già archiviate in V24 restano disponibili.
- Pulsanti per Apri PDF, reinvio Email e WhatsApp nella gestione documenti.
- Fascicolo cliente ampliato con conferme e ricevute.
- WhatsApp usa un link firmato al PDF: il browser/WhatsApp non consente a un semplice `wa.me` di allegare automaticamente un file. Per invio automatico di allegati serve WhatsApp Business Cloud API.
- Nessun nuovo database: viene usata la stessa Supabase del Gestionale.

## SQL obbligatorio
Eseguire:
`supabase/migrations/20260902_booking_documents_v25.sql`

## SMTP
Le funzioni leggono `impostazioni.comunicazione` già usato dal Gestionale. Verificare host, porta, SSL, username, password e mittente.

## Deploy
Dopo il push del progetto, pubblicare le Edge Functions:
- `send-booking-email`
- `send-payment-receipt`

## Test consigliato
1. Creare una prenotazione dal Gestionale con acconto.
2. Verificare il PDF della conferma nel fascicolo.
3. Verificare email cliente.
4. Verificare email interna a entrambe le caselle.
5. Verificare ricevuta Acconto nel fascicolo.
6. Verificare `Reinvia Email` e `WhatsApp`.
7. Registrare il Saldo e verificare che venga creata una ricevuta separata.
