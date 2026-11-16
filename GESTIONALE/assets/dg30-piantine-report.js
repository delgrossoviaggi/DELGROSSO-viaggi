/* DELGROSSO VIAGGI — DG30, pacchetto installazione manuale 2026-11-16.
   Add-on non distruttivo al gestionale attuale. NON cambia il DB, il sito o i pagamenti. */
(function DG30ManualLayouts(){
  'use strict';
  const VERSION = 'DG30 · 16/11/2026';
  let report = null;
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = x => x && typeof x === 'object' && !Array.isArray(x);
  function assertAccess(){
    if(typeof DGData === 'undefined' || !DGData.sessionActive || (typeof isDemo==='function' && isDemo()))
      throw Error('Accedi come operatore autorizzato Nicola/Raffaele: le liste non sono disponibili nella demo.');
  }
  function currentBusId(){return document.querySelector('.dg28-buses [data-dg28="bus"].active')?.dataset.id || ''}
  function notice(msg,isError=false){let el=document.getElementById('dg30-message');if(el){el.textContent=msg;el.style.color=isError?'#a23434':'#175e59'}else if(typeof toast==='function')toast(msg)}
  function styles(){
    if(document.getElementById('dg30-styles'))return;
    const s=document.createElement('style');s.id='dg30-styles';s.textContent=`
      .dg30-version-link{display:inline-flex;align-items:center;padding:7px 12px;background:#e5f5ef;border:1px solid #a0cec5;border-radius:22px;color:#164d48;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}
      .dg30-tools{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}.dg30-tools button{border:1px solid #aac8c7;background:#fff;padding:10px 13px;border-radius:10px;cursor:pointer;color:#174f52;font-weight:700}
      .dg30-tools button.dg30-primary{background:#0d6267;color:white}.dg30-box{padding:15px;margin:13px 0;background:#f7faf9;border:1px solid #c5dcd7;border-radius:12px}
      .dg30-metrics{display:flex;flex-wrap:wrap;gap:10px}.dg30-metric{min-width:130px;background:white;padding:12px;border-radius:10px;border:1px solid #d6e2df}
      .dg30-metric b{display:block;font-size:20px}.dg30-form{width:100%;max-width:550px;padding:11px;border:1px solid #b6cfc9;border-radius:8px;background:white;color:#183d40}
      .dg30-scroll{overflow-x:auto;max-width:100%}.dg30-table{width:100%;border-collapse:collapse;font-size:13px;min-width:650px}.dg30-table td,.dg30-table th{padding:9px 10px;text-align:left;border-bottom:1px solid #d5dfdf}.dg30-table thead{background:#e6f1ee}
      .dg30-tag{font-size:11px;border:1px solid #bdd9d3;padding:3px 6px;border-radius:5px;display:inline-block;margin:2px}
      .dg30-note{font-size:12px;color:#536e71;line-height:1.55}.dg30-sell57{border-left:4px solid #0d6267;padding-left:12px}
      #dg30-print{display:none}
      @media print{body>*:not(#dg30-print){display:none!important}#dg30-print{display:block!important;background:white;color:black;font:10pt Arial,sans-serif}#dg30-print table{border-collapse:collapse;width:100%}#dg30-print td,#dg30-print th{border:1px solid #aaa;padding:5px;vertical-align:top}#dg30-print h1{font-size:18pt}#dg30-print h2{font-size:13pt}#dg30-print .dg30-p-row{display:flex;gap:4px;margin:3px 0;break-inside:avoid}#dg30-print .dg30-p-cell{min-width:45px;padding:5px;border:1px solid #aaa;text-align:center}#dg30-print .dg30-p-seat{background:#e5e5e5}#dg30-print .dg30-p-nonseat{color:#777}#dg30-print .dg30-p-front{font-weight:bold;padding:8px}#dg30-print .dg30-p-stops{break-before:page} }
      @media(max-width:680px){.dg30-version-link{padding:5px 8px;font-size:10px}.dg30-metric{min-width:110px}.dg30-tools button{flex:1 1 130px}}
    `;document.head.appendChild(s);
  }
  function badge(){
    styles();const f=document.getElementById('footer-mode');if(f)f.textContent='Piantine '+VERSION+' · versione manuale · dati Supabase';
    if(document.getElementById('dg30-open'))return;
    const right=document.querySelector('.topbar-right');if(!right)return;
    const a=document.createElement('a');a.id='dg30-open';a.className='dg30-version-link';a.href='piantine.html?v=3.0.16';a.textContent='🚌 Piantine '+VERSION;
    right.insertBefore(a,right.firstChild);
  }
  function panel(){
    return `<section class="panel" id="dg30-operations">
      <h3>🚌 Control Room Piantine — DG30 · Aggiornamento manuale</h3>
      <p class="dg30-note">Modulo operativo aggiuntivo: elenco prenotati per viaggio e per fermata, numero posto, CSV e stampa PDF da PC/iPhone. Nessun pagamento o prenotazione viene modificato.</p>
      <div class="dg30-box"><label for="dg30-trip"><b>1. Seleziona il viaggio</b></label><br>
        <select id="dg30-trip" class="dg30-form"><option value="">Carica l’elenco dei viaggi…</option></select>
        <div class="dg30-tools"><button type="button" class="dg30-primary" data-dg30="report">Carica prenotati e posti</button>
          <button type="button" data-dg30="csv">Esporta lista CSV (iPhone/Excel)</button>
          <button type="button" data-dg30="print">Stampa / salva come PDF</button></div>
        <div id="dg30-result" aria-live="polite" class="dg30-note">Scegli un viaggio e premi «Carica prenotati e posti».</div>
      </div>
      <div class="dg30-box dg30-sell57"><b>2. Piantine personalizzabili: 53 / 63 / variante 57 posti</b>
        <p class="dg30-note">Seleziona prima uno degli autobus GT sopra. Puoi creare una <b>bozza da 57 sedili</b> per un mezzo da 63, modificandola a mano: non cambia la capienza omologata e non aggiorna da sola i posti vendibili del viaggio.</p>
        <div class="dg30-tools"><button type="button" class="dg30-primary" data-dg30="draft57">+ Crea bozza 57 posti</button><button type="button" data-dg30="export">Esporta bozza JSON</button>
          <label style="align-self:center">Importa bozza JSON <input type="file" id="dg30-import" accept=".json,application/json" style="max-width:190px"></label>
          <button type="button" data-dg30="import">Importa come NUOVA bozza</button></div>
      </div>
      <div class="dg30-box"><b>3. Sincronizzazione piantine e sito</b>
        <p class="dg30-note">Conta le piantine ufficiali effettivamente pubblicate in Supabase. Una bozza salvata non compare automaticamente sul sito. Pubblica dall’editor solo dopo aver controllato la disposizione reale dei sedili e la numerazione.</p>
        <div class="dg30-tools"><button type="button" data-dg30="diagnostic">Verifica piantine ufficiali</button></div><div id="dg30-diagnostic" class="dg30-note"></div>
      </div><p id="dg30-message" role="status" class="dg30-note"></p>
    </section>`;
  }
  function storeDownload(content,filename,mime){
    const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function cleanFilename(name){return String(name||'viaggio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,70)}
  function parseSeatValues(raw){
    if(Array.isArray(raw))return raw.flatMap(parseSeatValues);
    if(valid(raw))return Object.keys(raw).flatMap(key=>parseSeatValues(raw[key]));
    const value=String(raw??'').trim();if(!value)return [];
    // Supporta liste JSON legacy e stringhe "1, 2, 3"; evita di interpretare qualsiasi testo come numero di sedile.
    if((value[0]==='['||value[0]==='{')){try{return parseSeatValues(JSON.parse(value))}catch{return []}}
    return value.split(/[,;\s|/]+/).filter(x=>/^\d{1,3}$/.test(x));
  }
  function seatNumbers(booking,index){
    const direct=index.filter(x=>String(x.prenotazione_id)===String(booking.id)).map(x=>String(x.posto??'')).filter(x=>/^\d{1,3}$/.test(x));
    const legacy=parseSeatValues(booking.posti_selezionati);
    return [...new Set([...direct,...legacy])].sort((a,b)=>Number(a)-Number(b));
  }
  function activeBooking(x){return !/annull|cancell|eliminat|rimborsat/i.test(String(x.stato||''))}
  function asDate(x){const s=String(x||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):s}
  function money(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('it-IT',{style:'currency',currency:'EUR'}):'—'}
  function rowSummary(r){const name=String(r.b.cliente_nome||r.b.cliente||'Nominativo da verificare');return {name,stop:r.stop,seats:r.seats.join(', ')||'Non assegnati',people:Number(r.b.posti)||0,paid:Number(r.b.pagato)||0,clientPhone:r.b.telefono||'',bookingId:r.b.id}}
  function selectedTripId(){return document.getElementById('dg30-trip')?.value||''}
  async function populateTrips(){
    assertAccess();const target=document.getElementById('dg30-trip');if(!target)return;
    const existing=target.value;
    const trips=(await DGData.rows('trips')).filter(x=>!x.archiviato_at&& !/annull|eliminat/i.test(String(x.stato||'')));
    trips.sort((a,b)=>String(b.data_partenza||'').localeCompare(String(a.data_partenza||'')));
    target.innerHTML='<option value="">— Seleziona il viaggio —</option>'+trips.map(t=>`<option value="${h(t.id)}">${h(asDate(t.data_partenza))} · ${h(t.titolo)} · ${h(t.posti_totali)} posti</option>`).join('');
    if(trips.some(x=>String(x.id)===existing))target.value=existing;
  }
  async function generateReport(){
    assertAccess();const id=selectedTripId();if(!id)throw Error('Seleziona prima il viaggio dal menu DG30.');
    const [trips,bookings,index,officialTrips,officialBuses,fleet]=await Promise.all([
      DGData.rows('trips'),DGData.rows('bookings'),DGData.rows('seatrows'),DGData.rows('officialTripLayouts'),DGData.rows('officialBusLayouts'),DGData.rows('fleet')]);
    const trip=trips.find(x=>String(x.id)===String(id));if(!trip)throw Error('Viaggio non trovato nel gestionale.');
    const people=bookings.filter(x=>String(x.viaggio_id)===String(id)&&activeBooking(x));
    const idx=index.filter(x=>String(x.viaggio_id)===String(id));
    const rows=people.map(b=>({b,seats:seatNumbers(b,idx),stop:String(b.fermata_partenza||'Fermata non indicata').trim()||'Fermata non indicata'}));
    rows.sort((a,b)=>a.stop.localeCompare(b.stop,'it')||(Number(a.seats[0]||999)-Number(b.seats[0]||999))||rowSummary(a).name.localeCompare(rowSummary(b).name,'it'));
    const groups={};for(const r of rows){(groups[r.stop]??=[]).push(r)}
    const bus=fleet.find(x=>String(x.id)===String(trip.autobus_id));
    const official=officialTrips.find(x=>String(x.viaggio_id)===String(id))||officialBuses.find(x=>String(x.autobus_id)===String(trip.autobus_id));
    const allNumbers=rows.flatMap(x=>x.seats);const duplicates=allNumbers.filter((x,i)=>allNumbers.indexOf(x)!==i);
    const unassigned=rows.filter(r=>r.seats.length===0).length;
    report={trip,bus,rows,groups,layout:official?.configurazione||null,layoutSource:official?('viaggio_id' in official?'Variante viaggio':'Piantina autobus'):'Nessuna piantina ufficiale',loadedAt:new Date(),unassigned,duplicates:[...new Set(duplicates)]};
    const totals=rows.reduce((n,r)=>n+(Number(r.b.posti)||0),0);
    const metrics=`<div class="dg30-metrics"><div class="dg30-metric">Prenotazioni <b>${rows.length}</b></div><div class="dg30-metric">Persone registrate <b>${totals}</b></div><div class="dg30-metric">Posti viaggio <b>${h(trip.posti_totali)}</b></div><div class="dg30-metric">Fermate <b>${Object.keys(groups).length}</b></div></div>`;
    const warnings=[report.unassigned?`${report.unassigned} prenotazioni senza numero di posto in indice/legacy`:null,report.duplicates.length?`Numeri di posto ripetuti: ${report.duplicates.join(', ')}`:null,!report.layout?'Non risulta una piantina ufficiale pubblicata per questo viaggio/autobus':null].filter(Boolean);
    const tbody=rows.map(r=>{const x=rowSummary(r);return `<tr><td>${h(x.stop)}</td><td>${h(x.name)}</td><td>${h(x.people)}</td><td>${h(x.seats)}</td><td>${h(r.b.stato||'')}</td></tr>`}).join('');
    const table=`<div class="dg30-scroll"><table class="dg30-table"><thead><tr><th>Fermata</th><th>Cliente</th><th>Persone</th><th>Posti</th><th>Stato prenotazione</th></tr></thead><tbody>${tbody||'<tr><td colspan="5">Nessun prenotato attivo per questo viaggio.</td></tr>'}</tbody></table></div>`;
    const result=document.getElementById('dg30-result');if(result)result.innerHTML=`<h4>${h(trip.titolo)} · ${h(asDate(trip.data_partenza))}</h4>${metrics}<p><b>Piantina:</b> ${h(report.layoutSource)} · <b>Autobus:</b> ${h(bus?.titolo||trip.autobus||'Non assegnato')}</p>${warnings.map(w=>`<p role="alert" style="color:#9b3b27">⚠ ${h(w)}</p>`).join('')}${table}`;
    notice('Elenco caricato dal gestionale. Puoi esportare CSV o stampare/salvare PDF.');
  }
  function csv(){if(!report)throw Error('Prima carica un viaggio tramite «Carica prenotati e posti».');if(String(report.trip.id)!==selectedTripId())throw Error('Hai cambiato viaggio: ricarica i prenotati prima di esportare.');
    const q=x=>{let value=String(x??'');if(/^[\s]*[=+@\-]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"'};
    const data=[['Fermata','Cliente','Persone','Posti','Stato prenotazione','Pagato da archivio prenotazione','Telefono'],...report.rows.map(r=>{const x=rowSummary(r);return[x.stop,x.name,x.people,x.seats,r.b.stato||'',x.paid,x.clientPhone]})];
    storeDownload('\ufeff'+data.map(row=>row.map(q).join(';')).join('\r\n'),`DELGROSSO_LISTA_${cleanFilename(report.trip.titolo)}_${asDate(report.trip.data_partenza).replace(/\//g,'-')}.csv`,'text/csv;charset=utf-8');
    notice('CSV scaricato localmente. Tratta il file come dato riservato: contiene nominativi e telefoni.');
  }
  function printLayout(){
    if(!report?.layout?.rows?.length)return '<p><b>ATTENZIONE: nessuna piantina ufficiale presente.</b> Si stampa l’elenco nominativo, senza inventare la posizione fisica dei sedili.</p>';
    const occupants=new Map();for(const r of report.rows)for(const s of r.seats){const a=occupants.get(s)||[];a.push(rowSummary(r).name);occupants.set(s,a)}
    return `<div class="dg30-p-front">FRONTE BUS · ${h(report.layoutSource)} (verificare schema reale)</div>`+
     report.layout.rows.map((row,i)=>`<div class="dg30-p-row"><b style="min-width:42px">Fila ${i+1}</b>${(row.cells||[]).map(cell=>{
       const typ=cell?.type||'empty';if(typ!=='seat')return `<div class="dg30-p-cell dg30-p-nonseat">${h(({aisle:'║',door:'PORTA',driver:'GUIDA',wc:'WC',table:'TAV.',empty:'·'})[typ]||'·')}</div>`;
       const num=String(cell.id||''); const names=occupants.get(num)||[];return `<div class="dg30-p-cell dg30-p-seat"><b>${h(num)}</b><div style="font-size:8pt">${h(names.join(' / ')||cell.status||'Libero')}</div></div>`;
     }).join('')}</div>`).join('');
  }
  function printReport(){
    if(!report)throw Error('Carica prima i prenotati e i posti.');if(String(report.trip.id)!==selectedTripId())throw Error('Ricarica il viaggio selezionato prima della stampa.');
    document.getElementById('dg30-print')?.remove();
    const el=document.createElement('div');el.id='dg30-print';
    const table=report.rows.map(r=>{const x=rowSummary(r);return `<tr><td>${h(x.stop)}</td><td>${h(x.name)}</td><td>${h(x.people)}</td><td>${h(x.seats)}</td><td>${h(r.b.stato||'')}</td></tr>`}).join('');
    el.innerHTML=`<h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>Lista prenotati / Piantina posti</h2><p><b>${h(report.trip.titolo)}</b> · ${h(asDate(report.trip.data_partenza))} · Autobus ${h(report.bus?.titolo||report.trip.autobus||'Non indicato')}</p><p>Stampa ${h(report.loadedAt.toLocaleString('it-IT'))} · Posti dichiarati nel viaggio: ${h(report.trip.posti_totali)} · Prenotazioni: ${report.rows.length}</p>
      <h2>Piantina ufficiale</h2>${printLayout()}<div class="dg30-p-stops"><h2>Elenco per fermata</h2><table><thead><tr><th>Fermata</th><th>Cliente</th><th>Persone</th><th>Posti</th><th>Stato</th></tr></thead><tbody>${table||'<tr><td colspan="5">Nessuna prenotazione attiva</td></tr>'}</tbody></table></div><p style="font-size:8pt">Documento gestionale riservato. Stampare e conservare secondo le procedure aziendali e la normativa privacy. I dati sono letti in tempo reale e possono cambiare.</p>`;
    document.body.appendChild(el);window.print();notice('Si apre la stampa: su iPhone scegli Stampa e usa la condivisione per salvare come PDF.');
  }
  async function diagnostic(){
    const [fleet,busLayouts,tripLayouts]=await Promise.all([DGData.rows('fleet'),DGData.rows('officialBusLayouts'),DGData.rows('officialTripLayouts')]);
    const buses=fleet.filter(x=>x.categoria==='GT'&&[53,63].includes(Number(x.posti))&&x.attivo);
    const rows=buses.map(b=>`<div class="dg30-tag">${h(b.titolo)} · ${busLayouts.some(x=>String(x.autobus_id)===String(b.id))?'✓ UFFICIALE':'⚠ NON PUBBLICATA'}</div>`).join('');
    const out=document.getElementById('dg30-diagnostic');if(out)out.innerHTML=`<p>${buses.length} autobus GT attivi · ${busLayouts.length} piantine autobus pubblicate · ${tripLayouts.length} varianti/snapshot di viaggio pubblicate.</p>${rows}<p class="dg30-note">Se il sito non mostra i posti aggiornati, verifica pubblicazione, assegnazione autobus, cache del sito e RPC di lettura. Questo modulo non altera prenotazioni o capienze.</p>`;
    notice('Controllo eseguito in sola lettura.');
  }
  function validateAndNormalizeLayout(raw,limit){
    const data=valid(raw?.configurazione)?raw.configurazione:raw;
    if(!valid(data)||!Array.isArray(data.rows)||!data.rows.length||data.rows.length>35)throw Error('File non valido: la bozza deve contenere da 1 a 35 file.');
    const allowed=new Set(['seat','empty','aisle','door','driver','wc','table']);const numbers=[];
    const rows=data.rows.map((row,i)=>{
      const cells=Array.isArray(row)?row:row?.cells;
      if(!Array.isArray(cells)||cells.length!==5)throw Error(`Fila ${i+1}: occorrono esattamente 5 celle.`);
      return {rowNumber:i+1,label:`Fila ${i+1}`,cells:cells.map(c=>{
        const type=String(c?.type||'empty');if(!allowed.has(type))throw Error('Elemento della piantina non riconosciuto: '+type);
        if(type!=='seat')return {type};
        const id=String(c.id??'');if(!/^[1-9]\d{0,2}$/.test(id)||Number(id)>limit)throw Error('Numero del sedile fuori dalla capienza dell’autobus.');
        numbers.push(id);return {type:'seat',id,label:id.padStart(2,'0'),status:['available','blocked','out_of_service'].includes(c.status)?c.status:'available'};
      })};
    });
    if(!numbers.length||numbers.length>limit||new Set(numbers).size!==numbers.length)throw Error('Numeri dei sedili assenti, duplicati o oltre la capienza.');
    if([...numbers].sort((a,b)=>Number(a)-Number(b)).some((x,i)=>Number(x)!==i+1))throw Error('Numerazione incompleta: devono esserci tutti i posti dal n. 1 al n. '+numbers.length+'.');
    const name=String(data.name||raw.name||'Piantina importata').slice(0,90);
    return {version:2,creator:'DELGROSSO-DG30-IMPORT',name,posti_totali:numbers.length,rows};
  }
  async function saveDraft(config){const now=DGData.actor?.id||null;return DGData.insert('dg2_layout_library',{nome:config.name,configurazione:config,attivo:true,created_by:now,updated_by:now})}
  async function draft57(){
    const id=currentBusId();if(!id)throw Error('Seleziona prima l’autobus GT da 63 posti nella libreria sopra.');
    const buses=await DGData.rows('fleet');const bus=buses.find(x=>String(x.id)===String(id));if(!bus||Number(bus.posti)!==63)throw Error('Le bozze da 57 posti sono disponibili solo per i mezzi con 63 posti fisici.');
    const make=window.DGPiantine28?.makeTemplate;if(typeof make!=='function')throw Error('Editor piantine ufficiali non caricato.');
    const conf=make(57,`VARIANTE 57 · ${bus.titolo} · DA VERIFICARE`);
    if(!confirm('Creare la BOZZA da 57 posti? Non sarà pubblicata né modificherà le prenotazioni o la capienza omologata.'))return;
    const rec=await saveDraft(conf);notice('Bozza da 57 posti salvata. Ora aprila dall’elenco «Apri bozza» dell’editor sopra, correggi le posizioni reali e salva.');
    // Il modulo originale ricarica le bozze a ogni rendering: aggiorniamo la pagina lasciando intatti i dati.
    if(typeof loadPage==='function')await loadPage();
    const select=document.getElementById('dg28-library');if(select&&rec?.id){select.value=rec.id;document.querySelector('[data-dg28="load"]')?.click();}
  }
  async function exportDraft(){
    const id=document.getElementById('dg28-library')?.value;if(!id)throw Error('Per esportare, seleziona prima una bozza SALVATA nel menu dell’editor piantine.');
    const drafts=await DGData.rows('layouts');const found=drafts.find(x=>String(x.id)===String(id));if(!found)throw Error('Bozza salvata non trovata.');
    const data={export_version:'DG30',exported_at:new Date().toISOString(),nome:found.nome,configurazione:found.configurazione};
    storeDownload(JSON.stringify(data,null,2),`DELGROSSO_PIANTINA_${cleanFilename(found.nome)}.json`,'application/json;charset=utf-8');notice('Bozza esportata: questo file è un backup locale, NON una piantina pubblicata.');
  }
  async function importDraft(){
    const file=document.getElementById('dg30-import')?.files?.[0];if(!file)throw Error('Scegli un file JSON da importare.');
    if(file.size>300000)throw Error('File troppo grande (massimo 300 KB).');
    const busId=currentBusId();if(!busId)throw Error('Seleziona prima uno degli autobus GT.');
    const buses=await DGData.rows('fleet');const bus=buses.find(x=>String(x.id)===String(busId));if(!bus)throw Error('Autobus selezionato non trovato.');
    let payload;try{payload=JSON.parse(await file.text())}catch{throw Error('Il file non è JSON valido.');}
    const config=validateAndNormalizeLayout(payload,Number(bus.posti));
    config.name=config.name+' · Importata';
    if(!confirm(`Importare come nuova bozza ${config.posti_totali} sedili per ${bus.titolo}? Le piantine ufficiali non saranno modificate.`))return;
    const saved=await saveDraft(config);if(typeof loadPage==='function')await loadPage();
    const select=document.getElementById('dg28-library');if(select&&saved?.id){select.value=saved.id;document.querySelector('[data-dg28="load"]')?.click();}
    notice('Bozza importata e salvata in Supabase; pubblicazione separata e soggetta a controlli.');
  }
  async function handle(action){
    assertAccess();switch(action){
      case 'report':await generateReport();break;
      case 'csv':csv();break;
      case 'print':printReport();break;
      case 'diagnostic':await diagnostic();break;
      case 'draft57':await draft57();break;
      case 'export':await exportDraft();break;
      case 'import':await importDraft();break;
    }
  }
  function init(){
    badge();
    if(typeof renders!=='undefined'&&typeof renders.layouts==='function'&&!renders.layouts.__dg30){
      const original=renders.layouts;
      async function extendedLayouts(...args){const base=await original.apply(this,args);if(typeof isDemo==='function'&&isDemo())return base;return base+panel()}
      extendedLayouts.__dg30=true;renders.layouts=extendedLayouts;
    }
    document.addEventListener('click',async e=>{
      const button=e.target.closest('[data-dg30]');if(!button)return;
      e.preventDefault();if(button.disabled)return;button.disabled=true;
      try{await handle(button.dataset.dg30)}catch(err){notice('Errore: '+err.message,true)}finally{button.disabled=false}
    });
    document.addEventListener('change',e=>{if(e.target?.id==='dg30-trip')report=null});
    // Il contenuto pagina viene creato da loadPage(): osserviamo SOLO l'inserimento del pannello
    // per riempire il selettore dei viaggi, senza alterare le funzioni interne del gestionale.
    const main=document.getElementById('page-content');if(main){let lastPanel=null;
      const observer=new MutationObserver(()=>{const panel=document.getElementById('dg30-operations');if(!panel||panel===lastPanel)return;lastPanel=panel;populateTrips().catch(e=>notice(e.message,true));});
      observer.observe(main,{childList:true,subtree:false});
      if(document.getElementById('dg30-operations'))populateTrips().catch(e=>notice(e.message,true));
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.DG30Manual=Object.freeze({version:VERSION,parseSeatValues,validateAndNormalizeLayout,seatNumbers});
})();
