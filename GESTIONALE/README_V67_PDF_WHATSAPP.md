# DELGROSSO Gestionale V67 — invio WhatsApp assistito con PDF

## COSA FA
- Dal pulsante WhatsApp accanto a una prenotazione o a un acconto/saldo registrato prepara automaticamente il documento PDF dal server.
- Prenotazioni: funzione Supabase `dg67-booking-pdf` (autenticazione operatore obbligatoria, nessuna email o WhatsApp inviati, nessuna modifica alle prenotazioni o ai pagamenti).
- Acconti e saldi: riutilizza la ricevuta professionale PDF già archiviata; se manca la genera **una sola volta** tramite `professional-receipts` e conserva il percorso restituito. Non rigenera ricevute professionali già presenti.
- Telefonino: «Condividi PDF» attiva il menu nativo di condivisione con documento e testo; scegli WhatsApp e il cliente nella schermata del telefono. Non può selezionare automaticamente il destinatario.
- PC: «Apri chat + scarica PDF» apre la chat WhatsApp col numero e il testo già compilati e scarica il PDF; bisogna allegare il PDF manualmente nella chat prima di premere Invia.
- «Scarica solo PDF» prepara il documento senza aprire WhatsApp.

## LIMITI REALI
La piattaforma WhatsApp click-to-chat `wa.me` non accetta un allegato file PDF. Il browser non può forzare WhatsApp a combinare numero, testo e PDF nella stessa chat senza un'API ufficiale. Alcuni dispositivi non supportano la condivisione nativa del file PDF; in quel caso resta la modalità PC/manuale. Il pulsante non invia mai messaggi da solo.

## INSTALLAZIONE
- Distribuire soltanto la cartella `GESTIONALE/` in GitHub; NON nella root del sito pubblico.
- Il modulo `dg67-whatsapp-pdf.js` viene caricato dopo `dg64-whatsapp-actions.js`.
- Funzione server `dg67-booking-pdf`: distribuita su Supabase, protezione JWT e controllo operatore abilitati.
- Testare con una prenotazione e un pagamento di prova, uno alla volta, sia da PC sia da telefonino.
- La V66 e il precedente ripristino email rimangono invariati; questa versione migliora l'invio WhatsApp manuale.
- NON caricare chiavi segrete, password SMTP o token Meta nel repository pubblico.
