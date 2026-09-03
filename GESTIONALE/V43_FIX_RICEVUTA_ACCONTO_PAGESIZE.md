# V43 — Fix ricevuta acconto/saldo + hardening pre-consegna

## Controlli eseguiti
- Verificato che `paymentReceiptService-v24.js` importi il costruttore jsPDF dall'export corretto (`t`).
- Verificato direttamente il bundle jsPDF: `new JsPDF({orientation:'portrait', unit:'mm', format:'A4'})` produce `internal.pageSize` valido (A4: circa 210 x 297 mm) e un Blob PDF valido.
- Verificata la sintassi JavaScript dei moduli coinvolti.
- Verificato il collegamento della pagina Pagamenti a `issuePaymentReceipt`.
- Verificato il collegamento alla Edge Function `send-payment-receipt`.
- Verificato che l'archiviazione usi il bucket privato `ricevute-prenotazioni`.

## Correzione principale
L'errore `Cannot read properties of undefined (reading 'pageSize')` era compatibile con l'importazione del costruttore jsPDF dall'export errato. Il servizio ora usa:

`import { t as JsPDF } from './jspdf.es.min-DT2zzJUL.js';`

## Hardening aggiuntivo
La Edge Function `send-payment-receipt` è stata resa più robusta: il PDF e i metadati del pagamento vengono archiviati/registrati **prima** del tentativo di invio email. Un errore SMTP, una password mancante o un problema nella signed URL non fanno più fallire l'operazione di archiviazione. Lo stato `receipt_email_sent` e l'eventuale `receipt_email_error` vengono aggiornati separatamente.

Questo evita il caso precedente in cui il PDF poteva essere già caricato ma un errore successivo faceva apparire il movimento come ricevuta non inviata.
