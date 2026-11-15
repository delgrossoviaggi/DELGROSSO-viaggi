# DELGROSSO VIAGGI 3.0 ULTIMATE — Audit piantine (15/11/2026)

**Stato:** sviluppo su branch separato, non applicato alla produzione. Nessuna prenotazione, pagamento, ricevuta o piantina ufficiale modificata.

## Connessioni
- GitHub: delgrossoviaggi/DELGROSSO-viaggi (sito nella root, gestionale in GESTIONALE/).
- Vercel: delgrosso-viaggi, produzione identificata sul commit 620f11426dc607cb6d7757dc381c5a1933093704.
- Supabase gestionale: chkuayhbmitdmzmmvona, dati operativi attivi.
- Supabase sito: bhsanrbadsqcpbtxupmr, le sue tabelle prenotazioni/viaggi erano vuote.

## Fotografia del database (sola lettura)

| Risorsa | Righe |
|---|---:|
| Autobus GT | 3 |
| Viaggi | 18 |
| Prenotazioni | 137 |
| Indice posti prenotazione_posti | 629 |
| Pagamenti | 96 |
| Bozze libreria | 1 |
| Master bus ufficiali | 0 |
| Snapshot viaggio ufficiali | 0 |

I GT sono Century 53, PB A 63, PB B 63. La capienza registrata NON attesta la posizione fisica dei sedili.

## Coerenza delle prenotazioni

Cinque partenze avevano meno righe nell'indice prenotazione_posti rispetto al contatore posti_occupati: Napoli 08/12, Larino 13/12, Napoli 13/12, Napoli 20/12 e Alberobello/Locorotondo 20/12. Combinando l'indice con il formato storico prenotazioni.posti_selezionati, tutte le 14 partenze future non archiviate esaminate risultavano riconciliate. La somma dei posti richiesti dalle prenotazioni attive coincideva con i contatori. Nessun duplicato (viaggio, posto) era presente nell'indice dei posti delle prenotazioni attive.

Questa verifica NON attesta la corrispondenza geometrica fisica, i PDF, la sicurezza del check-in o l'assenza di race condition.

## Problemi comprovati

1. Salva bozza eseguiva una rinumerazione implicita.
2. Pubblica poteva utilizzare una versione salvata differente dalla bozza modificata sulla schermata.
3. Le pubblicazioni ufficiali non avevano uno storico append-only.
4. La pubblicazione di un master poteva alterare un viaggio già prenotato e privo di snapshot.
5. Il sito mantiene un fallback con geometrie legacy, perché non risultano piantine ufficiali validate.
6. La variante fisicamente 63 / prenotabili 57 richiede nuova logica; la RPC attuale confonde capacità fisica e posti vendibili.

## Realizzato nel branch DG29

- Editor: nessuna rinumerazione implicita, blocco di pubblicazioni non salvate, controlli numerazione, undo/redo, spostamento touch, duplicazione, archivio bozza e ripristino da storico.
- Patch SQL additiva: versioni immutabili, RLS, checksum SHA-256 e guardia sulla geometria dei viaggi già prenotati.
- Audit di sola lettura, smoke test e CI.

## Gate non superati (NON rilasciare)

- [ ] Backup Supabase operativo verificato mediante prova di restore. Non disponibile tramite gli strumenti connessi.
- [ ] Migrazione testata su ambiente di collaudo.
- [ ] Geometria reale dei tre bus validata.
- [ ] Snapshot indipendenti per viaggi già prenotati, prima di modificare le piantine master.
- [ ] Modello 63 fisici / 57 prenotabili senza eliminare sedili.
- [ ] Collaudo end-to-end prenotazioni concorrenti, BUS BIS, spostamenti e rimborsi.
- [ ] Test PDF iOS, Realtime, privacy e regressione.
- [ ] Rilascio Vercel controllato, verifiche e osservabilità.

## Rollback

Non unire la PR se non sono soddisfatti i gate. Dopo eventuale migrazione non cancellare lo storico; ripristinare prima il frontend dalla release nota e predisporre rollback del DB solo da backup verificato. La migrazione del branch non deve essere eseguita direttamente sulla produzione.
