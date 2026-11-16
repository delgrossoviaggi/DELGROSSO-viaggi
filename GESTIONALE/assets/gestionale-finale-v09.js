/* DELGROSSO VIAGGI 3.0 ULTIMATE Premium v0.9
 * Completamenti non distruttivi: viaggi, clienti, piantine, diagnostica.
 * Ogni scrittura richiede login Supabase, RLS, conferma dell'operatore.
 * Nessun aggiornamento automatico di capienze o posti storici.
 */
'use strict';
(function(){
  const t=x=>esc(x??'');
  const isUuid=x=>/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(String(x||''));
  const action=(verb,id,label)=>`<button type="button" class="btn-secondary" data-dg9-action="${t(verb)}" data-dg9-id="${t(id)}">${t(label)}</button>`;
  const checkInt=(x,min,max,label)=>{const n=Number(x);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' non valido');return n;};
  function noteForDemo(){return isDemo()?cardInfo('ANTEPRIMA: nessuna modifica ai dati. Accedi come Nicola o Raffaele per salvare.', 'warn'):'';}
  function field(label,name,value='',type='text',opts={}){
    const required=opts.required?'required':'';
    return `<label class="field"><span>${t(label)}</span><input name="${t(name)}" type="${t(type)}" value="${t(value)}" ${required} ${opts.min!==undefined?`min="${t(opts.min)}"`:''} ${opts.max!==undefined?`max="${t(opts.max)}"`:''} ${opts.step!==undefined?`step="${t(opts.step)}"`:''}></label>`;
  }
  function textarea(label,name,value=''){
    return `<label class="field"><span>${t(label)}</span><textarea name="${t(name)}" rows="3">${t(value)}</textarea></label>`;
  }
  function formFooter(label){return `<p id="dg9-error" class="auth-error" hidden role="alert"></p>${actFooter(label)}`;}
  async function pageTrips09(){
    const trips=await data('trips'),bookings=await data('bookings');
    return sec('Viaggi e partenze · gestione avanzata','Modifica dati essenziali, duplica un programma e archivia/ripristina senza cancellare le prenotazioni')+noteForDemo()+
      `<div class="action-row"><button type="button" class="btn-secondary" data-create="trip">＋ Nuovo viaggio</button></div>`+
      mainPanel(`Registro viaggi · ${trips.length}`,table(trips,[
        ['DATA',x=>fmtDate(x.data_partenza)],['VIAGGIO',x=>t(x.titolo||x.destinazione)],
        ['BUS',x=>t(x.autobus)],['PAX',x=>t(x.posti_totali)],
        ['PRENOTATI',x=>bookings.filter(b=>b.viaggio_id===x.id&&allActive(b)).reduce((a,b)=>a+Number(b.posti||0),0)],
        ['STATO',x=>status(x.archiviato_at?'Archiviato':x.stato)],
        ['GESTIONE',x=>isDemo()?'—':[action('trip-edit',x.id,'✎ Modifica'),action('trip-clone',x.id,'Duplica'),action('trip-archive',x.id,x.archiviato_at?'Ripristina':'Archivia')].join(' ')]
      ]))+
      cardInfo('Archiviazione = non pubblica il viaggio e conserva prenotazioni, incassi e storico. Il BUS BIS collegato può essere archiviato insieme al viaggio principale.', 'info')+
      cardInfo('Non modificare manualmente capienza, mezzi o numerazione dei posti: richiedono verifica di omologazione, assegnazioni e piantina. Cambiare la data con prenotazioni esistenti richiede una procedura dedicata.', 'warn');
  }
  async function openTrip(id,clone=false){
    requireLive();const trips=await data('trips'),booking=await data('bookings');const item=trips.find(x=>x.id===id);
    if(!item)throw Error('Viaggio non trovato. Ricarica i dati.');
    const occupied=booking.filter(x=>x.viaggio_id===id&&allActive(x)).reduce((n,b)=>n+Number(b.posti||0),0);
    const prefix=clone?'Duplica come nuovo viaggio NON pubblicato':'Modifica viaggio esistente';
    modal(prefix,`<form id="dg9-trip-form" data-id="${t(id)}" data-clone="${clone?'1':'0'}" data-occupied="${occupied}">
      <div class="form-grid">
        ${field('Titolo', 'titolo',item.titolo,'text',{required:true})}
        ${field('Destinazione','destinazione',item.destinazione,'text',{required:true})}
        ${field('Data partenza','data_partenza',clone?'':item.data_partenza,'date',{required:true})}
        ${field('Ora partenza','ora_partenza',item.ora_partenza||'06:00','time',{required:true})}
        ${field('Luogo / fermata principale','luogo_partenza',item.luogo_partenza||'')}
        ${field('Prezzo a persona (€)','prezzo',item.prezzo??0,'number',{required:true,min:0,step:'0.01'})}
        ${field('Minimo partecipanti','minimo_partecipanti',item.minimo_partecipanti||40,'number',{required:true,min:1,max:100,step:1})}
        ${textarea('Descrizione e note del viaggio','descrizione',item.descrizione||'')}
      </div>
      <p class="small-note">${clone?'Verrà generato un viaggio nuovo, senza prenotazioni e senza pubblicazione. Controlla la disponibilità dell’autobus prima di renderlo visibile sul sito.':occupied+' posti già prenotati. Data, destinazione, prezzo e comunicazione ai partecipanti devono essere controllati; la capienza e il bus restano invariati.'}</p>
      ${formFooter(clone?'Duplica viaggio':'Salva modifiche')}
      </form>`);
  }
  async function saveTrip(form){requireLive();const id=form.dataset.id,clone=form.dataset.clone==='1',trips=await data('trips'),old=trips.find(x=>x.id===id);if(!old)throw Error('Viaggio non trovato');
    const v=Object.fromEntries(new FormData(form)),title=String(v.titolo||'').trim(),destination=String(v.destinazione||'').trim();
    if(!title||!destination||!/^\d{4}-\d{2}-\d{2}$/.test(v.data_partenza))throw Error('Titolo, destinazione e data obbligatori');
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.ora_partenza))throw Error('Orario non valido');
    const min=checkInt(v.minimo_partecipanti,1,100,'Minimo partecipanti');const price=Number(v.prezzo);
    if(!Number.isFinite(price)||price<0||price>100000)throw Error('Prezzo non valido');
    const rows=(await data('bookings')).filter(b=>b.viaggio_id===id&&allActive(b));
    if(!clone&&rows.length&&(v.data_partenza!==old.data_partenza||destination!==old.destinazione))
      throw Error('Data o destinazione non possono essere cambiate su un viaggio con prenotazioni attive. Usa lo spostamento prenotazioni controllato.');
    if(!clone&&old.archiviato_at)throw Error('Ripristina il viaggio prima di modificarlo');
    const patch={titolo:title,destinazione:destination,data_partenza:v.data_partenza,ora_partenza:v.ora_partenza,prezzo:Math.round(price*100)/100,
      luogo_partenza:v.luogo_partenza||null,minimo_partecipanti:min,descrizione:v.descrizione||null};
    if(!confirm(`${clone?'CREARE UNA COPIA NON PUBBLICATA':'SALVARE LE MODIFICHE DEL VIAGGIO'}?\n${title} · ${v.data_partenza}\nNessuna prenotazione o pagamento sarà duplicato.`))return;
    if(clone){await DGData.insert('viaggi',{...patch,autobus_id:old.autobus_id,autobus:old.autobus,posti_totali:old.posti_totali,posti_liberi:old.posti_totali,posti_occupati:0,stato:'Programmato',pubblicato:'NO'});}
    else await DGData.update('viaggi',id,patch);
    delete cache.trips;closeModal();toast(clone?'Viaggio duplicato senza prenotati':'Viaggio modificato');go('trips');
  }
  async function archiveTrip(id){requireLive();if(!isUuid(id))throw Error('Riferimento viaggio non valido');const trips=await data('trips'),r=trips.find(x=>x.id===id);if(!r)throw Error('Viaggio non trovato');const toArchive=!r.archiviato_at;
    if(!confirm(`${toArchive?'ARCHIVIARE':'RIPRISTINARE'} IL VIAGGIO?\n${r.titolo||r.destinazione} · ${r.data_partenza}\nL’operazione include eventuali BUS BIS collegati. Un viaggio archiviato non sarà pubblicato; prenotazioni e incassi non saranno cancellati.`))return;
    const result=await DGData.rpc('dg_archive_trip_v56',{p_viaggio_id:id,p_archivia:toArchive});
    if(result?.archiviato!==toArchive)throw Error('Risposta di archiviazione non confermata');delete cache.trips;toast('Viaggio aggiornato');go('trips');
  }
  async function clients09(){const customers=await data('customers'),bookings=await data('bookings');
    return sec('Clienti CRM · anagrafiche e modifiche','Consulta, crea o modifica anagrafiche senza sovrascrivere lo storico dei viaggi')+noteForDemo()+
      `<div class="action-row"><button class="btn-secondary" type="button" data-create="customer">＋ Nuovo cliente</button></div>`+
      mainPanel(`Anagrafiche · ${customers.length}`,table(customers,[['NOMINATIVO',r=>t([r.nome,r.cognome].join(' '))],['TELEFONO',r=>t(r.telefono)],['EMAIL',r=>t(r.email)],['PRENOTAZIONI INDICATIVE',r=>bookings.filter(b=>r.telefono&&String(b.telefono||'').replace(/\D/g,'')===String(r.telefono||'').replace(/\D/g,'')).length],['AZIONI',r=>isDemo()?'—':action('customer-edit',r.id,'✎ Modifica')+' '+`<button type="button" class="btn-secondary" data-action="client-detail" data-id="${t(r.id)}">Storico</button>`]]))+
      cardInfo('Le corrispondenze delle prenotazioni per telefono sono indicative e possono includere recapiti condivisi: l’associazione anagrafica va verificata.','info');
  }
  async function openCustomer(id){requireLive();const list=await data('customers'),r=list.find(x=>x.id===id);if(!r)throw Error('Cliente non trovato');
    modal('Modifica anagrafica cliente',`<form id="dg9-customer-form" data-id="${t(id)}"><div class="form-grid">
      ${field('Nome','nome',r.nome,'text',{required:true})}${field('Cognome','cognome',r.cognome,'text',{required:true})}
      ${field('Telefono','telefono',r.telefono,'tel')}${field('Email','email',r.email,'email')}
    </div><p class="small-note">Le vecchie ricevute e le prenotazioni restano immutate: questa è una modifica della sola anagrafica.</p>${formFooter('Salva anagrafica')}</form>`);
  }
  async function saveCustomer(form){requireLive();const v=Object.fromEntries(new FormData(form));if(!String(v.nome||'').trim()||!String(v.cognome||'').trim())throw Error('Nome e cognome obbligatori');
    if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw Error('Indirizzo email non valido');
    if(!confirm('Aggiornare esclusivamente la scheda anagrafica del cliente?'))return;
    await DGData.update('clienti',form.dataset.id,{nome:v.nome.trim(),cognome:v.cognome.trim(),telefono:v.telefono||null,email:v.email||null});
    delete cache.customers;closeModal();toast('Anagrafica aggiornata');go('customers');
  }
  function layoutRows(total,perRow){const rows=[],sections=[];let next=1;while(next<=total){const row=[];
      for(let i=0;i<perRow&&next<=total;i++){if(i===Math.ceil(perRow/2))row.push('aisle');row.push(next++);}rows.push(row);sections.push(row.filter(Number.isInteger));}
    return {rows,sections};
  }
  async function pageLayouts09(){const trips=await data('trips');let layouts=[];let problem='';try{const loaded=await data('layouts');layouts=Array.isArray(loaded)?loaded:[]}catch(err){problem=err.message;}
    return sec('Libreria piantine · numerazione automatica','Crea, salva, modifica e archivia modelli; non cambia automaticamente i posti dei viaggi esistenti')+noteForDemo()+
      `<div class="action-row">${action('layout-new','','＋ Crea piantina')}${action('layout-export','','⇩ Esporta indice CSV')}</div>`+
      (problem?cardInfo(problem,'warn'):mainPanel(`Libreria modelli · ${layouts.length}`,table(layouts,[['NOME',r=>t(r.nome)],['POSTI',r=>t(r.configurazione?.posti_totali||r.configurazione?.totalSeats||'—')],['STATO',r=>status(r.attivo?'Attiva':'Archiviata')],['AZIONI',r=>isDemo()?'—':action('layout-edit',r.id,'✎ Modifica')+' '+action('layout-archive',r.id,r.attivo?'Archivia':'Riattiva')]])))+
      mainPanel('Capienza delle piantine in uso',table(trips,[['VIAGGIO',r=>t(r.titolo||r.destinazione)],['DATA',r=>t(r.data_partenza)],['POSTI',r=>t(r.posti_totali)],['APRI',r=>`<button type="button" class="btn-secondary" data-go="control" data-trip="${t(r.id)}">Control Room</button>`]]))+
      cardInfo('Una nuova piantina è una PROPOSTA: per assegnarla a un autobus già in servizio serve la verifica dell’omologazione e dei posti già prenotati. Nessuna capienza aziendale viene alterata da questa funzione.','warn');
  }
  async function openLayout(id=''){requireLive();const items=await data('layouts');const item=id?items.find(x=>x.id===id):null;if(id&&!item)throw Error('Piantina non trovata');
    const conf=item?.configurazione||{};
    modal(id?'Modifica piantina della libreria':'Nuova piantina · numerazione automatica',`<form id="dg9-layout-form" data-id="${t(id)}"><div class="form-grid">
      ${field('Nome del modello','nome',item?.nome||'','text',{required:true})}
      ${field('Numero posti','posti',conf.posti_totali||conf.totalSeats||53,'number',{required:true,min:1,max:100,step:1})}
      ${field('Posti per fila','per_fila',conf.posti_per_fila||4,'number',{required:true,min:2,max:5,step:1})}
      </div><p class="small-note">Genera sequenzialmente le etichette. La geometria illustrativa non determina l’omologazione del mezzo.</p>${formFooter(id?'Salva modifica piantina':'Salva nuova piantina')}</form>`);
  }
  async function saveLayout(form){requireLive();const v=Object.fromEntries(new FormData(form)),name=String(v.nome||'').trim();if(name.length<3||name.length>100)throw Error('Nome piantina da 3 a 100 caratteri');
    const count=checkInt(v.posti,1,100,'Numero posti'),per=checkInt(v.per_fila,2,5,'Posti per fila');const rows=layoutRows(count,per);
    const conf={version:1,creator:'dg3-ultimate-v09',posti_totali:count,totalSeats:count,posti_per_fila:per,rows:rows.rows,file:rows.sections,disposizione:'BOZZA_DA_VERIFICARE'};
    if(!confirm(`${form.dataset.id?'MODIFICARE':'CREARE'} IL MODELLO?\n${name} · ${count} posti\nIl salvataggio non cambia i viaggi, le capienze o i posti dei clienti.`))return;
    if(form.dataset.id)await DGData.update('dg2_layout_library',form.dataset.id,{nome:name,configurazione:conf,updated_by:DGData.actor?.id});
    else await DGData.insert('dg2_layout_library',{nome:name,configurazione:conf,attivo:true,created_by:DGData.actor?.id,updated_by:DGData.actor?.id});
    delete cache.layouts;closeModal();toast('Modello piantina salvato nella libreria');go('layouts');
  }
  async function archiveLayout(id){requireLive();const rows=await data('layouts'),r=rows.find(x=>x.id===id);if(!r)throw Error('Modello non trovato');
    if(!confirm(`${r.attivo?'Archiviare':'Riattivare'} il modello «${r.nome}»? Le piantine dei viaggi esistenti non verranno modificate.`))return;
    await DGData.update('dg2_layout_library',id,{attivo:!r.attivo,updated_by:DGData.actor?.id});delete cache.layouts;toast('Stato del modello aggiornato');go('layouts');
  }
  async function exportLayouts(){requireLive();const rows=await data('layouts');DGData.downloadCSV([['NOME','POSTI','PER_FILA','ATTIVO','ULTIMO_AGGIORNAMENTO'],...rows.map(x=>[x.nome,x.configurazione?.posti_totali,x.configurazione?.posti_per_fila,x.attivo?'SI':'NO',x.updated_at])],'DELGROSSO_LIBRARY_PIANTINE.csv');}
  const CHECKS=[['trips','Viaggi'],['bookings','Prenotazioni'],['seatrows','Assegnazioni sedili'],['fleet','Flotta'],['customers','Clienti'],['payments','Pagamenti'],['rentals','Noleggi'],['quotes','Preventivi'],['deadlines','Agenda'],['documents','Documenti'],['layouts','Libreria piantine'],['notifications','Notifiche'],['transfers','Trasferimenti cassa'],['invoices','Bozze fatture'],['drivers','Autisti'],['anomalyCases','Anomalie'],['waManual','WhatsApp manuale'],['appSettings','Impostazioni']];
  const BACKEND_RPC_CHECKS=[
    ['dg11_anteprima_cassa_v1','Anteprima chiusura cassa'],
    ['dg11_chiudi_cassa_v1','Conferma chiusura cassa'],
    ['dg11_incasso_extra_v1','Incasso extra contanti'],
    ['dg11_salva_costo_viaggio_v1','Costi viaggio transazionali'],
    ['dg3_preview_spostamento_data_v1','Anteprima cambio data'],
    ['dg3_sposta_prenotazione_data_v1','Cambio data con nuovi posti']
  ];
  let diagResults=null;
  async function diagRun(){requireLive();diagResults=[];for(const [key,name] of CHECKS){try{const probe=await DGData.probe(key);diagResults.push({name,key,ok:true,info:probe.hasVisibleRow?'SELECT autenticata riuscita · almeno una riga visibile':'SELECT autenticata riuscita · nessuna riga visibile (o filtrata da RLS)'});}catch(e){diagResults.push({name,key,ok:false,info:e.status===404?'Manca migrazione / tabella':(e.status===401||e.status===403)?'Autorizzazione RLS da verificare':String(e.message||'Errore').slice(0,180)});}}
    try{const me=await DGData.verifyCurrentOperator();diagResults.unshift({key:'auth',name:'Identità Supabase / RLS',ok:me.ok,info:'Accesso autorizzato: '+me.operator});}
    catch(e){diagResults.unshift({key:'auth',name:'Identità Supabase / RLS',ok:false,info:e.message});}
    const session=DGData.health();
    diagResults.push({key:'realtime',name:'Postgres Realtime',ok:session.realtimeStatus==='connesso',info:session.realtimeStatus==='connesso'?'Canale WebSocket attivo; eventi non verificati con una scrittura reale':'WebSocket '+session.realtimeStatus+'; recupero periodico REST disponibile'});
    // Il controllo RPC è rigorosamente di sola lettura: non invoca funzioni che scrivono denaro o prenotazioni.
    try{
      const caps=await DGData.rpc('dg3_diagnostica_backend_v1',{});
      for(const [key,name] of BACKEND_RPC_CHECKS){
        diagResults.push({key,name,ok:caps?.[key]===true,info:caps?.[key]===true?'Funzione SQL presente · scrittura NON collaudata':'Funzione SQL non rilevata'});
      }
    }catch(e){
      for(const [key,name] of BACKEND_RPC_CHECKS){
        diagResults.push({key,name,ok:false,info:'Controllo diagnostico non disponibile: '+String(e.message||'Errore').slice(0,100)});
      }
    }
    toast('Diagnostica completata');go('diagnostics');
  }
  async function diagnosticsPage(){
    const rows=diagResults||CHECKS.map(([key,name])=>({key,name,ok:null,info:'Non verificato'}));
    const passed=rows.filter(x=>x.ok).length,failed=rows.filter(x=>x.ok===false).length;
    return sec('Centro diagnostica · attivazioni Supabase','Verifica SELECT autenticata, identità dell’operatore e stato Realtime; non modifica prenotazioni o contabilità')+noteForDemo()+
      `<div class="action-row">${action('run-diagnostics','','↻ Esegui diagnosi completa')}${action('download-diagnostics','','⇩ Rapporto CSV')}</div>`+
      `<div class="metric-belt"><div class="mini-metric"><strong>${passed}</strong><span>Moduli raggiungibili</span></div><div class="mini-metric"><strong>${failed}</strong><span>Moduli da verificare</span></div></div>`+
      mainPanel('Verifica archivi e funzioni Supabase',table(rows,[['MODULO',r=>t(r.name)],['ESITO',r=>status(r.ok===null?'Da verificare':r.ok?'Raggiungibile':'Non pronto')],['DETTAGLIO',r=>t(r.info)]]))+
      cardInfo('Le SELECT e la presenza delle RPC NON certificano prenotazioni, incassi o pagamenti. Per la sincronizzazione completa servono test reali, controllati e riconciliazione contabile con Nicola/Raffaele.', 'warn')+
      cardInfo('Fatture SdI: non attive senza provider e dati fiscali certificati. WhatsApp API: non attiva senza account Meta e consensi. Queste integrazioni non si possono rendere operative con un semplice file HTML.', 'info');
  }
  async function downloadDiag(){if(!diagResults||!diagResults.length)throw Error('Esegui prima la diagnostica');DGData.downloadCSV([['MODULO','TABELLA / RPC','ESITO','NOTE'],...diagResults.map(x=>[x.name,x.key,x.ok?'OK':'DA_VERIFICARE',x.info])],'DELGROSSO_DIAGNOSTICA_MODULI.csv');}
  // Nelle versioni 0.9 le schermate aggiuntive sostituiscono solo il modulo specifico,
  // mantenendo intatti i registri cassa, RPC posti, SdI in bozza e WhatsApp ibrido v0.8.
  NAV[NAV.length-1][1].push(['diagnostics','✺','Diagnostica integrazioni']);
  renders.trips=pageTrips09;
  renders.customers=clients09;
  renders.layouts=pageLayouts09;
  renders.diagnostics=diagnosticsPage;
  document.addEventListener('click',async ev=>{
    const el=ev.target.closest('[data-dg9-action]');if(!el)return;
    const verb=el.dataset.dg9Action,id=el.dataset.dg9Id||'';el.disabled=true;
    try{
      if(verb==='trip-edit')await openTrip(id);
      else if(verb==='trip-clone')await openTrip(id,true);
      else if(verb==='trip-archive')await archiveTrip(id);
      else if(verb==='customer-edit')await openCustomer(id);
      else if(verb==='layout-new')await openLayout();
      else if(verb==='layout-edit')await openLayout(id);
      else if(verb==='layout-archive')await archiveLayout(id);
      else if(verb==='layout-export')await exportLayouts();
      else if(verb==='run-diagnostics')await diagRun();
      else if(verb==='download-diagnostics')await downloadDiag();
    }catch(e){toast('Operazione non conclusa: '+e.message)}finally{el.disabled=false;}
  });
  document.addEventListener('submit',async ev=>{
    const form=ev.target,keys=['dg9-trip-form','dg9-customer-form','dg9-layout-form'];if(!keys.includes(form.id))return;
    ev.preventDefault();ev.stopImmediatePropagation();const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
    try{if(form.id==='dg9-trip-form')await saveTrip(form);
      else if(form.id==='dg9-customer-form')await saveCustomer(form);
      else await saveLayout(form);
    }catch(e){const box=form.querySelector('#dg9-error');if(box){box.hidden=false;box.textContent=e.message;}else toast(e.message);}finally{if(submit)submit.disabled=false;}
  });
  window.DGFinal09=Object.freeze({layoutRows,checkInt,featureCount:CHECKS.length});
})();
