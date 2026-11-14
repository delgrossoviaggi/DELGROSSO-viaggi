/* DELGROSSO VIAGGI 3.0 ULTIMATE · Fatture in bozza + cambio data automatico
 * Versione browser senza Python. SQL RPC server-side è obbligatoria per scritture.
 * NESSUN invio SdI, nessuna fattura fiscale emessa da questo file.
 */
'use strict';
(function(){
  if(typeof renders==='undefined'||typeof DGData==='undefined'||typeof DGInvoiceCore==='undefined'||typeof DGMoveCore==='undefined'){
    throw new Error('Moduli Ultimate 0.7 non disponibili: verificare che i file siano stati estratti insieme');
  }
  // Menù: la voce rimane visibile in consultazione ma nessuna operazione avviene in demo.
  NAV[0][1].splice(3,0,['moves','⇢','Sposta data / posti']);
  let preview=null;
  function normalizeDestination(str){return String(str||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
  function moveButton(){return '<button type="button" class="btn btn-main" data-dg3-open-move="1">⇢ Sposta prenotazione a un’altra data</button>';}
  const oldBookingsRenderer=renders.bookings;
  renders.bookings=async()=>{
    const html=await oldBookingsRenderer();
    return `<div class="action-row">${moveButton()}</div>`+html;
  };
  function chooseMoveDates(trips,book){const src=trips.find(t=>t.id===book.viaggio_id);
    if(!src) return [];
    return trips.filter(t=>t.id!==src.id&&t.data_partenza!==src.data_partenza&&
      normalizeDestination(t.destinazione)===normalizeDestination(src.destinazione)&&
      !t.archiviato_at&&t.posti_totali>0&&!/annull|cancel|chius|sold\s*out/i.test(String(t.stato||'')));
  }
  async function movePage(){const [bookings,trips]=await Promise.all([data('bookings'),data('trips')]);
    const tripName=Object.fromEntries(trips.map(t=>[t.id,`${t.titolo||t.destinazione} · ${t.data_partenza}`]));
    return sec('Spostamento prenotazioni','Cambia la data di una prenotazione, anche con acconto o saldo già versati')+
      `<div class="action-row">${moveButton()}</div>`+
      mainPanel('Come funziona',`<div class="feature-grid">
      <div class="feature"><strong>1 · Seleziona prenotazione</strong><p>Trova il cliente e scegli una nuova data della stessa destinazione.</p></div>
      <div class="feature"><strong>2 · Posti liberi automatici</strong><p>Prima tenta gli stessi posti; altrimenti propone posti numericamente vicini, oppure un’assegnazione casuale fra i liberi.</p></div>
      <div class="feature"><strong>3 · Controllo e conferma</strong><p>Anteprima obbligatoria: posti, data e pagato rimangono visibili prima di confermare.</p></div>
      <div class="feature"><strong>4 · Nessun doppio incasso</strong><p>Vengono aggiornati i riferimenti di viaggio. Restano la stessa prenotazione, gli importi, i pagamenti e le ricevute storiche.</p></div>
      </div>`)+
      mainPanel('Prenotazioni spostabili',table(bookings.filter(b=>allActive(b)).slice(0,300),[
        ['CLIENTE',b=>esc(b.cliente_nome||b.cliente)],
        ['DATA ATTUALE',b=>esc(tripName[b.viaggio_id]||'—')],
        ['POSTI',b=>esc(b.posti_selezionati||'Da verificare')],
        ['PAGATO',b=>euro(b.pagato)],
        ['AZIONE',b=>isDemo()?'<span class="small-note">Anteprima</span>':`<button type="button" class="btn-secondary" data-dg3-open-move="${esc(b.id)}">Sposta data</button>`]
      ]))+
      cardInfo('Il trasferimento richiede la migrazione SQL 0.7 e un collaudo in staging. Non divide il gruppo e non sovrascrive prenotazioni esistenti. La nuova conferma deve essere rigenerata.', 'info');
  }
  renders.moves=movePage;
  async function openMoveModal(selectedId=''){
    requireLive();preview=null;
    const [bookings,trips]=await Promise.all([data('bookings'),data('trips')]);
    const active=bookings.filter(allActive).filter(b=>!b.checkin_effettuato);
    if(!active.length)throw Error('Nessuna prenotazione spostabile');
    const bookingOptions=active.map(b=>[b.id,`${b.cliente_nome||b.cliente} · ${trips.find(t=>t.id===b.viaggio_id)?.data_partenza||'?'} · ${b.posti} posti · pagato ${euro(b.pagato)}`]);
    modal('Sposta prenotazione · riassegnazione automatica',
      `<form id="dg3-move-form" class="dg3-rich-form">
        <div class="form-grid">
          ${formSelect('Prenotazione','booking_id',bookingOptions)}
          <label class="field"><span>Nuova data e autobus</span><select name="target_trip_id" required></select></label>
          ${formInput('Nuova fermata (facoltativo)','target_stop','text',{placeholder:'Se vuota mantiene quella attuale'})}
        </div>
        <p class="small-note">I pagamenti già registrati non vengono duplicati. Non cambia il prezzo del viaggio senza una revisione separata.</p>
        <div class="dg3-preview-box" id="dg3-move-preview">Seleziona la prenotazione e premi «Calcola posti liberi».</div>
        <p id="dg3-move-error" class="auth-error" hidden role="alert"></p>
        <div class="modal-footer"><button type="button" class="btn-secondary" data-dismiss="1">Annulla</button>
          <button type="button" class="btn-secondary" data-dg3-preview="1">Calcola posti liberi</button>
          <button type="submit" class="btn btn-main" id="dg3-move-confirm" disabled>Conferma spostamento</button>
        </div>
      </form>`);
    const form=document.getElementById('dg3-move-form');
    if(selectedId&&active.some(b=>b.id===selectedId))form.elements.booking_id.value=selectedId;
    function fillDates(){const b=active.find(x=>x.id===form.elements.booking_id.value);
      const options=b?chooseMoveDates(trips,b):[];
      form.elements.target_trip_id.innerHTML=options.map(t=>`<option value="${esc(t.id)}">${esc(t.titolo||t.destinazione)} · ${esc(t.data_partenza)} · ${t.posti_occupati||0}/${t.posti_totali} posti</option>`).join('');
      if(!options.length)form.elements.target_trip_id.innerHTML='<option value="">Nessuna altra data disponibile</option>';
      form.elements.target_stop.value=''; resetPreview();
    }
    form.elements.booking_id.addEventListener('change',fillDates);
    form.elements.target_trip_id.addEventListener('change',resetPreview);
    form.elements.target_stop.addEventListener('input',resetPreview);
    fillDates();
  }
  function resetPreview(){preview=null;const field=document.getElementById('dg3-move-preview');
    if(field)field.textContent='Ricalcola l’anteprima prima di salvare.';
    const confirmButton=document.getElementById('dg3-move-confirm');if(confirmButton)confirmButton.disabled=true;
  }
  async function computePreview(form){requireLive();const bookingId=form.elements.booking_id.value,tripId=form.elements.target_trip_id.value;
    if(!tripId)throw Error('Seleziona una seconda data disponibile');
    const result=await DGData.rpc('dg3_preview_spostamento_data_v1',{
      p_booking_id:bookingId,p_target_trip_id:tripId
    });
    if(!result||result.success!==true||!Array.isArray(result.new_seats))throw Error('Supabase non ha confermato un piano di spostamento');
    preview=result;
    const box=document.getElementById('dg3-move-preview');
    box.innerHTML=`<div class="dg3-detail"><strong>Anteprima della nuova prenotazione</strong>
      <p><strong>Da:</strong> ${esc(result.source_date)} → <strong>A:</strong> ${esc(result.target_date)}</p>
      <p><strong>Posti vecchi:</strong> ${esc((result.old_seats||[]).join(', ')||'Da verificare')}</p>
      <p><strong>Nuovi posti:</strong> <span class="dg3-placed">${esc(result.new_seats.join(' · '))}</span></p>
      <p><strong>Persone:</strong> ${esc(result.passengers)} · <strong>Già versato:</strong> ${euro(result.amount_paid)} · <strong>Saldo:</strong> ${euro(result.amount_due)}</p>
      ${result.price_review_required?`<p class="small-note">La tariffa della nuova data è diversa: verificare sconto o differenza a parte. Nessun importo sarà modificato automaticamente.</p>`:''}
      <p><strong>Esito:</strong> ${result.original_seats_preserved?'Posti originali disponibili':'Posti liberi alternativi, senza togliere posti ad altri clienti'}</p>
      ${result.new_trip_minimum_reached?'':`<p class="small-note">Attenzione: il nuovo viaggio potrebbe non aver raggiunto il minimo di partecipanti.</p>`}
      <p class="small-note">Dopo il trasferimento è necessaria una nuova conferma PDF. Le ricevute degli incassi precedenti restano archiviate.</p>
    </div>`;
    document.getElementById('dg3-move-confirm').disabled=false;
  }
  async function commitMove(form){requireLive();if(!preview)throw Error('Prima calcola e verifica l’anteprima');
    if(preview.booking_id!==form.elements.booking_id.value||preview.target_trip_id!==form.elements.target_trip_id.value)throw Error('Anteprima non più valida');
    const money=euro(preview.amount_paid),seats=preview.new_seats.join(', ');
    if(!window.confirm(`CONFERMI LO SPOSTAMENTO?\n\nDa ${preview.source_date} a ${preview.target_date}\nNuovi posti: ${seats}\nImporto già incassato: ${money} (INVARIATO)\n\nLa vecchia conferma va rigenerata; nessun nuovo pagamento sarà creato.`))return;
    const result=await DGData.rpc('dg3_sposta_prenotazione_data_v1',{
      p_booking_id:preview.booking_id,p_target_trip_id:preview.target_trip_id,
      p_expected_source_trip_id:preview.source_trip_id,p_expected_seats:preview.new_seats,
      p_target_stop:form.elements.target_stop.value.trim()||null
    });
    if(result?.success!==true||result.moved!==true)throw Error('Spostamento non confermato da Supabase');
    await revalidate(['trips','bookings','seatrows','payments','cashoperators','receiptarchive']);
    closeModal();toast('Prenotazione spostata! Rigenera la conferma della nuova data.');go('bookings');
  }
  async function invoicePage(){
    const preface=sec('Fatturazione integrata · bozze','Documento fiscale in preparazione: invio SdI disabilitato fino a configurazione e approvazione')+
      `<div class="action-row"><button type="button" class="btn btn-main" data-dg3-new-invoice="1">＋ Prepara bozza fattura</button> <button type="button" class="btn-secondary" data-dg3-export-invoices="1">⇩ CSV per il commercialista</button></div>`+
      cardInfo('Questa sezione crea BOZZE interne senza numero fiscale. NON emette fatture SdI: occorrono dati dell’emittente, regime IVA verificato, canale SdI/provider e conservazione a norma. Particolare attenzione alle operazioni eventualmente soggette all’art. 74-ter.', 'warn');
    if(isDemo())return preface+mainPanel('Bozze',cardInfo('Anteprima grafica: non contiene fatture aziendali.', 'info'));
    let list=[];
    try{list=await data('invoices');}catch(e){return preface+cardInfo('Archivio bozze non ancora installato sul database: eseguire la migrazione SQL 0.7 in staging, collaudare e autorizzare la messa in produzione. Dettaglio: '+e.message,'warn');}
    return preface+mainPanel('Registro bozze fatture',table(list,[
      ['DATA',r=>esc(r.data_bozza)],['DOCUMENTO',r=>esc(r.tipo_documento)],
      ['DESTINATARIO',r=>esc(r.destinatario?.denominazione||'—')],
      ['TOTALE',r=>DGInvoiceCore.eur(r.totale_centesimi)],
      ['STATO',r=>status(r.stato)],
      ['AZIONI',r=>`<button type="button" class="btn-secondary" data-dg3-print-invoice="${esc(r.id)}">Stampa bozza PDF</button>`]
    ]));
  }
  renders.invoices=invoicePage;
  async function openInvoiceForm(){requireLive();
    const [bs,rs]=await Promise.all([data('bookings'),data('rentals')]);
    const refs=[['manuale','Documento manuale'],
      ...bs.filter(allActive).map(b=>['prenotazione:'+b.id,`Prenotazione · ${b.cliente_nome||b.cliente} · ${b.posti} persone`]),
      ...rs.map(r=>['noleggio:'+r.id,`Noleggio · ${r.referente||r.azienda||'cliente'} · ${r.data_partenza}`])];
    modal('Nuova bozza fattura · NON EMESSA',
      `<form id="dg3-invoice-form"><div class="form-grid">
        ${formSelect('Documento collegato','riferimento',refs)}
        ${formSelect('Tipo bozza','tipo_documento',[['immediata','Fattura immediata'],['acconto','Acconto'],['saldo','Saldo'],['differita','Differita'],['nota_credito','Nota di credito']])}
        ${formInput('Data bozza','data_bozza','date',{value:fieldDate(),required:true})}
        ${formInput('Ragione sociale emittente','ragione_sociale','text',{required:true,placeholder:'Dati aziendali ufficiali'})}
        ${formInput('Partita IVA emittente','partita_iva','text',{required:true})}
        ${formInput('Regime fiscale emittente','regime_fiscale','text',{required:true,placeholder:'Es. RF01 / RF11, da verificare'})}
        ${formInput('Indirizzo emittente','indirizzo_emittente','text',{required:true})}
        ${formInput('CAP emittente','cap_emittente','text',{required:true})}
        ${formInput('Comune emittente','comune_emittente','text',{required:true})}
        ${formInput('Denominazione destinatario','denominazione','text',{required:true})}
        ${formInput('Partita IVA destinatario (se presente)','partita_iva_cliente','text')}
        ${formInput('Codice fiscale destinatario (se presente)','codice_fiscale_cliente','text')}
        ${formInput('Indirizzo destinatario','indirizzo_cliente','text',{required:true})}
        ${formInput('CAP destinatario','cap_cliente','text',{required:true})}
        ${formInput('Comune destinatario','comune_cliente','text',{required:true})}
        ${formInput('Codice destinatario (se noto)','codice_destinatario','text')}
        ${formInput('PEC destinatario (se nota)','pec','email')}
        ${formInput('Descrizione servizio','descrizione','text',{required:true,placeholder:'Descrizione dettagliata del servizio'})}
        ${formInput('Quantità','quantita','number',{required:true,value:1,min:1,max:10000})}
        ${formInput('Imponibile unitario (€)','prezzo_unitario','number',{required:true,min:0.01,step:'0.01'})}
        ${formInput('Aliquota IVA % (NON automatica)','aliquota_iva','number',{required:true,min:0,max:100,step:'0.01'})}
        ${formInput('Natura IVA, se aliquota zero','natura_iva','text',{placeholder:'Es. N2.2, da convalidare'})}
        ${formInput('Note interne','note_interne','text')}
      </div><p class="small-note">I calcoli sono fatti in centesimi. L’aliquota e il regime devono essere verificati con il commercialista; il modulo non decide il trattamento fiscale dei viaggi.</p>
      <div class="dg3-preview-box" id="dg3-invoice-preview">Documento ancora da compilare.</div>
      <p class="auth-error" id="dg3-invoice-error" hidden role="alert"></p>
      <div class="modal-footer"><button type="button" class="btn-secondary" data-dismiss="1">Annulla</button>
        <button type="button" class="btn-secondary" data-dg3-calc-invoice="1">Calcola e verifica</button>
        <button type="submit" class="btn btn-main">Salva bozza in Supabase</button>
      </div></form>`);
  }
  function buildInvoiceFromForm(form){const v=Object.fromEntries(new FormData(form));const parts=String(v.riferimento).split(':');
    const ref=parts[0]==='manuale'?{tipo:'manuale'}:{tipo:parts[0],id:parts.slice(1).join(':')};
    return DGInvoiceCore.buildDraft({
      tipo_documento:v.tipo_documento,data_bozza:v.data_bozza,riferimento:ref,
      emittente:{ragione_sociale:v.ragione_sociale,partita_iva:v.partita_iva,regime_fiscale:v.regime_fiscale,
        indirizzo:v.indirizzo_emittente,cap:v.cap_emittente,comune:v.comune_emittente},
      destinatario:{denominazione:v.denominazione,partita_iva:v.partita_iva_cliente,codice_fiscale:v.codice_fiscale_cliente,
        indirizzo:v.indirizzo_cliente,cap:v.cap_cliente,comune:v.comune_cliente,
        codice_destinatario:v.codice_destinatario,pec:v.pec},
      righe:[{descrizione:v.descrizione,quantita:Number(v.quantita),prezzo_unitario:v.prezzo_unitario}],
      aliquota_iva:v.aliquota_iva,natura_iva:v.natura_iva,note_interne:v.note_interne
    });
  }
  function showInvoicePreview(form){const doc=buildInvoiceFromForm(form),warnings=DGInvoiceCore.readiness(doc);
    document.getElementById('dg3-invoice-preview').innerHTML=`<strong>BOZZA NON FISCALE</strong><p>Imponibile: ${DGInvoiceCore.eur(doc.imponibile_centesimi)} · IVA calcolata: ${DGInvoiceCore.eur(doc.iva_centesimi)} · Totale: <strong>${DGInvoiceCore.eur(doc.totale_centesimi)}</strong></p>
      <p>${esc(doc.righe[0].descrizione)} · ${esc(doc.righe[0].quantita)} unità</p>
      <p class="small-note">Prima dell’emissione: ${warnings.map(x=>esc(x)).join(' · ')}</p>`;
    return doc;
  }
  async function saveInvoice(form){requireLive();const doc=showInvoicePreview(form);
    if(!window.confirm('Salvare questa BOZZA non fiscale in Supabase? Non verrà inviata allo SdI e non avrà numero di fattura.'))return;
    const record={...doc};delete record.totale_centesimi;
    await DGData.insert('dg3_fatture_bozze',record);
    await revalidate(['invoices']);closeModal();toast('Bozza salvata (non emessa).');go('invoices');
  }
  async function printInvoiceDraft(id){requireLive();const r=(await data('invoices')).find(x=>x.id===id);if(!r)throw Error('Bozza non trovata');
    const doc=`<section class="print-sheet"><div class="dg-print-brand"><img src="assets/logo-delgrosso.png" alt="Logo DELGROSSO"><div class="dg-print-brand-text"><h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>BOZZA DI DOCUMENTO — NON È UNA FATTURA FISCALE</h2><p>Nessun numero fiscale assegnato · NON INVIATA AL SDI</p></div></div>
    <table><tbody><tr><th>Data</th><td>${esc(r.data_bozza)}</td></tr>
    <tr><th>Emittente</th><td>${esc(r.emittente?.ragione_sociale||'')}</td></tr>
    <tr><th>Destinatario</th><td>${esc(r.destinatario?.denominazione||'')}</td></tr>
    <tr><th>Tipo</th><td>${esc(r.tipo_documento||'')}</td></tr>
    ${((r.righe||[]).map(l=>`<tr><th>Servizio</th><td>${esc(l.descrizione)} · quantità ${esc(l.quantita)}</td></tr>`)).join('')}
    <tr><th>Imponibile</th><td>${DGInvoiceCore.eur(r.imponibile_centesimi)}</td></tr>
    <tr><th>IVA</th><td>${DGInvoiceCore.eur(r.iva_centesimi)}</td></tr>
    <tr><th>Totale bozza</th><td><strong>${DGInvoiceCore.eur(r.totale_centesimi)}</strong></td></tr></tbody></table>
    <p>DOCUMENTO GESTIONALE NON FISCALE. Per l'emissione è obbligatorio il processo di verifica, numerazione, XML, trasmissione SdI e conservazione conforme.</p></section>`;
    const element=document.createElement('div');element.id='dg-print-only';element.innerHTML=doc;document.body.append(element);
    const clean=()=>element.remove();window.addEventListener('afterprint',clean,{once:true});window.print();setTimeout(clean,120000);
  }
  function showError(formId,message){const holder=document.getElementById(formId);if(holder){holder.textContent=message;holder.hidden=false;}else toast(message);}
  document.addEventListener('click',async function(event){
    const move=event.target.closest('[data-dg3-open-move]');
    const plan=event.target.closest('[data-dg3-preview]');
    const make=event.target.closest('[data-dg3-new-invoice]');
    const calc=event.target.closest('[data-dg3-calc-invoice]');
    const print=event.target.closest('[data-dg3-print-invoice]');
    const exportInvoices=event.target.closest('[data-dg3-export-invoices]');
    try{
      if(move)await openMoveModal(move.dataset.dg3OpenMove==='1'?'':move.dataset.dg3OpenMove);
      if(plan){document.getElementById('dg3-move-error').hidden=true;await computePreview(document.getElementById('dg3-move-form'));}
      if(make)await openInvoiceForm();
      if(calc){document.getElementById('dg3-invoice-error').hidden=true;showInvoicePreview(document.getElementById('dg3-invoice-form'));}
      if(print)await printInvoiceDraft(print.dataset.dg3PrintInvoice);
      if(exportInvoices){requireLive();const records=await data('invoices');
        const cols=[['DATA','TIPO','STATO','EMITTENTE','PIVA_EMITTENTE','DESTINATARIO','PIVA_DESTINATARIO','CF_DESTINATARIO','IMPONIBILE_EUR','IVA_EUR','TOTALE_EUR']];
        DGData.downloadCSV(cols.concat(records.map(r=>[r.data_bozza,r.tipo_documento,r.stato,r.emittente?.ragione_sociale,r.emittente?.partita_iva,r.destinatario?.denominazione,r.destinatario?.partita_iva,r.destinatario?.codice_fiscale,(Number(r.imponibile_centesimi||0)/100).toFixed(2),(Number(r.iva_centesimi||0)/100).toFixed(2),(Number(r.totale_centesimi||0)/100).toFixed(2)])),'DELGROSSO_BOZZE_FATTURE_USO_COMMERCIALISTA.csv');
      }
    }catch(err){showError(plan?'dg3-move-error':calc?'dg3-invoice-error':null,err.message)}
  });
  document.addEventListener('submit',async function(event){
    if(event.target.id!=='dg3-move-form'&&event.target.id!=='dg3-invoice-form')return;
    event.preventDefault();const form=event.target;
    const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
    try{if(form.id==='dg3-move-form')await commitMove(form);else await saveInvoice(form);}
    catch(err){showError(form.id==='dg3-move-form'?'dg3-move-error':'dg3-invoice-error',err.message)}
    finally{if(submit&&document.body.contains(submit))submit.disabled=false;}
  });
})();
