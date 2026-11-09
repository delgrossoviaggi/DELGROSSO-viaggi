# DELGROSSO Gestionale V59 — ottimizzazione iPhone

## Contenuto
Base: V58 integrata, con moduli JavaScript/CSS originali, piantine GT53/GT63, Control Room, prenotazioni, flotta, gestione viaggi e noleggi. Nessuna modifica allo schema Supabase o ai dati.

## Ottimizzazioni
- Rimossi dal documento HTML i grandi loghi/foto statici incorporati in base64; riutilizzati gli stessi identici file presenti nella cartella `assets/`.
- Loghi per ricevute/stampe conservati incorporati in versione PNG leggera, per non compromettere l'uso su iPhone e la stampa.
- Ricaricamento automatico su iPhone meno frequente nelle schermate riepilogative (non nelle schermate operative: Prenotazioni, Control Room, BUS/BIS, Pagamenti, Noleggi, Flotta e Caricamento viaggi). Durante i soli aggiornamenti automatici su smartphone, le grandi foto flotta già caricate sono riutilizzate fino a 2 minuti; gli aggiornamenti manuali le ricaricano sempre.
- Monitor dei posti BUS/BIS aggiornato soltanto con il modulo prenotazione aperto: evita chiamate inutili quando chiuso.
- Ridotti i ridisegni periodici della dashboard su smartphone.
- Evitato il precaricamento simultaneo di tutte le foto della flotta su smartphone.
- Aggiornamento manuale/ricaricamento esplicito e controllo dei posti al salvataggio conservati.

## Sostituzione GitHub
1. Crea una copia del repository (o un branch) prima di iniziare.
2. Estrai l'archivio e carica **tutti** i file e le cartelle mantenendo le stesse gerarchie, soprattutto `assets/` e i file `.js`/`.css` nella root.
3. Mantieni le variabili del progetto Vercel ed eventuali file del repository non presenti nell'archivio; non cancellare altre cartelle senza averle confrontate.
4. Verifica Vercel Preview con Nicola e Raffaele: login, salvataggio prenotazioni, piantine GT53/GT63, spostamento BUS BIS, Control Room, Noleggi e PDF.
5. Su iPhone chiudi e riapri la scheda dopo il deployment; in caso di cache obsoleta ricarica Safari.

## Limiti di verifica
Test locali statici non sostituiscono prove di scrittura autenticata su Supabase e collaudi su iPhone fisico. La cache dei dati in tempo reale dipende anche dalla rete mobile e dalla quantità di record/fotografie in Supabase.
