# DELGROSSO Business Suite V11 — Piantine automatiche e Larino 57 posti

## Crea una nuova piantina (PC, iPhone, Android)

1. Dal menu Business Suite apri **Crea / Modifica piantine** (sezione editor integrata).
2. Premi **⚡ Genera piantina da N posti**, inserisci il nome e il numero di sedili, per esempio 57. La numerazione da 1 a N viene creata automaticamente.
3. Oppure premi **+ Nuova piantina** e tocca le celle vuote: lo strumento **+ Sedile (numero automatico)** sceglie il numero disponibile senza chiedere valori manuali.
4. Premi **+ Fila con 4 sedili numerati** per aggiungere una fila automaticamente; puoi anche inserire corridoi e porte.
5. **Rinumera 1 → N** rinumera la bozza in ordine di lettura. Usa questa funzione SOLO prima di attribuire posti ai prenotati; non modifica automaticamente le prenotazioni.
6. **Salva nella libreria Supabase** per ritrovare le piantine su tutti i dispositivi. **Salva bozza** è soltanto locale; **Scarica piantina PDF** continua a funzionare.

## Larino · 13 dicembre 2026

- Viaggio: `779a7ea2-baa4-4b9d-a581-a2ca8c59b0bd`
- Capienza verificata su Supabase: **57 posti**, **48 occupati**, **9 liberi**.
- Flotta Irizar Scania PB B: resta **63 posti** per gli altri viaggi.
- Per rendere la capienza coerente, gli ex posti prenotati 58/59/60/61/62/63 sono stati ricollocati sui posti liberi 11/12/13/14/15/16. Nessuna prenotazione o pagamento è stato eliminato.
- **Avvisare il referente della prenotazione interessata della nuova numerazione** prima della partenza.
- La Business Suite V11 e l'editor V2 mostrano 57 posti utilizzabili per il viaggio Larino, senza ridurre permanentemente la capienza del mezzo.

## Installazione

Caricare la cartella `GESTIONALE_V2/` nella radice del repository GitHub su un branch di prova, come per le versioni precedenti. Non sovrascrivere la cartella `GESTIONALE/`. Dopo il deployment, controllare `GESTIONALE_V2/VERIFICA_RELEASE.html` e quindi aprire `GESTIONALE_V2/index.html`.

## Verifiche e limitazioni

- Test automatici della numerazione e generazione 57 posti superati; test di rendering dell'editor su Chromium simulato da PC e viewport iPhone superati.
- Verifica diretta Supabase della capienza e dei posti prenotati effettuata.
- Non è stato eseguito un test completo dopo il deployment su Safari iOS reale e con account autenticati; non dichiarare la V11 collaudata in produzione fino a tale prova.
- La creazione di una piantina e il suo salvataggio nella libreria non la pubblicano automaticamente sul sito di prenotazione: l'assegnazione a un autobus è una operazione separata.
