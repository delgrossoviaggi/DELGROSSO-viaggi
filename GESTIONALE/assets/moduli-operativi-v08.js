/* DELGROSSO VIAGGI 3.0 Ultimate Premium — v0.8
 * Moduli amministrativi: operazioni consentite da RLS Supabase, niente Python.
 * Nessun dato reale viene scritto in demo. Ogni scrittura richiede conferma esplicita.
 * La fatturazione fiscale SdI NON e' attiva. I registri di cassa sono immutabili.
 */
'use strict';
(function(){
  const defs={
    rentals:{title:'Noleggi autobus · gestione completa',data:'rentals',table:'noleggi_bus',fields:[
      ['referente','Referente','text',false],['azienda','Azienda / organizzazione'],['telefono','Telefono','tel'],['email','Email','email'],
      ['tratta_partenza','Luogo partenza','text',true],['tratta_destinazione','Destinazione','text',true],['fermate','Fermate intermedie'],
      ['data_partenza','Data partenza','date',true],['ora_partenza','Ora partenza','time'],['data_ritorno','Data rientro','date'],['ora_ritorno','Ora rientro','time'],
      ['passeggeri','Numero passeggeri','number',true],['servizio_tipo','Tipo servizio','select',true,['Andata e ritorno','Solo andata','A disposizione','Viaggio DELGROSSO VIAGGI']],
      ['prezzo_concordato','Prezzo pattuito (€)','number',true],['stato_noleggio','Stato noleggio','select',true,['Richiesto','Confermato','In corso','Completato','Annullato']],
      ['note','Note operative','textarea']
    ],cols:[['DATA','data_partenza'],['REFERENTE','referente'],['TRATTA',r=>[r.tratta_partenza,r.tratta_destinazione].join(' → ')],['PASSEGGERI','passeggeri'],['PREZZO',r=>euro(r.prezzo_concordato)],['INCASSATO',r=>euro(r.acconto)],['STATO','stato_noleggio']],archive:true},
    quotes:{title:'Preventivi · gestione commerciale',data:'quotes',table:'preventivi',fields:[
      ['nome','Nome cliente','text',true],['cognome','Cognome'],['azienda','Azienda'],['telefono','Telefono','tel',true],['email','Email','email'],
      ['luogo_partenza','Luogo partenza'],['destinazione','Destinazione','text',true],['data_viaggio','Data del viaggio','date'],['data_ritorno','Data ritorno','date'],
      ['numero_passeggeri','Passeggeri','number',true],['servizio','Tipo servizio','select',false,['Gran Turismo','Limousine Bus','Navetta Eventi','Viaggio di Gruppo']],
      ['importo_preventivo','Prezzo offerto (€)','number',true],['validita_preventivo','Validità offerta (data)','date'],
      ['stato','Stato preventivo','select',true,['Nuovo','In Lavorazione','Inviato','Accettato','Rifiutato','Convertito','Annullato']],
      ['condizioni_offerta','Condizioni dell’offerta','textarea'],['note_interne','Note interne','textarea']
    ],cols:[['DATA','data_viaggio'],['CLIENTE',r=>[r.nome,r.cognome].filter(Boolean).join(' ')||r.azienda],['DESTINAZIONE','destinazione'],['PAX','numero_passeggeri'],['OFFERTA',r=>euro(r.importo_preventivo)],['STATO','stato']],archive:false},
    deadlines:{title:'Agenda e scadenze',data:'deadlines',table:'scadenze_gestionale',fields:[
      ['titolo','Attività / titolo','text',true],['descrizione','Descrizione','textarea'],['tipo','Tipo','select',true,['Generale','Viaggio','Cliente','Pagamento','Flotta','Documento','Manutenzione']],
      ['priorita','Priorità','select',true,['Bassa','Media','Alta','Urgente']],['data_scadenza','Scadenza','date',true],
      ['stato','Stato','select',true,['aperta','in corso','completata','annullata']],['importo','Importo di riferimento (€)','number'],['note','Note','textarea']
    ],cols:[['SCADENZA','data_scadenza'],['ATTIVITÀ','titolo'],['PRIORITÀ','priorita'],['STATO','stato'],['IMPORTO',r=>r.importo==null?'—':euro(r.importo)]],archive:false},
    drivers:{title:'Autisti · rubrica interna',data:'drivers',table:'dg3_autisti',migration:true,fields:[
      ['nome','Nome','text',true],['cognome','Cognome','text',true],['telefono','Telefono','tel'],['email','Email','email'],
      ['patente_scadenza','Scadenza patente','date'],['cqc_scadenza','Scadenza CQC','date'],
      ['stato','Stato','select',true,['Disponibile','In servizio','Inattivo']],['note','Note / abilitazioni','textarea']
    ],cols:[['NOME',r=>[r.nome,r.cognome].join(' ')],['TELEFONO','telefono'],['PATENTE','patente_scadenza'],['CQC','cqc_scadenza'],['STATO','stato']],archive:true},
    notifications:{title:'Centro notifiche',data:'notifications',table:'notifiche',fields:[
      ['titolo','Titolo notifica','text',true],['messaggio','Messaggio','textarea',true],['tipo','Categoria','select',true,['Informazione','Operativa','Prenotazione','Pagamento','Viaggio','Avviso']]
    ],cols:[['DATA','created_at'],['TITOLO','titolo'],['MESSAGGIO','messaggio'],['TIPO','tipo']],archive:false},
    documents:{title:'Documenti e PDF aziendali',data:'documents',table:'documenti_gestionali',fields:[
      ['titolo','Titolo del documento','text',true],['categoria','Categoria','select',true,['Altro','Prenotazioni','Clienti','Noleggi','Flotta','Contratti','Fatture','Ricevute']],
      ['descrizione','Descrizione','textarea'],['scadenza','Scadenza (se presente)','date'],['note','Note riservate','textarea']
    ],cols:[['DATA','created_at'],['TITOLO','titolo'],['CATEGORIA','categoria'],['SCADENZA','scadenza'],['FILE',r=>r.storage_path?'Documento privato':'Senza allegato']],archive:false}
  };
  const entityByPage={rentals:'rentals',quotes:'quotes',agenda:'deadlines',tasks:'deadlines',drivers:'drivers',notifications:'notifications',documents:'documents'};
  const txt=(x)=>esc(x??'');
  const inline=(v)=>String(v??'').trim();
  const isDate=k=>/(^data_|_scadenza$|^scadenza$)/.test(k);
  const numFields=new Set(['passeggeri','prezzo_concordato','numero_passeggeri','importo_preventivo','importo']);
  const idOkay=v=>/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(String(v||''));
  const action=(verb,id,label)=>`<button type="button" class="btn-secondary" data-dg8-action="${txt(verb)}" data-dg8-id="${txt(id||'')}">${txt(label)}</button>`;
  const bar=(btns)=>`<div class="action-row">${btns.join(' ')}</div>`;
  const liveNotice=()=>isDemo()?cardInfo('ANTEPRIMA: i dati sono fittizi. Per salvare accedi come Nicola o Raffaele.', 'warn'):'';
  const safeKey=k=>Object.hasOwn(defs,k)?defs[k]:null;
  async function listing(key){
    if(isDemo()){if(key==='rentals')return [{id:'demo-rental',referente:'Cliente demo',tratta_partenza:'San Severo',tratta_destinazione:'Napoli',data_partenza:'2026-12-15',passeggeri:40,prezzo_concordato:500,stato_noleggio:'Richiesto'}];
      if(key==='deadlines')return [{id:'demo-task',titolo:'Conferma posti demo',data_scadenza:'2026-12-03',stato:'aperta',priorita:'Alta'}];
      return [];}
    try{return await DGData.rows(key)}catch(err){if(/relation .* does not exist|schema cache|could not find the table|PGRST205|42P01/i.test(err.message||''))throw Error('Tabella non ancora installata in Supabase. Occorre la migrazione 0.8 in staging, poi l’attivazione autorizzata.');throw err;}
  }
  function fMarkup(f,value){let [key,label,type='text',required=false,options]=f;let x=value??'';
    if(type==='select'){const opts=[['','— Seleziona —'],...(options||[]).map(v=>[v,v])];return `<label class="field"><span>${txt(label)}</span><select name="${txt(key)}" ${required?'required':''}>${opts.map(([v,t])=>`<option value="${txt(v)}" ${String(v)===String(x)?'selected':''}>${txt(t)}</option>`).join('')}</select></label>`;}
    if(type==='textarea')return `<label class="field"><span>${txt(label)}</span><textarea name="${txt(key)}" rows="3" ${required?'required':''}>${txt(x)}</textarea></label>`;
    return `<label class="field"><span>${txt(label)}</span><input name="${txt(key)}" type="${txt(type)}" ${required?'required':''} ${type==='number'?(numFields.has(key)&&['passeggeri','numero_passeggeri'].includes(key)?'step="1" min="1"':'step="0.01" min="0"'):''} value="${txt(x)}"></label>`;
  }
  function buildRecord(fields,form){const formData=new FormData(form),v={};for(const f of fields){const [key,,type='text',required=false]=f;let raw=inline(formData.get(key));if(required&&!raw)throw Error('Compila il campo obbligatorio: '+f[1]);
    if(!raw){v[key]=null;continue;}if(type==='number'){const n=Number(raw.replace(',','.'));if(!Number.isFinite(n)||n<0)throw Error('Importo o quantità non validi: '+f[1]);if(['passeggeri','numero_passeggeri'].includes(key)&&!Number.isSafeInteger(n))throw Error('Numero di persone non valido');v[key]=n;}
    else if(type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw Error('Data non valida: '+f[1]);else v[key]=raw;}
    return v;}
  function showForm(entity,row){const spec=safeKey(entity);if(!spec)throw Error('Modulo non previsto');requireLive();
    const id=row?.id||'',title=id?'Modifica · '+spec.title:'Nuovo · '+spec.title;
    const main=spec.fields.map(f=>fMarkup(f,row?.[f[0]])).join('');
    const fleetSelect=(entity==='rentals'?`<label class="field"><span>Autobus assegnati (Ctrl+clic per più mezzi; selezione vuota per nessun mezzo)</span><select name="vehicles" multiple size="5">${(cache.dg8fleet||[]).filter(f=>f.attivo).map(f=>`<option value="${txt(f.id)}" ${(row?._vehicles||[]).includes(f.id)?'selected':''}>${txt(f.titolo||f.modello)} · ${txt(f.posti)} posti</option>`).join('')}</select></label>`:'');
    const upload=(entity==='documents'?`<label class="field"><span>${id?'Nuovo allegato facoltativo (il precedente rimane archiviato)':'Allegato facoltativo'} · PDF/JPG/PNG (max 12 MB)</span><input type="file" name="attachment" accept="application/pdf,image/jpeg,image/png"></label>`:'');
    modal(title,`<form id="dg8-form" data-entity="${txt(entity)}" data-record-id="${txt(id)}"><div class="form-grid">${main}${fleetSelect}${upload}</div><p class="auth-error" id="dg8-form-error" hidden role="alert"></p>${actFooter(id?'Salva modifiche':'Crea record')}</form>`);
  }
  async function openEntityForm(entity,id){const spec=safeKey(entity);if(!spec)throw Error('Modulo non previsto');let row=null;
    if(id){row=(await listing(spec.data)).find(x=>x.id===id);if(!row)throw Error('Record non trovato: aggiorna la pagina');}
    if(entity==='rentals'){
      const [fleet,links]=await Promise.all([listing('fleet'),listing('rentalVehicles')]);
      cache.dg8fleet=fleet.filter(f=>!String(f.titolo||'').toLowerCase().includes('mercedes'));
      if(row)row={...row,_vehicles:links.filter(x=>x.noleggio_id===row.id).map(x=>x.flotta_id)};
    }
    showForm(entity,row);
  }
  function docsFile(row){return row.storage_path?`<button type="button" class="btn-secondary" data-storage-bucket="${txt(row.storage_bucket||'gestionale-documenti')}" data-storage-path="${txt(row.storage_path)}">Scarica</button>`:'—';}
  async function renderCrud(entity){const spec=safeKey(entity),title=entity==='deadlines'&&page==='agenda'?'Agenda aziendale':spec.title;
    let rows;try{rows=await listing(spec.data)}catch(err){return sec(title)+liveNotice()+cardInfo(err.message,'warn');}
    rows=[...rows].sort((a,b)=>String(b.data_partenza||b.data_scadenza||b.data_viaggio||b.created_at||'').localeCompare(String(a.data_partenza||a.data_scadenza||a.data_viaggio||a.created_at||'')));
    const actions=(r)=>{
      if(isDemo())return 'Demo';
      let buttons=[action('edit:'+entity,r.id,'✎ Modifica')];
      if(entity==='rentals')buttons.push(action('rental-payment',r.id,'＋ Incasso / rimborso'),action('archive-rental',r.id,r.archiviato_at?'Ripristina':'Archivia'));
      if(entity==='drivers')buttons.push(action('archive-driver',r.id,r.archiviato_at?'Riattiva':'Archivia'));
      if(entity==='deadlines'&&!/completata|annullata/i.test(r.stato||''))buttons.push(action('finish-task',r.id,'Completa'));
      if(entity==='quotes')buttons.push(action('quote-print',r.id,'PDF / Stampa'));
      if(entity==='documents')buttons.push(docsFile(r));
      if(entity==='notifications')buttons.push(action('read-notice',r.id,'Letta'));
      return buttons.join(' ');
    };
    const current=spec.cols.map(([title,key])=>[title,typeof key==='function'?r=>txt(key(r)):r=>txt(isDate(key)?(r[key]||'—'):(r[key]??'—'))]);
    const ready=bar([action('new:'+entity,'','＋ '+(entity==='rentals'?'Nuovo noleggio':entity==='quotes'?'Nuovo preventivo':entity==='deadlines'?'Nuova attività':entity==='documents'?'Carica documento':entity==='drivers'?'Nuovo autista':'Nuova notifica'))]);
    return sec(title,`Archivio Supabase · ${rows.length} record`)+liveNotice()+ready+
      mainPanel('Registro '+title.toLocaleLowerCase('it'),table(rows,[...current,['AZIONI',actions]]))+
      (entity==='notifications'?cardInfo('Il contrassegno di lettura è personale: una notifica letta da Nicola resta visibile a Raffaele.','info'):'')+
      (entity==='drivers'?cardInfo('Solo rubrica e scadenze interne: l’accesso autista non è attivo e non sono creati account di login.','info'):'');
  }
  async function saveEntity(form){requireLive();const entity=form.dataset.entity,id=form.dataset.recordId,spec=safeKey(entity);if(!spec)throw Error('Modulo non consentito');
    const record=buildRecord(spec.fields,form);
    if(entity==='rentals'&&!inline(record.referente)&&!inline(record.azienda))throw Error('Inserisci un referente oppure una azienda per il noleggio');
    if(entity==='quotes')record.importo=record.importo_preventivo;
    if(entity==='rentals'&&record.data_ritorno&&record.data_ritorno<record.data_partenza)throw Error('Rientro prima della partenza');
    if(entity==='rentals'&&record.stato_noleggio==='Confermato'&&!form.elements.vehicles.selectedOptions.length)throw Error('Per confermare serve un autobus assegnato');
    if(!window.confirm(`${id?'MODIFICARE':'CREARE'} IL RECORD?\n${entity.toUpperCase()}\n${record.titolo||record.referente||record.nome||''}\nLa modifica sarà salvata su Supabase con la tua identità.`))return;
    if(entity==='rentals'){
      const key=id||crypto.randomUUID(),vehicles=[...form.elements.vehicles.selectedOptions].map(o=>o.value).filter(Boolean),result=await DGData.rpc('dg_save_rental_v15',{p_id:key,p_data:record,p_vehicle_ids:vehicles});
      if(result?.ok!==true)throw Error('Supabase non ha confermato il salvataggio del noleggio');
    }else if(entity==='documents'){
      const file=form.elements.attachment?.files?.[0];let uploaded=null;
      if(file)uploaded=await DGData.uploadPrivateFile(file,record.categoria);
      const meta={...record,...(uploaded?{storage_bucket:'gestionale-documenti',storage_path:uploaded.path,mime_type:uploaded.mime,dimensione:uploaded.size}:(!id?{storage_bucket:'gestionale-documenti',storage_path:null}:{}))};
      try{
        if(id)await DGData.update(spec.table,id,meta);else await DGData.insert(spec.table,meta);
      }catch(err){if(uploaded){try{await DGData.removePendingUpload(uploaded.path)}catch(cleanErr){throw Error(err.message+'; ATTENZIONE: nuovo file da pulire manualmente: '+uploaded.path+' · '+cleanErr.message)}}throw err;}
      // Mai rimuovere automaticamente l'allegato precedente: serve la tracciabilità dell'archivio.
    }else if(id){await DGData.update(spec.table,id,record)}else{await DGData.insert(spec.table,record)}
    delete cache[spec.data];closeModal();toast('Salvataggio confermato da Supabase');go(page);
  }
  async function rentalPayment(id){requireLive();const r=(await listing('rentals')).find(x=>x.id===id);if(!r)throw Error('Noleggio non trovato');
    modal('Registra pagamento noleggio',`<form id="dg8-rental-payment-form" data-id="${txt(id)}"><p><strong>${txt(r.referente||r.azienda)}</strong> · ${txt(r.data_partenza)} · Prezzo ${txt(euro(r.prezzo_concordato))} · Saldo ${txt(euro(r.saldo))}</p><div class="form-grid">
    ${fMarkup(['tipo','Operazione','select',true,['Acconto','Saldo','Rimborso']],'Acconto')}
    ${fMarkup(['importo','Importo (€)','number',true],'')}
    ${fMarkup(['metodo','Metodo','select',true,['Contanti','POS','Bonifico']],'Contanti')}
    ${fMarkup(['data_pagamento','Data di registrazione','date',true],fieldDate())}
    ${fMarkup(['note','Note di incasso','textarea'],'')}</div>${actFooter('Registra pagamento')}</form>`);
  }
  async function saveRentalPayment(f){requireLive();const v=Object.fromEntries(new FormData(f)),amount=Number(v.importo);if(!Number.isFinite(amount)||amount<=0)throw Error('Importo non valido');
    if(!confirm(`${v.tipo.toUpperCase()} NOLEGGIO · ${euro(amount)}\nConfermi la registrazione sulla cassa dell’operatore corrente?`))return;
    const r=await DGData.rpc('dg_register_rental_payment',{p_noleggio_id:f.dataset.id,p_tipo:v.tipo,p_importo:amount,p_metodo:v.metodo,p_data:v.data_pagamento,p_note:v.note||''});
    if(!r||r.success===false)throw Error('Supabase non ha confermato il pagamento');closeModal();toast('Movimento registrato');go('rentals');
  }
  async function archiveRental(id){requireLive();const list=await listing('rentals'),r=list.find(x=>x.id===id);if(!r)throw Error('Noleggio non trovato');
    const archive=!r.archiviato_at;if(!confirm(`${archive?'Archiviare':'Ripristinare'} il noleggio ${r.id_noleggio||r.id}?`))return;
    const result=await DGData.rpc('dg_archive_rental_v57',{p_noleggio_id:id,p_archivia:archive});
    if(result?.archiviato!==archive)throw Error('Archiviazione non confermata da Supabase');delete cache.rentals;toast('Stato noleggio aggiornato');go(page);
  }
  async function archiveDriver(id){requireLive();const r=(await listing('drivers')).find(x=>x.id===id);if(!r)throw Error('Autista non trovato');
    const archive=!r.archiviato_at;if(!confirm(`${archive?'Archiviare':'Ripristinare'} la scheda dell’autista?`))return;
    await DGData.update('dg3_autisti',id,{archiviato_at:archive?new Date().toISOString():null});toast('Scheda autista aggiornata');go(page);
  }
  async function readNotification(id){requireLive();const actor=DGData.actor;if(!actor?.id)throw Error('Identità operatore mancante');
    const already=(await listing('notificationReads')).some(x=>x.notification_id===id&&x.operator_user_id===actor.id);if(already){toast('Notifica già letta per il tuo profilo');return;}
    if(!confirm('Segnare la notifica come letta SOLO per il tuo profilo?'))return;
    await DGData.insert('dg_notification_reads',{notification_id:id,operator_user_id:actor.id,read_at:new Date().toISOString()});toast('Notifica letta');go(page);
  }
  async function completeTask(id){requireLive();if(!confirm('Confermare la chiusura di questa attività?'))return;
    await DGData.update('scadenze_gestionale',id,{stato:'completata',completata_at:new Date().toISOString()});toast('Attività completata');go(page);
  }
  function printOne(title,html){const root=document.createElement('div');root.id='dg-print-only';root.innerHTML=`<section class="print-sheet"><div class="dg-print-brand"><img src="assets/logo-delgrosso.png" alt="Logo DELGROSSO"><div class="dg-print-brand-text"><h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>${txt(title)}</h2><p>Documento interno · ${txt(new Date().toLocaleString('it-IT'))}</p></div></div>${html}</section>`;document.body.append(root);
    const clean=()=>{root.remove();window.removeEventListener('afterprint',clean)};window.addEventListener('afterprint',clean,{once:true});window.print();setTimeout(clean,120000);}
  async function printQuote(id){requireLive();const r=(await listing('quotes')).find(x=>x.id===id);if(!r)throw Error('Preventivo non trovato');
    printOne('Preventivo · '+(r.numero_preventivo||'bozza'),`<p><strong>Cliente:</strong> ${txt([r.nome,r.cognome].join(' '))} ${txt(r.azienda||'')}</p><p><strong>Viaggio:</strong> ${txt(r.luogo_partenza||'')} → ${txt(r.destinazione)} (${txt(r.data_viaggio||r.data_partenza)})</p><p><strong>Partecipanti:</strong> ${txt(r.numero_passeggeri)} · <strong>Importo offerta:</strong> ${txt(euro(r.importo_preventivo||r.importo))}</p><p><strong>Condizioni:</strong> ${txt(r.condizioni_offerta||'Da definire')}</p><p>Documento commerciale, non fattura fiscale.</p>`);
  }
  async function renderNotifications08(){const [rows,reads]=await Promise.all([listing('notifications'),listing('notificationReads')]);const user=DGData.actor?.id;
    const owned=new Set(reads.filter(x=>x.operator_user_id===user).map(x=>x.notification_id));
    return sec('Centro notifiche · Nicola / Raffaele','Letture separate per ciascun operatore, creazione e modifica dei messaggi')+liveNotice()+
      bar([action('new:notifications','','＋ Nuova notifica')])+
      mainPanel('Notifiche e avvisi',table(rows,[['DATA',r=>txt(r.created_at)],['TITOLO',r=>txt(r.titolo)],['MESSAGGIO',r=>txt(r.messaggio)],['CATEGORIA',r=>txt(r.tipo)],['LETTURA PERSONALE',r=>owned.has(r.id)?'Letta':'Da leggere'],['AZIONI',r=>`${action('edit:notifications',r.id,'Modifica')} ${owned.has(r.id)?'':action('read-notice',r.id,'Segna letta')}`]]));
  }
  async function renderWhatsapp(){let customers=[],inbox=[],optins=[],invites=[],outbound=[],logs=[];
    if(!isDemo()){[customers,inbox,optins,invites,outbound,logs]=await Promise.all(['customers','waInbox','waOptins','waInvites','waOutbound','waManual'].map(k=>listing(k).catch(e=>{if(['waManual'].includes(k))return [];throw e})));}
    const active=optins.filter(c=>!c.revoked_at);
    const inviteURL=x=>{try{const u=new URL(x);return u.protocol==='https:'&&['chat.whatsapp.com','www.whatsapp.com'].includes(u.hostname)?u.href:''}catch{return ''}};
    const commandsHTML=bar([action('wa-compose','','✉ Prepara messaggio'),action('wa-consent','','＋ Registra consenso'),action('wa-invite','','＋ Link gruppo viaggio')]);
    return sec('Centro WhatsApp Business','Gestione ibrida: rubrica e consenso, apertura WhatsApp manuale, storico inviti e messaggi')+liveNotice()+commandsHTML+
      `<div class="metric-belt"><div class="mini-metric"><strong>${inbox.length}</strong><span>Messaggi ricevuti</span></div><div class="mini-metric"><strong>${active.length}</strong><span>Consensi attivi</span></div><div class="mini-metric"><strong>${outbound.length}</strong><span>Invii API registrati</span></div></div>`+
      mainPanel('Messaggi in arrivo',table(inbox,[['DATA',r=>txt(r.received_at)],['MITTENTE',r=>txt(r.sender_name||r.sender_phone)],['MESSAGGIO',r=>txt(r.message_text)],['STATO',r=>txt(r.status)],['AZIONI',r=>action('wa-inbox',r.id,'Aggiorna')]]))+
      mainPanel('Consensi e revoche',table(optins,[['CONTATTO',r=>txt(r.customer_name||r.phone)],['TELEFONO',r=>txt(r.phone)],['CONSENSO',r=>r.revoked_at?'Revocato':'Attivo'],['AZIONE',r=>r.revoked_at?'—':action('wa-revoke:'+r.phone,'','Revoca consenso')]]))+
      mainPanel('Link inviti a gruppi (gestione manuale)',table(invites,[['VIAGGIO',r=>txt(r.trip_id)],['LINK',r=>inviteURL(r.invite_url)?`<a href="${txt(inviteURL(r.invite_url))}" target="_blank" rel="noopener noreferrer">Apri invito</a>`:'Link non verificato'],['MODIFICATO',r=>txt(r.updated_at)]]))+
      mainPanel('Messaggi preparati / aperti manualmente',table(logs,[['DATA',r=>txt(r.created_at)],['NUMERO',r=>txt(r.telefono)],['OGGETTO',r=>txt(r.oggetto)],['STATO',r=>txt(r.stato)],['AZIONI',r=>`${r.stato==='preparato'?action('wa-manual-open',r.id,'Apri chat'):''} ${r.stato==='aperto_in_whatsapp'?action('wa-manual-confirm',r.id,'Conferma invio manuale'):''}`]]))+
      cardInfo('Un collegamento wa.me apre WhatsApp: NON prova che il messaggio sia stato inviato. Nessun inserimento automatico nei gruppi. L’API Meta, se utilizzata, deve rispettare consenso e template approvati.', 'info');
  }
  function phoneWhatsApp(value){let n=String(value||'').replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);if(!n.startsWith('39')&&n.length===10)n='39'+n;
    if(n.length<11||n.length>15)throw Error('Numero WhatsApp non valido, includi il prefisso internazionale');return n;}
  async function waCompose(){requireLive();const users=await listing('customers');
    modal('Prepara messaggio WhatsApp · invio manuale',`<form id="dg8-wa-form"><div class="form-grid"><label class="field"><span>Cliente (facoltativo)</span><select name="cliente_id"><option value="">Contatto manuale</option>${users.filter(x=>x.telefono).map(x=>`<option value="${txt(x.id)}" data-phone="${txt(x.telefono)}">${txt(x.nome)} ${txt(x.cognome)}</option>`).join('')}</select></label>${fMarkup(['telefono','Numero WhatsApp','tel',true],'')}${fMarkup(['oggetto','Oggetto del messaggio','text',true],'')}${fMarkup(['messaggio','Testo del messaggio','textarea',true],'')}</div><p class="small-note">Aprire WhatsApp non invia il messaggio: devi premere Invia nell’app e registrare separatamente l’eventuale conferma.</p><div class="modal-footer"><button type="button" class="btn-secondary" data-dismiss="1">Annulla</button><button type="submit" class="btn btn-main">Salva e apri WhatsApp</button></div><p id="dg8-wa-error" class="auth-error" hidden></p></form>`);
  }
  async function saveWhatsApp(form){requireLive();const v=Object.fromEntries(new FormData(form)),phone=phoneWhatsApp(v.telefono),text=inline(v.messaggio);if(!text||text.length>2000)throw Error('Testo vuoto o troppo lungo');
    if(!confirm('Salvare il messaggio preparato e aprire WhatsApp? Non sarà inviato automaticamente.'))return;
    const record=await DGData.insert('dg3_wa_manual_logs',{cliente_id:v.cliente_id||null,telefono:phone,oggetto:v.oggetto,messaggio:text,stato:'preparato'});
    closeModal();window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');toast('Messaggio preparato: completa manualmente l’invio su WhatsApp');go('whatsapp');return record;
  }
  async function waConsent(){requireLive();modal('Consenso WhatsApp',`<form id="dg8-consent-form"><div class="form-grid">${fMarkup(['phone','Numero con prefisso (+39...)','tel',true],'')}${fMarkup(['customer_name','Nome contatto','text',true],'')}${fMarkup(['consent_source','Origine del consenso','select',true,['Modulo scritto','Richiesta esplicita WhatsApp','Contratto / prenotazione documentata']],null)}</div><label class="field"><span><input type="checkbox" name="consent" required> Confermo che il cliente ha espresso il consenso documentato per la comunicazione prevista</span></label>${actFooter('Registra consenso')}</form>`);}
  async function saveConsent(form){requireLive();const v=Object.fromEntries(new FormData(form));if(!v.consent)throw Error('Il consenso documentato è obbligatorio');const phone=phoneWhatsApp(v.phone);
    if(!confirm('Registrare il consenso del cliente?'))return;
    await DGData.upsertKnown('dg_whatsapp_optins_v61',{phone,customer_name:v.customer_name,consent_source:v.consent_source,consent_at:new Date().toISOString(),revoked_at:null,updated_by:DGData.actor?.id});closeModal();toast('Consenso registrato');go('whatsapp');}
  async function saveInvite(form){requireLive();const v=Object.fromEntries(new FormData(form));const url=new URL(String(v.invite_url||''));if(url.protocol!=='https:'||!['chat.whatsapp.com','www.whatsapp.com'].includes(url.hostname))throw Error('Usa un link di invito WhatsApp verificabile');
    if(!confirm('Salvare o aggiornare il link per questo viaggio?'))return;
    await DGData.upsertKnown('dg_whatsapp_trip_invites_v61',{trip_id:v.trip_id,invite_url:url.href,updated_by:DGData.actor?.id});closeModal();toast('Invito aggiornato');go('whatsapp');}
  async function waInvite(){requireLive();const trips=await listing('trips');modal('Link invito gruppo viaggio',`<form id="dg8-invite-form"><div class="form-grid"><label class="field"><span>Viaggio</span><select name="trip_id" required>${trips.map(t=>`<option value="${txt(t.id)}">${txt(t.titolo||t.destinazione)} · ${txt(t.data_partenza)}</option>`).join('')}</select></label>${fMarkup(['invite_url','Link WhatsApp del gruppo','url',true],'')}</div>${actFooter('Salva link')}</form>`);}
  async function waRevoke(phone){requireLive();if(!confirm('Revocare il consenso WhatsApp per '+phone+'?'))return;
    const prior=(await listing('waOptins')).find(x=>x.phone===phone);if(!prior)throw Error('Consenso non trovato');
    await DGData.upsertKnown('dg_whatsapp_optins_v61',{phone,customer_name:prior.customer_name,consent_source:prior.consent_source,consent_at:prior.consent_at,revoked_at:new Date().toISOString(),updated_by:DGData.actor?.id});toast('Consenso revocato');go('whatsapp');}
  async function waConfirmLog(id){requireLive();const r=(await listing('waManual')).find(x=>x.id===id);if(!r)throw Error('Messaggio non trovato');
    if(!confirm('Hai verificato personalmente che il messaggio sia stato INVIATO da WhatsApp? Il gestionale non può rilevarlo autonomamente.'))return;
    await DGData.update('dg3_wa_manual_logs',id,{stato:'inviato_confermato'});toast('Invio contrassegnato come verificato dall’operatore');go('whatsapp');}
  async function waOpenLog(id){requireLive();const record=(await listing('waManual')).find(x=>x.id===id);if(!record)throw Error('Messaggio non trovato');
    window.open('https://wa.me/'+phoneWhatsApp(record.telefono)+'?text='+encodeURIComponent(record.messaggio),'_blank','noopener,noreferrer');
    await DGData.update('dg3_wa_manual_logs',id,{stato:'aperto_in_whatsapp'});toast('WhatsApp aperto: invio manuale da completare');go('whatsapp');}
  async function waUpdateInbox(id){requireLive();const row=(await listing('waInbox')).find(x=>x.id===id);if(!row)throw Error('Messaggio non trovato');
    const values=['da_esaminare','in_lavorazione','risposto','archiviato'];modal('Gestione messaggio ricevuto',`<form id="dg8-inbox-form" data-id="${txt(id)}"><p>${txt(row.message_text)}</p><label class="field"><span>Stato</span><select name="status">${values.map(v=>`<option ${row.status===v?'selected':''}>${txt(v)}</option>`).join('')}</select></label>${actFooter('Aggiorna stato')}</form>`);}
  async function renderTransfers(){const [rows,operators,corrections]=await Promise.all([listing('transfers'),listing('operators'),listing('cashCorrections').catch(()=>[])]);
    const names=Object.fromEntries(operators.map(x=>[x.user_id,x.nome||x.username||'Operatore']));const done=rows.filter(x=>x.stato!=='annullato');
    return sec('Trasferimenti cassa · Nicola / Raffaele','Movimenti finanziari storicizzati · modifiche dirette degli importi non consentite')+liveNotice()+
      bar([action('transfer-new','','＋ Trasferisci denaro'),action('cash-correction','','✎ Richiedi una rettifica')])+
      mainPanel('Registro trasferimenti',table(done,[['DATA',r=>txt(r.data_trasferimento)],['DA',r=>txt(names[r.da_operatore_user_id])],['A',r=>txt(names[r.a_operatore_user_id])],['IMPORTO',r=>txt(euro(r.importo))],['STATO',r=>txt(r.stato)],['AZIONI',r=>action('cash-correction-id',r.id,'Richiedi correzione')]]))+
      mainPanel('Richieste di rettifica (NON alterano gli incassi)',table(corrections,[['DATA',r=>txt(r.created_at)],['RIF. MOVIMENTO',r=>txt(r.trasferimento_id)],['MOTIVO',r=>txt(r.motivo)],['STATO',r=>txt(r.stato)]]))+
      cardInfo('Un movimento contabilizzato non si sovrascrive. Le richieste di rettifica sono protocollate e vanno gestite con una contropartita autorizzata per non falsare i saldi.', 'warn');
  }
  async function newTransfer(){requireLive();const operators=(await listing('operators')).filter(x=>x.attivo&&x.user_id!==DGData.actor?.id);
    if(!operators.length)throw Error('Nessun altro operatore autorizzato disponibile');
    modal('Trasferisci tra casse',`<form id="dg8-transfer-form"><div class="form-grid"><label class="field"><span>Da</span><input value="${txt(DGData.actor?.name||'Operatore corrente')}" disabled></label><label class="field"><span>A operatore</span><select name="to" required>${operators.map(x=>`<option value="${txt(x.user_id)}">${txt(x.nome||x.username)}</option>`).join('')}</select></label>${fMarkup(['amount','Importo (€)','number',true],'')}${fMarkup(['note','Motivo / riferimento','textarea',true],'')}</div><p class="small-note">L’importo sarà prelevato dalla cassa del profilo corrente soltanto dopo conferma e verifica del saldo da parte del server.</p>${actFooter('Registra trasferimento')}</form>`);}
  async function saveTransfer(form){requireLive();const v=Object.fromEntries(new FormData(form)),amount=Number(v.amount);
    if(!Number.isFinite(amount)||amount<=0||!v.to||v.to===DGData.actor?.id)throw Error('Destinatario o importo non validi');
    if(!confirm(`ATTENZIONE · MOVIMENTO DI CASSA\nTrasferire ${euro(amount)} a un altro operatore?\nNon sarà possibile cambiare l’importo direttamente dopo la registrazione.`))return;
    const out=await DGData.rpc('dg_transfer_cash',{p_to_user_id:v.to,p_amount:amount,p_note:v.note});
    if(!out?.success)throw Error('Trasferimento non confermato dal server');closeModal();toast('Trasferimento registrato');go('transfers');}
  async function cashCorrection(id){requireLive();const rows=await listing('transfers');modal('Richiesta rettifica · solo registrazione',`<form id="dg8-correction-form"><div class="form-grid"><label class="field"><span>Trasferimento da verificare</span><select name="transfer_id" required>${rows.map(r=>`<option value="${txt(r.id)}" ${r.id===id?'selected':''}>${txt(r.data_trasferimento)} · ${txt(euro(r.importo))}</option>`).join('')}</select></label>${fMarkup(['motivo','Motivo e correzione richiesta','textarea',true],'')}</div><p class="small-note">Questa richiesta non modifica il saldo. Una eventuale rettifica contabile richiede una registrazione separata e autorizzata.</p>${actFooter('Registra richiesta')}</form>`);}
  async function saveCashCorrection(form){requireLive();const v=Object.fromEntries(new FormData(form));if(inline(v.motivo).length<8)throw Error('Descrivi la motivazione della rettifica');
    if(!confirm('Registrare una richiesta di rettifica senza cambiare l’importo della cassa?'))return;
    await DGData.insert('dg3_richieste_rettifica_cassa',{trasferimento_id:v.transfer_id,motivo:v.motivo,stato:'da_verificare'});closeModal();toast('Richiesta protocollata');go('transfers');}
  async function renderArchive(){const [docs,receipts,rentals,invoices]=await Promise.all([listing('documents'),listing('receiptarchive').catch(()=>[]),listing('rentals'),listing('invoices').catch(()=>[])]);
    const archived=rentals.filter(r=>r.archiviato_at);return sec('Archivio centrale aziendale','Accesso a documenti privati e registri storici, senza eliminare le evidenze fiscali')+liveNotice()+
      bar([action('new:documents','','＋ Archivia documento'),action('archive-filter','','⇩ Esporta indice documenti CSV')])+
      mainPanel('Documenti e allegati riservati',table(docs,[['DATA',r=>txt(r.created_at)],['DOCUMENTO',r=>txt(r.titolo)],['CATEGORIA',r=>txt(r.categoria)],['FILE',docsFile],['GESTIONE',r=>action('edit:documents',r.id,'Modifica scheda')]]))+
      mainPanel('Ricevute già emesse (archivio immutabile)',table(receipts.slice(0,250),[['DATA',r=>txt(r.data_pagamento||r.created_at)],['NUMERO',r=>txt(r.receipt_number)],['TIPO',r=>txt(r.tipo||r.kind)],['CLIENTE',r=>txt(r.cliente)],['IMPORTO',r=>txt(euro(r.importo))],['FILE',r=>r.professional_path||r.legacy_path?`<button class="btn-secondary" data-storage-bucket="ricevute-prenotazioni" data-storage-path="${txt(r.professional_path||r.legacy_path)}">Apri</button>`:'—']]))+
      mainPanel('Bozze fattura in archivio',table(invoices.filter(r=>r.stato==='archiviata'),[['DATA',r=>txt(r.data_bozza)],['DESTINATARIO',r=>txt(r.destinatario?.denominazione)],['TOTALE',r=>txt(DGInvoiceCore.eur(r.totale_centesimi))]]))+
      mainPanel('Noleggi archiviati',table(archived,[['DATA',r=>txt(r.data_partenza)],['REFERENTE',r=>txt(r.referente)],['TRATTA',r=>txt(r.tratta_partenza+' → '+r.tratta_destinazione)],['AZIONI',r=>action('archive-rental',r.id,'Ripristina')]]));
  }
  async function archiveIndexCSV(){const docs=await listing('documents'),rows=[['TITOLO','CATEGORIA','DATA','PERCORSO_STORAGE_PRIVATO','SCADENZA']];docs.forEach(r=>rows.push([r.titolo,r.categoria,r.created_at,r.storage_path,r.scadenza]));DGData.downloadCSV(rows,'DELGROSSO_ARCHIVIO_INDICE.csv');}
  async function renderReports08(){const [trips,bookings,payments,rentals]=await Promise.all([listing('trips'),listing('bookings'),listing('payments'),listing('rentals')]);
    return sec('Report e liste personalizzate','Elenchi e riepiloghi esportabili, aggiornati dai dati Supabase')+liveNotice()+
      bar([action('report-all','','🖨 Stampa prenotati di TUTTI i viaggi'),action('report-payments','','⇩ Pagamenti CSV'),action('report-rentals','','⇩ Noleggi CSV'),action('report-summary','','⇩ Report riepilogo viaggi CSV')])+
      mainPanel('Report prenotati per singolo viaggio',table(trips,[['DATA',r=>txt(r.data_partenza)],['VIAGGIO',r=>txt(r.titolo||r.destinazione)],['CAPIENZA',r=>txt(r.posti_totali)],['PRENOTATI',r=>bookings.filter(b=>b.viaggio_id===r.id&&allActive(b)).reduce((s,b)=>s+Number(b.posti||0),0)],['ESPORTA',r=>`<button class="btn-secondary" data-download="${txt(r.id)}" data-kind="pdf">PDF</button> <button class="btn-secondary" data-download="${txt(r.id)}" data-kind="csv">CSV</button> <button class="btn-secondary" data-download="${txt(r.id)}" data-kind="phones">WhatsApp</button>`]]))+
      mainPanel('Contatori di controllo',`<div class="metric-belt"><div class="mini-metric"><strong>${trips.length}</strong><span>Viaggi</span></div><div class="mini-metric"><strong>${bookings.length}</strong><span>Prenotazioni</span></div><div class="mini-metric"><strong>${payments.length}</strong><span>Movimenti di pagamento</span></div><div class="mini-metric"><strong>${rentals.length}</strong><span>Noleggi</span></div></div>`)+
      cardInfo('Gli export sono file interni con dati personali: proteggili e limita la condivisione. I totali non sostituiscono la quadratura contabile e fiscale.','info');
  }
  async function exportReport(kind){requireLive();const [trips,bs,ps,rs]=await Promise.all([listing('trips'),listing('bookings'),listing('payments'),listing('rentals')]);
    if(kind==='all'){DGData.printAllTrips(trips,bs);return;}
    if(kind==='payments'){DGData.downloadCSV([['DATA','TIPO','IMPORTO','OPERATORE','METODO','NUMERO RICEVUTA'],...ps.map(x=>[x.data_pagamento,x.tipo,x.importo,x.incassato_da,x.metodo||x.metodo_pagamento,x.receipt_number])],'DELGROSSO_REPORT_PAGAMENTI.csv');return;}
    if(kind==='rentals'){DGData.downloadCSV([['REFERENTE','PARTENZA','DESTINAZIONE','DATA','PREZZO','STATO'],...rs.map(x=>[x.referente,x.tratta_partenza,x.tratta_destinazione,x.data_partenza,x.prezzo_concordato,x.stato_noleggio])],'DELGROSSO_REPORT_NOLEGGI.csv');return;}
    if(kind==='summary'){DGData.downloadCSV([['DATA','VIAGGIO','CAPIENZA','PRENOTATI','TOTALE QUOTE','PAGATO'],...trips.map(t=>{const x=bs.filter(b=>b.viaggio_id===t.id&&allActive(b));return[t.data_partenza,t.titolo||t.destinazione,t.posti_totali,x.reduce((v,b)=>v+Number(b.posti||0),0),x.reduce((v,b)=>v+Number(b.totale||0),0),x.reduce((v,b)=>v+Number(b.pagato||0),0)]})],'DELGROSSO_REPORT_VIAGGI.csv');}
  }
  async function renderAssistant08(){const [trips,bs,seats,deadlines,notes]=await Promise.all([listing('trips'),listing('bookings'),listing('seatrows'),listing('deadlines'),listing('anomalyCases').catch(()=>[])]);
    const flagged=[];for(const t of trips){const m=DGData.seatOverview(t,bs,seats),name=t.titolo||t.destinazione;
      if(m.legacy_only.length)flagged.push({key:`posti:${t.id}`,type:'Posti storici da riconciliare',ref:t.id,title:name,detail:m.legacy_only.join(', ')});
      if(m.counter_mismatch)flagged.push({key:`contatore:${t.id}`,type:'Contatore incoerente',ref:t.id,title:name,detail:`Contatore ${m.counter_claim} · sedili ${m.occupied_count}`});
      const n=Number(t.minimo_partecipanti||40);if(!t.archiviato_at&&t.data_partenza>=new Date().toISOString().slice(0,10)&&Number(t.posti_occupati||0)<n)flagged.push({key:`minimo:${t.id}`,type:'Minimo non raggiunto',ref:t.id,title:name,detail:`Mancano ${Math.max(0,n-Number(t.posti_occupati||0))} persone`});
    }
    const todayStr=fieldDate();deadlines.filter(x=>x.data_scadenza<todayStr&&!/complet|annull/i.test(x.stato||'')).forEach(x=>flagged.push({key:`scadenza:${x.id}`,type:'Scadenza arretrata',ref:x.id,title:x.titolo,detail:x.data_scadenza}));
    const keyed=Object.fromEntries(notes.map(x=>[x.chiave,x]));
    return sec('Assistente operativo e anomalie','Controlli di congruenza reali; per ogni segnalazione è possibile registrare una verifica')+liveNotice()+
      mainPanel(`Segnalazioni rilevate: ${flagged.length}`,table(flagged,[['TIPO',r=>txt(r.type)],['RIFERIMENTO',r=>txt(r.title)],['DETTAGLIO',r=>txt(r.detail)],['VERIFICA',r=>txt(keyed[r.key]?.stato||'aperta')],['AZIONE',r=>`<button type="button" class="btn-secondary" data-dg8-action="anomaly-note" data-dg8-key="${txt(r.key)}">✎ Prendi in carico</button>`]]))+
      cardInfo('L’assistente segnala anomalie ma NON riassegna posti, modifica pagamenti o chiude viaggi automaticamente. La conferma delle correzioni spetta agli operatori.', 'info');
  }
  async function anomalyNote(key){requireLive();const list=await listing('anomalyCases').catch(()=>[]),row=list.find(x=>x.chiave===key);
    modal('Verifica anomalia · '+key,`<form id="dg8-anomaly-form" data-key="${txt(key)}"><div class="form-grid">${fMarkup(['stato','Stato verifica','select',true,['aperta','in_verifica','risolta']],row?.stato||'aperta')}${fMarkup(['note','Note e azioni effettuate','textarea',true],row?.note||'')}</div>${actFooter('Registra verifica')}</form>`);}
  async function saveAnomaly(form){requireLive();const v=Object.fromEntries(new FormData(form));if(inline(v.note).length<5)throw Error('Descrivere la verifica');
    if(!confirm('Salvare la verifica nel registro delle anomalie?'))return;
    const rows=await listing('anomalyCases');const existing=rows.find(r=>r.chiave===form.dataset.key);if(existing){await DGData.update('dg3_anomalie_verifiche',existing.id,{note:v.note,stato:v.stato,updated_at:new Date().toISOString()});}else await DGData.insert('dg3_anomalie_verifiche',{chiave:form.dataset.key,tipo:form.dataset.key.split(':')[0],riferimento_id:form.dataset.key.split(':')[1],note:v.note,stato:v.stato});closeModal();toast('Verifica salvata');go('assistant');}
  async function renderInvoices08(){let list=[];try{list=await listing('invoices')}catch(e){return sec('Fatturazione · bozze non emesse')+cardInfo(e.message,'warn')+cardInfo('Il modulo 0.7 va installato e testato in staging, prima di attivare l’archivio nel Supabase aziendale.','info')}
    return sec('Fatturazione integrata · gestione bozze','Preparazione, modifica e archiviazione delle bozze. Invio fiscale SdI NON attivo.')+liveNotice()+
      bar([`<button type="button" class="btn btn-main" data-dg3-new-invoice="1">＋ Nuova bozza fattura</button>`,action('invoice-csv','','⇩ Esporta CSV per commercialista')])+
      mainPanel('Bozze di documenti fiscali (non emessi)',table(list,[['DATA',r=>txt(r.data_bozza)],['TIPO',r=>txt(r.tipo_documento)],['CLIENTE',r=>txt(r.destinatario?.denominazione)],['TOTALE',r=>txt(DGInvoiceCore.eur(r.totale_centesimi))],['STATO',r=>txt(r.stato)],['AZIONI',r=>`${r.stato==='bozza'?action('invoice-edit',r.id,'✎ Modifica'):''} ${action('invoice-archive',r.id,r.stato==='archiviata'?'Archiviata':'Archivia')} <button type="button" class="btn-secondary" data-dg3-print-invoice="${txt(r.id)}">Stampa bozza</button>`]]))+
      cardInfo('Non è possibile emettere o trasmettere fatture elettroniche da questa interfaccia senza dati fiscali verificati, integrazione SdI e conservazione a norma. I PDF sono bozze senza validità fiscale.','warn');
  }
  async function invoiceEdit(id){requireLive();const r=(await listing('invoices')).find(x=>x.id===id);if(!r)throw Error('Bozza non trovata');if(r.stato!=='bozza')throw Error('Puoi modificare solo bozze aperte');
    const row=(r.righe||[])[0]||{};
    modal('Modifica bozza fattura · NON EMESSA',`<form id="dg8-invoice-form" data-id="${txt(id)}"><div class="form-grid">
      ${fMarkup(['data_bozza','Data documento','date',true],r.data_bozza)}${fMarkup(['tipo_documento','Tipo documento','select',true,['immediata','acconto','saldo','differita','nota_credito']],r.tipo_documento)}
      ${fMarkup(['ragione_sociale','Ragione sociale emittente','text',true],r.emittente?.ragione_sociale)}${fMarkup(['partita_iva','P. IVA emittente','text',true],r.emittente?.partita_iva)}${fMarkup(['regime_fiscale','Regime fiscale emittente','text',true],r.emittente?.regime_fiscale)}
      ${fMarkup(['indirizzo_emittente','Indirizzo emittente','text',true],r.emittente?.indirizzo)}${fMarkup(['cap_emittente','CAP emittente','text',true],r.emittente?.cap)}${fMarkup(['comune_emittente','Comune emittente','text',true],r.emittente?.comune)}
      ${fMarkup(['denominazione','Destinatario','text',true],r.destinatario?.denominazione)}${fMarkup(['piva_cliente','Partita IVA cliente'],r.destinatario?.partita_iva)}${fMarkup(['cf_cliente','Codice fiscale cliente'],r.destinatario?.codice_fiscale)}
      ${fMarkup(['indirizzo_cliente','Indirizzo cliente','text',true],r.destinatario?.indirizzo)}${fMarkup(['cap_cliente','CAP cliente','text',true],r.destinatario?.cap)}${fMarkup(['comune_cliente','Comune cliente','text',true],r.destinatario?.comune)}
      ${fMarkup(['codice_destinatario','Codice destinatario'],r.destinatario?.codice_destinatario)}${fMarkup(['pec_cliente','PEC cliente','email'],r.destinatario?.pec)}
      ${fMarkup(['descrizione','Descrizione servizio','text',true],row.descrizione)}${fMarkup(['quantita','Quantità','number',true],row.quantita||1)}
      ${fMarkup(['prezzo_unitario','Imponibile unitario (€)','number',true],Number(row.prezzo_unitario_centesimi||0)/100)}${fMarkup(['aliquota_iva','Aliquota IVA % da verificare','number',true],r.aliquota_iva)}
      ${fMarkup(['natura_iva','Natura IVA (per aliquota 0)'],r.natura_iva)}${fMarkup(['note_interne','Note interne','textarea'],r.note_interne)}
      </div><p class="small-note">Per le bozze con più righe, utilizza la gestione completa nel commercialista: questo modulo modifica la prima riga e rifiuta sovrascritture multiple.</p>${actFooter('Salva bozza modificata')}</form>`);
  }
  async function saveInvoiceEdit(form){requireLive();const id=form.dataset.id,r=(await listing('invoices')).find(x=>x.id===id);if(!r||r.stato!=='bozza')throw Error('Bozza non disponibile');
    if((r.righe||[]).length!==1)throw Error('Questa bozza ha più righe. Non può essere sovrascritta dal modulo semplificato.');const v=Object.fromEntries(new FormData(form));
    const ref=r.prenotazione_id?{tipo:'prenotazione',id:r.prenotazione_id}:r.noleggio_id?{tipo:'noleggio',id:r.noleggio_id}:{tipo:'manuale'};
    const d=DGInvoiceCore.buildDraft({riferimento:ref,tipo_documento:v.tipo_documento,data_bozza:v.data_bozza,
      emittente:{...r.emittente,ragione_sociale:v.ragione_sociale,partita_iva:v.partita_iva,regime_fiscale:v.regime_fiscale,indirizzo:v.indirizzo_emittente,cap:v.cap_emittente,comune:v.comune_emittente},
      destinatario:{...r.destinatario,denominazione:v.denominazione,partita_iva:v.piva_cliente,codice_fiscale:v.cf_cliente,indirizzo:v.indirizzo_cliente,cap:v.cap_cliente,comune:v.comune_cliente,codice_destinatario:v.codice_destinatario,pec:v.pec_cliente},
      righe:[{descrizione:v.descrizione,quantita:Number(v.quantita),prezzo_unitario:v.prezzo_unitario}],aliquota_iva:v.aliquota_iva,natura_iva:v.natura_iva,note_interne:v.note_interne});
    delete d.totale_centesimi;delete d.cliente_id;
    if(!confirm('Confermi la modifica della BOZZA (non emessa)? I valori saranno aggiornati in Supabase.'))return;
    await DGData.update('dg3_fatture_bozze',id,d);closeModal();toast('Bozza aggiornata');go('invoices');}
  async function archiveInvoice(id){requireLive();const r=(await listing('invoices')).find(x=>x.id===id);if(!r)throw Error('Bozza non trovata');if(r.stato==='archiviata')return toast('Bozza già archiviata');
    if(!confirm('Archiviare la bozza? La modifica successiva sarà bloccata; non verrà emessa alcuna fattura.'))return;
    await DGData.update('dg3_fatture_bozze',id,{stato:'archiviata'});toast('Bozza archiviata');go('invoices');}
  async function invoiceCSV(){requireLive();const list=await listing('invoices');DGData.downloadCSV([['DATA','TIPO','EMITTENTE','DESTINATARIO','TOTALE','STATO'],...list.map(r=>[r.data_bozza,r.tipo_documento,r.emittente?.ragione_sociale,r.destinatario?.denominazione,Number(r.totale_centesimi)/100,r.stato])],'DELGROSSO_BOZZE_FATTURE_CSV.csv');}
  async function renderSettings08(){const users=isDemo()?[]:await listing('operators');let settings=[];let unavailable='';try{settings=await listing('appSettings')}catch(e){unavailable=e.message}
    const opts=Object.fromEntries(settings.map(r=>[r.chiave,r.valore]));
    return sec('Impostazioni e sicurezza · gestione profili','Profili aziendali, configurazione operativa e protezione delle credenziali')+liveNotice()+
      mainPanel('Profili registrati su Supabase',table(users,[['OPERATORE',r=>txt(r.nome||r.username)],['USERNAME',r=>txt(r.username)],['ATTIVO',r=>r.attivo?'Sì':'No']]))+
      bar([action('settings-password','','🔐 Cambia password personale'),action('settings-edit','','⚙ Modifica configurazione aziendale')])+
      (unavailable?cardInfo('Configurazione condivisa non installata: '+unavailable,'warn'):mainPanel('Parametri attivi',table(settings,[['CHIAVE',r=>txt(r.chiave)],['VALORE',r=>txt(typeof r.valore==='object'?JSON.stringify(r.valore):r.valore)],['AGGIORNATO',r=>txt(r.updated_at)]])))+
      cardInfo('I due account Nicola e Raffaele restano distinti. Cambiare le credenziali non modifica la password dell’altro profilo. Non archiviare password nelle impostazioni.','info')+
      cardInfo('Controlli aziendali consigliati: autenticazione individuale, permessi separati, backup periodici, revisione RLS e ripristino testato. Nessun sistema può garantire l’assenza permanente di errori.','info');
  }
  async function settingsPassword(){requireLive();modal('Cambia password del tuo profilo',`<form id="dg8-password-form"><div class="form-grid">${fMarkup(['new_password','Nuova password (almeno 12 caratteri)','password',true],'')}${fMarkup(['confirm_password','Conferma password','password',true],'')}</div>${actFooter('Aggiorna password personale')}</form>`);}
  async function saveSettingsPassword(form){requireLive();const v=Object.fromEntries(new FormData(form));if(v.new_password!==v.confirm_password)throw Error('Le due password sono diverse');if(String(v.new_password||'').length<12)throw Error('Inserisci almeno 12 caratteri');
    if(!confirm('Confermi la modifica della tua password personale Supabase?'))return;await DGData.changeOwnPassword(v.new_password);closeModal();toast('Password personale aggiornata');}
  async function settingsEdit(){requireLive();const settings=await listing('appSettings');const map=Object.fromEntries(settings.map(x=>[x.chiave,x.valore]));const wh=(k,d)=>map[k]?.valore||d;
    modal('Configurazione aziendale · amministratori',`<form id="dg8-settings-form"><div class="form-grid">${fMarkup(['societa','Ragione sociale (visualizzazione)','text',true],wh('societa','DELGROSSO VIAGGI & LIMOUSINE BUS'))}${fMarkup(['minimo_partecipanti','Minimo standard per nuovi viaggi','number',true],wh('minimo_partecipanti',40))}${fMarkup(['whatsapp','Numero WhatsApp Business','tel',true],wh('whatsapp','3208815899'))}${fMarkup(['nota_documenti','Nota standard documenti','textarea'],wh('nota_documenti','Documento riservato'))}</div><p class="small-note">Questi parametri non riscrivono viaggi o documenti già esistenti; non attivano WhatsApp API o SdI.</p>${actFooter('Salva configurazione')}</form>`);}
  async function saveSettings(form){requireLive();const v=Object.fromEntries(new FormData(form)),min=Number(v.minimo_partecipanti);if(!Number.isInteger(min)||min<1||min>100)throw Error('Minimo partecipanti non valido');if(!confirm('Salvare la configurazione condivisa?'))return;
    const records=[['societa',v.societa],['minimo_partecipanti',min],['whatsapp',phoneWhatsApp(v.whatsapp)],['nota_documenti',v.nota_documenti]];
    for(const [chiave,valore] of records)await DGData.upsertKnown('dg3_impostazioni',{chiave,valore:{valore},updated_by:DGData.actor?.id});closeModal();toast('Impostazioni aggiornate');go('settings');}
  // Override intentionally ONLY the modules scoped to the v0.8 enhancement.
  renders.rentals=()=>renderCrud('rentals');
  renders.quotes=()=>renderCrud('quotes');
  renders.agenda=()=>renderCrud('deadlines');
  renders.tasks=()=>renderCrud('deadlines');
  renders.drivers=()=>renderCrud('drivers');
  renders.notifications=renderNotifications08;
  renders.documents=()=>renderCrud('documents');
  renders.whatsapp=renderWhatsapp;
  renders.transfers=renderTransfers;
  renders.reports=renderReports08;
  renders.assistant=renderAssistant08;
  renders.archive=renderArchive;
  renders.invoices=renderInvoices08;
  renders.settings=renderSettings08;
  // All actions are scoped: no generic HTML-driven table write and no write in demo.
  document.addEventListener('click',async ev=>{
    const btn=ev.target.closest('[data-dg8-action]');if(!btn)return;
    const verb=btn.dataset.dg8Action,id=btn.dataset.dg8Id||'';btn.disabled=true;
    try{
      if(verb.startsWith('new:'))await openEntityForm(verb.slice(4),'');
      else if(verb.startsWith('edit:'))await openEntityForm(verb.slice(5),id);
      else if(verb==='rental-payment')await rentalPayment(id);
      else if(verb==='archive-rental')await archiveRental(id);
      else if(verb==='archive-driver')await archiveDriver(id);
      else if(verb==='finish-task')await completeTask(id);
      else if(verb==='read-notice')await readNotification(id);
      else if(verb==='quote-print')await printQuote(id);
      else if(verb==='wa-compose')await waCompose();
      else if(verb==='wa-consent')await waConsent();
      else if(verb==='wa-invite')await waInvite();
      else if(verb.startsWith('wa-revoke:'))await waRevoke(verb.slice('wa-revoke:'.length));
      else if(verb==='wa-manual-open')await waOpenLog(id);
      else if(verb==='wa-manual-confirm')await waConfirmLog(id);
      else if(verb==='wa-inbox')await waUpdateInbox(id);
      else if(verb==='transfer-new')await newTransfer();
      else if(verb==='cash-correction')await cashCorrection('');
      else if(verb==='cash-correction-id')await cashCorrection(id);
      else if(verb==='archive-filter')await archiveIndexCSV();
      else if(verb==='report-all')await exportReport('all');
      else if(verb==='report-payments')await exportReport('payments');
      else if(verb==='report-rentals')await exportReport('rentals');
      else if(verb==='report-summary')await exportReport('summary');
      else if(verb==='anomaly-note')await anomalyNote(btn.dataset.dg8Key);
      else if(verb==='invoice-edit')await invoiceEdit(id);
      else if(verb==='invoice-archive')await archiveInvoice(id);
      else if(verb==='invoice-csv')await invoiceCSV();
      else if(verb==='settings-password')await settingsPassword();
      else if(verb==='settings-edit')await settingsEdit();
    }catch(err){toast('Operazione non conclusa: '+err.message)}finally{btn.disabled=false;}
  });
  document.addEventListener('change',e=>{if(e.target?.name==='cliente_id'&&e.target.closest('#dg8-wa-form')){
    const target=e.target.form.elements.telefono;const option=e.target.selectedOptions?.[0];if(target&&option?.dataset.phone)target.value=option.dataset.phone;
  }});
  document.addEventListener('submit',async event=>{
    const f=event.target,id=f?.id;
    if(!['dg8-form','dg8-wa-form','dg8-consent-form','dg8-invite-form','dg8-transfer-form','dg8-correction-form','dg8-anomaly-form','dg8-invoice-form','dg8-settings-form','dg8-password-form','dg8-inbox-form','dg8-rental-payment-form'].includes(id))return;
    event.preventDefault();const submit=f.querySelector('button[type=submit]');if(submit)submit.disabled=true;
    try{
      if(id==='dg8-form')await saveEntity(f);
      if(id==='dg8-wa-form')await saveWhatsApp(f);
      if(id==='dg8-consent-form')await saveConsent(f);
      if(id==='dg8-invite-form')await saveInvite(f);
      if(id==='dg8-transfer-form')await saveTransfer(f);
      if(id==='dg8-rental-payment-form')await saveRentalPayment(f);
      if(id==='dg8-correction-form')await saveCashCorrection(f);
      if(id==='dg8-anomaly-form')await saveAnomaly(f);
      if(id==='dg8-invoice-form')await saveInvoiceEdit(f);
      if(id==='dg8-settings-form')await saveSettings(f);
      if(id==='dg8-password-form')await saveSettingsPassword(f);
      if(id==='dg8-inbox-form'){requireLive();const v=Object.fromEntries(new FormData(f));if(!confirm('Aggiornare lo stato del messaggio ricevuto?'))return;await DGData.update('dg_whatsapp_inbox_v61',f.dataset.id,{status:v.status});closeModal();toast('Stato aggiornato');go('whatsapp');}
    }catch(err){const error=document.querySelector('#dg8-form-error')||document.querySelector('#dg8-wa-error');if(error){error.textContent=err.message;error.hidden=false}else toast(err.message)}finally{if(submit)submit.disabled=false;}
  });
})();
