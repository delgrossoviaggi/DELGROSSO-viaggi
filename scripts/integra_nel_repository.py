#!/usr/bin/env python3
"""Eseguire dalla root del repository DELGROSSO, DOPO aver copiato i file GESTIONALE/ dal pacchetto."""
from pathlib import Path
import sys
root=Path.cwd()
index=root/'GESTIONALE'/'index.html'
required=['dg79-partenza-modello.js','dg79-partenza-pdf.js','dg79-riepilogo-partenza.js','dg80-contanti-modello.js','dg80-contanti-viaggi.js','dg80-contanti.css']
missing=[x for x in required if not (root/'GESTIONALE'/x).is_file()]
if missing:
 print('ATTENZIONE: moduli V79/V80 da verificare nel repository:',', '.join(missing))
 print('Non modifico index.html per evitare un caricamento incompleto.');sys.exit(2)
if not index.is_file():sys.exit('ERRORE: eseguire dalla root del repository con GESTIONALE/index.html presente.')
s=index.read_text(encoding='utf-8')
style='<link rel="stylesheet" href="dg81-accesso-rapido.css">'
script='<script src="dg81-accesso-rapido.js" defer></script>'
if style in s and script in s:print('V81 gia installata');sys.exit(0)
backup=index.with_name('index.html.backup-prima-v81');backup.write_text(s,encoding='utf-8')
if '</head>' not in s or '</body>' not in s:sys.exit('ERRORE: struttura HTML anomala. Backup creato, nessuna modifica.')
if style not in s:s=s.replace('</head>','  '+style+'\n</head>',1)
if script not in s:s=s.replace('</body>','  '+script+'\n</body>',1)
index.write_text(s,encoding='utf-8')
print('V81 collegata correttamente a GESTIONALE/index.html; backup:',backup.name)
