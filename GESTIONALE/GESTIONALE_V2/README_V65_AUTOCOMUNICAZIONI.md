# DELGROSSO Gestionale V65 — Centro comunicazioni

## Stato al 30/10/2026

- SQL `V65` installato su Supabase `chkuayhbmitdmzmmvona`: coda per nuove prenotazioni (sito+gestionale), acconti, saldi; consenso di gruppo specifico; riattivazione inviti con link e consensi.
- La coda **non spedisce niente** finché il worker server non è distribuito, schedulato e attivato con segreti server.
- La funzione `dg65-comms-status.js` mostra lo stato degli invii e permette agli operatori di registrare/revocare consenso specifico gruppo.
- Non sostituisce WhatsApp Business app con automazioni non ufficiali.

## Funzionamento

`INSERT prenotazioni` -> coda booking customer_email / customer_whatsapp / operator_email / operator_whatsapp.
`INSERT pagamenti` o `UPDATE` a stato Registrato -> coda payment email / whatsapp per Acconto/Saldo positivi e collegati a prenotazione.
`INSERT/UPDATE consenso gruppo` e `INSERT/UPDATE link gruppo` -> coda invito SOLO per chi ha consenso di gruppo.

Il worker legge email/numero dal database, si collega allo SMTP Aruba già configurato, recupera PDF archiviati o ne genera uno non fiscale, e usa la Meta Cloud API con template approvati.

## IMPORTANTISSIMO

- Le mail e i WhatsApp non sono ancora abilitati. Senza credenziali/approvazioni/costi della Cloud API non possono essere completamente automatici.
- La coda **non invia le prenotazioni storiche**. I vecchi 92 record non vengono contattati retroattivamente.
- Per poter mandare messaggi WhatsApp serve consenso specifico, da raccogliere in modo verificabile. Inserire solo con conferma reale del cliente.
- Per entrare in gruppo serve un link d'invito e consenso separato alla condivisione del numero: nessuna aggiunta forzata.
- **Non pubblicare** il codice worker/server né password in cartelle pubbliche del sito.
- Non sovrascrivere `/index.html` del sito pubblico: aggiornare solo `GESTIONALE/`.

## Prima dell'abilitazione finale

1. Configura il numero +39 320 881 5899 in Meta WhatsApp Business Platform (Cloud API), con verifica e template approvati; se usi coesistenza con l'app Business verifica l'idoneità presso Meta.
2. Imposta le variabili segrete del worker e un cron autenticato. Non incollarle nel browser né nei file GitHub.
3. Registra separatamente consenso WhatsApp e consenso gruppo al momento della prenotazione (il sito dovrà prevedere le caselle non preselezionate; l'operatore può registrare consensi reali nel gestionale).
4. Testa una prenotazione con mail e numero di prova, registra un acconto e verifica PDF, invii e errori.
5. Abilita prima email, poi WhatsApp dopo aver accettato tariffe per messaggio; aggiungi la gestione di un eventuale webhook di consegna effettiva (submitted = accettato dal provider, non necessariamente consegnato).
6. Nuove prenotazioni da sito e gestionale devono essere salvate nello stesso progetto Supabase con `prenotazioni`/`pagamenti`.

## Indicatori aggiunti

- `pending` attesa invio; `submitted` consegnato al provider; `failed` necessita verifica, senza retry automatico potenzialmente duplicante; `waiting_consent` non contattare.
- Il servizio salta rimborsi e pagamenti non registrati.
- Duplicazione protetta con vincolo univoco `(event_kind,reference_id,channel)`.
