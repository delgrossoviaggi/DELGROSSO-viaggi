DELGROSSO GESTIONALE OPERATIVO — V4.0

AVVIO CONSIGLIATO
1. Estrai questa cartella sul PC.
2. NON modificare la struttura interna.
3. Fai doppio clic su AVVIA_GESTIONALE.bat.
4. Si apre automaticamente il gestionale in Chrome all'indirizzo http://127.0.0.1:8787/index.html.
5. Accesso: operatore nicola; account Supabase: nicola@delgrossoviaggi.it.
6. La password NON è salvata nel file.

IMPORTANTE
- Il gestionale usa il progetto Supabase gestionale chkuayhbmitdmzmmvona.
- Economia e Control Room leggono direttamente i dati caricati da Supabase.
- Il gestionale esegue sincronizzazione automatica quando la pagina è aperta.
- Se Supabase è temporaneamente offline, il gestionale mostra OFFLINE invece di inventare dati.
- index.html ora prova anche a collegarsi quando viene aperto direttamente da file://, ma AVVIA_GESTIONALE.bat resta l'avvio consigliato.

NON USARE SERVICE_ROLE
Il client distribuito contiene esclusivamente la publishable key. L'autenticazione passa da Supabase Auth.
