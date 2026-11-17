#!/usr/bin/env python3
"""Applicatore locale: esegui dalla radice della repository usando python INSTALLA_PATCH.py /percorso/repository.
Backup dei file modificati prima di ogni scrittura. Nessuna chiamata a Supabase.
"""
from pathlib import Path
import sys, shutil

base=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path.cwd()
source=Path(__file__).resolve().parent
folder=base/'GESTIONALE'/'nuovo'
idx=folder/'index.html'
layouts=folder/'piantine-v37.js'
addon=folder/'pdf-piantine-nominativi.js'
if not idx.is_file() or not layouts.is_file():
    raise SystemExit('ERRORE: cartella repository non riconosciuta. Occorrono GESTIONALE/nuovo/index.html e piantine-v37.js')

old_idx=idx.read_text(encoding='utf8')
old_layout=layouts.read_text(encoding='utf8')
idx_needle='<script defer src="./piantine-v37.js?v=dg37"></script>'
idx_inject='<script defer src="./pdf-piantine-nominativi.js?v=20261117-pdf-nominativi"></script>'+idx_needle
button_needle='<button type="button" class="btn" data-dl="pdf-trip">Scarica PDF viaggio + BUS BIS</button>'
button_inject='<button type="button" class="btn solid" data-dl="pdf-map">Scarica piantina con NOMI e COLORI (PDF A3)</button>'+button_needle
click_needle="  else if(k==='pdf-trip')await pdf('trip');"
click_inject="  else if(k==='pdf-map')await pdf('map');\n"+click_needle
pdf_needle=" const bytes=global.DG2Pdf.makeOperationalPdf(groups,{requireOfficial:true});"
pdf_inject=" const bytes=kind==='map'?global.DGSeatPdf?.makeSeatMapPdf(groups):global.DG2Pdf.makeOperationalPdf(groups,{requireOfficial:true});\n if(!bytes)throw Error('Generatore piantine nominativi non caricato.');"
name_needle=" return downloadPdf(bytes,'DELGROSSO_CONTROL_ROOM_'+(kind==='sunday'?'22_11_2026':kind==='all'?'TUTTI_I_VIAGGI':'VIAGGIO')+'.pdf');"
name_inject=" return downloadPdf(bytes,kind==='map'?'DELGROSSO_PIANTINA_PRENOTATI_CON_NOMI.pdf':'DELGROSSO_CONTROL_ROOM_'+(kind==='sunday'?'22_11_2026':kind==='all'?'TUTTI_I_VIAGGI':'VIAGGIO')+'.pdf');"

changes=[(idx,old_idx,[(idx_needle,idx_inject)]),(layouts,old_layout,[(button_needle,button_inject),(click_needle,click_inject),(pdf_needle,pdf_inject),(name_needle,name_inject)])]
outputs=[]
for file,text,replacements in changes:
    for needle,replacement in replacements:
        if replacement in text:continue
        if text.count(needle)!=1:raise SystemExit(f'ERRORE: versione non compatibile per {file} — riferimento {needle[:60]!r} (trovati {text.count(needle)}). Nessun file modificato.')
        text=text.replace(needle,replacement)
    outputs.append((file,text))
if not (base/'GESTIONALE'/'seatmap-groups.js').is_file():raise SystemExit('ERRORE: manca il modulo condiviso GESTIONALE/seatmap-groups.js')
for file,text in outputs:
    if file.read_text(encoding='utf8')!=text:
        shutil.copy2(file,file.with_suffix(file.suffix+'.backup-prima-pdf-nominativi'))
        file.write_text(text,encoding='utf8')
shutil.copy2(source/'GESTIONALE'/'nuovo'/'pdf-piantine-nominativi.js',addon)
print('OK: PDF nominativi A3 installato. Eseguire: node tests/test-pdf-nominativi.cjs')
