# V43 — Verifica completa ricevute Acconto/Saldo e conferme prenotazione

## Verifica pre-consegna
- `paymentReceiptService-v24.js`: import jsPDF corretto sull'export `t`.
- Generazione PDF ricevuta Acconto verificata con il bundle jsPDF reale: `pageSize` A4 disponibile, Blob `application/pdf`, header `%PDF-1.3`.
- Generazione PDF ricevuta Saldo verificata con lo stesso percorso.
- `pdfReceiptService-M28dXixt.js`: import jsPDF corretto sull'export `t`; il generatore usa `internal.pageSize.getWidth()` / `getHeight()`.
- Generazione della conferma prenotazione verificata con il generatore PDF reale: Blob `application/pdf`, header `%PDF-1.3`.
- Tutti gli 87 moduli JavaScript del Gestionale superano il controllo sintattico Node.
- Le 46 referenze locali `<script src>` delle pagine HTML risultano tutte risolte.
- Le Edge Function `send-payment-receipt` e `send-booking-confirmation` superano il controllo TypeScript strict senza errori.
- Il flusso Pagamenti richiama `issuePaymentReceipt` dopo la registrazione del movimento.
- Il flusso Prenotazioni richiama `issueBookingDocuments` e, quando presente un acconto iniziale, `issuePaymentReceipt`.
- Non è stato reintrodotto il vecchio enhancer `dg-prenotazioni-v38.js` responsabile dei crash da MutationObserver.

## Flusso ricevuta Acconto/Saldo
1. Il movimento viene registrato in `pagamenti`.
2. Il PDF viene generato localmente.
3. Il PDF viene inviato alla Edge Function `send-payment-receipt`.
4. La Edge Function archivia prima il PDF nel bucket privato `ricevute-prenotazioni`.
5. Vengono registrati `receipt_number`, `receipt_generated_at` e `receipt_storage_path`.
6. Solo dopo viene tentato l'invio email.
7. Un eventuale errore SMTP non cancella l'archivio: viene registrato in `receipt_email_error`.
8. L'Archivio può quindi recuperare la ricevuta dal `receipt_storage_path`.

## Flusso conferma prenotazione
1. La prenotazione viene salvata.
2. La conferma PDF viene generata.
3. La conferma viene archiviata in `ricevute-prenotazioni/conferme/...`.
4. I metadati `confirmation_*` vengono aggiornati sulla prenotazione.
5. Solo dopo viene tentato l'invio email al partecipante e l'email interna.
6. Un errore SMTP non impedisce l'archiviazione del PDF.

## Limite del test
Non è stato effettuato un invio reale contro l'istanza Supabase/SMTP dell'azienda dall'ambiente di verifica. Il codice e i due generatori PDF sono stati verificati localmente; il test reale di archiviazione/email richiede l'esecuzione della Edge Function nel progetto Supabase.
