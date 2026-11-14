/* DELGROSSO VIAGGI 3.0 v1.1. Moduli Cassa giornaliera e Fornitori/Costi viaggio.
 * Tutti i calcoli autorevoli e le scritture monetarie sono RPC server-side opzionali;
 * prima della migrazione la UI permette soltanto simulazioni/previsione.
 */
(function(){'use strict';
 const H=window.DG11Core;
 if(!H||!window.DGData||typeof NAV==='undefined'||typeof renders==='undefined')return;
 const itDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let cashDate=itDate(),lastPreview=null,lastMode='';
 const txt=x=>esc(x??'');
 const fval=(value)=>value==null?'':String(value);
 const err=e=>{toast(String(e?.message||e));};
 const disabledDemo=()=>isDemo()?cardInfo('Anteprima con dati sintetici: per modificare le casse è necessario l’accesso operatore Supabase.','warn'):'';
 const btn=(name,label,id='')=>`<button type="button" class="btn-secondary" data-dg11="${txt(name)}" data-id="${txt(id)}">${txt(label)}</button>`;
 const input=(label,name,value='',type='text',opts='')=>`<label class="field"><span>${txt(label)}</span><input name="${txt(name)}" type="${txt(type)}" value="${txt(fval(value))}" ${opts}></label>`;
 const field=(label,name,value='',opts='')=>`<label class="field"><span>${txt(label)}</span><textarea name="${txt(name)}" rows="3" ${opts}>${txt(fval(value))}</textarea></label>`;
 const select=(label,name,values,selected)=>`<label class="field"><span>${txt(label)}</span><select name="${txt(name)}">${values.map(([k,v])=>`<option value="${txt(k)}" ${String(k)===String(selected)?'selected':''}>${txt(v)}</option>`).join('')}</select></label>`;
 const cats=[['Carburante','Carburante'],['Pedaggi','Pedaggi e autostrade'],['Autista','Autisti'],['Parcheggio','Parcheggio'],['Ristorazione','Ristorazione'],['Manutenzione','Manutenzione'],['Noleggio mezzo','Noleggio mezzo'],['Servizi','Servizi esterni'],['Altro','Altro']];
 const methods=[['','Seleziona metodo'],['Contanti','Contanti'],['POS','POS / carta'],['Bonifico','Bonifico'],['Altro','Altro']];
 const demoClosures=[{id:'demo-chiusura',data_chiusura:'2026-11-10',operatore_user_id:'demo-nicola',operatore:'Nicola',saldo_teorico:500,contanti_contati:500,differenza:0}];
 const demoLedger=[{id:'demo-incasso',tipo:'Entrata',operatore_user_id:'demo-nicola',importo:120,metodo:'Contanti',data_movimento:'2026-11-11',origine:'automatico_pagamento'},
   {id:'demo-pedaggio',tipo:'Uscita',operatore_user_id:'demo-nicola',importo:35,metodo:'Contanti',data_movimento:'2026-11-11',origine:'dg11_costo_viaggio'}];
 function resolveDemo(){const x=H.preview({operatorId:'demo-nicola',date:'2026-11-11',closures:demoClosures,ledger:demoLedger});return {...x,data:'2026-11-11'};}
 async function snapshot(){
   if(isDemo()){lastMode='demo';return resolveDemo();}
   const [closures,ledger,transfers]=await Promise.all([DGData.rows('cashClosures'),DGData.rows('economy'),DGData.rows('transfers')]);
   const uid=DGData.actor?.id;
   // Il browser ricostruisce un'anteprima in caso di funzione SQL non ancora installata;
   // il pulsante CONFERMA resta DISABILITATO senza la RPC autorevole.
   const local=H.preview({operatorId:uid,date:cashDate,closures,ledger,transfers});
   try{
     const server=await DGData.rpc('dg11_anteprima_cassa_v1',{p_data:cashDate});
     if(server?.saldo_teorico===undefined)throw Error('Riepilogo server incompleto');
     if(H.cents(server.saldo_teorico)!==H.cents(local.saldo_teorico)){
       lastMode='mismatch';return {...server,disallineamento:true,locale:local.saldo_teorico};
     }
     lastMode='server';return server;
   }catch(ex){lastMode='local';return {...local,rpc_error:ex.message};}
 }
 function line(label,value,mark=''){return `<div class="dg11-line"><span>${txt(label)}</span><strong class="${mark}">${euro(value)}</strong></div>`}
 async function cashPage(){
   const p=await snapshot();lastPreview=p;
   const closeRows=isDemo()?demoClosures:(await DGData.rows('cashClosures')).filter(r=>r.operatore_user_id===DGData.actor?.id).sort((a,b)=>String(b.data_chiusura).localeCompare(String(a.data_chiusura)));
   const isClosed=!!p.gia_chiusa, mayClose=!isDemo()&&lastMode==='server'&&!isClosed&&!p.saldo_iniziale_non_verificato&&!p.disallineamento;
   return sec('Chiusura cassa giornaliera','Saldo precedente + movimenti contanti non duplicati · cassa personale Nicola / Raffaele')+
   disabledDemo()+
   (lastMode==='local'?cardInfo('La funzione di chiusura SQL non è stata ancora attivata: visualizzi una stima, ma non puoi confermare la chiusura. '+p.rpc_error,'warn'):'')+
   (lastMode==='mismatch'?cardInfo('CONTEGGI DIVERGENTI fra browser e Supabase: blocco precauzionale della chiusura; occorre una riconciliazione.','warn'):'')+
   (p.saldo_iniziale_non_verificato?cardInfo('Nessuna precedente chiusura verificata per il profilo: il saldo iniziale va approvato prima di chiudere.','warn'):'')+
   (isClosed?cardInfo('Questa giornata risulta già chiusa. Non è possibile registrare una seconda chiusura: usare una rettifica tracciata.','info'):'')+
   `<div class="panel dg11-panel"><div class="dg11-top"><label class="field"><span>Giornata da verificare</span><input id="dg11-date" type="date" value="${txt(isDemo()?'2026-11-11':cashDate)}" ${isDemo()?'disabled':''}></label>${btn('recalc','↻ Ricalcola')}</div>`+
   `<div class="dg11-money-grid"><div><span>Saldo dalla precedente chiusura</span><strong>${euro(p.saldo_precedente)}</strong><small>Ultima chiusura: ${txt(p.data_ultima_chiusura||'non verificata')}</small></div><div><span>Incassi registrati in contanti</span><strong>${euro(p.incassi_contanti)}</strong><small>Incassi viaggi, noleggi ed extra, contati una sola volta</small></div><div><span>Saldo teorico da contare</span><strong>${euro(p.saldo_teorico)}</strong><small>Prima di confermare, verifica i contanti fisici</small></div></div>`+
   `<div class="dg11-breakdown">${line('Saldo precedente',p.saldo_precedente)}${line('Incassi contanti da ultima chiusura',p.incassi_contanti,'dg11-plus')}${line('Uscite contanti (spese e rimborsi)',-Number(p.uscite_contanti),'dg11-minus')}${line('Trasferimenti ricevuti',p.trasferimenti_entrata,'dg11-plus')}${line('Trasferimenti consegnati',-Number(p.trasferimenti_uscita),'dg11-minus')}<div class="dg11-total">${line('TOTALE TEORICO',p.saldo_teorico)}</div></div>`+
   `<div class="action-row">${btn('income-new','＋ Registra contanti ricevuti oggi')}${btn('cash-csv','⇩ Scarica registro chiusure CSV')}</div>`+
   `<form id="dg11-close" class="dg11-close-form"><h3>Chiusura e quadratura</h3><p class="small-note">Inserisci il totale fisico dei contanti presenti in cassa (non soltanto i nuovi incassi). Il sistema calcola automaticamente eventuale differenza rispetto al saldo teorico.</p><div class="form-grid">${input('Contanti effettivamente contati (€)','counted',p.saldo_teorico,'number','required min="0" step="0.01"')}${field('Note di chiusura','note','','maxlength="1500"')}</div><p id="dg11-diff" class="dg11-diff">Differenza: ${euro(0)}</p><button class="btn btn-main" type="submit" ${mayClose?'':'disabled'}>🔒 Conferma chiusura cassa</button></form></div>`+
   mainPanel('Storico delle chiusure del tuo profilo',table(closeRows,[['DATA',r=>txt(r.data_chiusura)],['TEORICO',r=>euro(r.saldo_teorico)],['CONTANTI CONTATI',r=>euro(r.contanti_contati)],['DIFFERENZA',r=>euro(r.differenza)],['NOTE',r=>txt(r.note||'—')]]))+
   cardInfo('Il riepilogo usa il registro economia_movimenti come fonte unica per gli incassi già contabilizzati (comprese le copie automatiche dei pagamenti): NON li somma di nuovo dalla tabella pagamenti. Incassi POS e bonifici non entrano nel conteggio dei contanti.','info');
 }
 function suppliersDemo(){return [{id:'demo-fornitore',ragione_sociale:'Fornitore dimostrativo',categoria:'Carburante',telefono:'',email:'',attivo:true}];}
 async function suppliersPage(){const rows=isDemo()?suppliersDemo():await DGData.rows('suppliers');
   return sec('Fornitori aziendali','Anagrafica con modifica, storico e disattivazione, collegabile ai costi di viaggio')+disabledDemo()+
   `<div class="action-row">${btn('supplier-new','＋ Nuovo fornitore')}${btn('suppliers-csv','⇩ Esporta fornitori CSV')}</div>`+
   mainPanel('Rubrica fornitori',table(rows,[['RAGIONE SOCIALE',r=>`<b>${txt(r.ragione_sociale)}</b>`],['CATEGORIA',r=>txt(r.categoria)],['TELEFONO',r=>txt(r.telefono)],['EMAIL',r=>txt(r.email)],['STATO',r=>status(r.attivo?'Attivo':'Disattivo')],['GESTIONE',r=>isDemo()?'—':btn('supplier-edit','✎ Modifica',r.id)]]));
 }
 async function costsPage(){const trips=isDemo()?DTRIPS:await data('trips');const suppliers=isDemo()?suppliersDemo():await DGData.rows('suppliers');
   let costs=[],error='';if(isDemo()){costs=[{id:'demo-cost',viaggio_id:'demo-napoli',fornitore_id:'demo-fornitore',categoria:'Carburante',descrizione:'Carburante bus GT',importo_previsto:180,stato:'Previsto'}]}else{try{costs=await DGData.rows('tripCosts')}catch(ex){error=ex.message}}
   const tripId=document.querySelector('#dg11-trip-filter')?.value||window.DG11SelectedTrip||trips[0]?.id||'';
   window.DG11SelectedTrip=trips.some(x=>x.id===tripId)?tripId:(trips[0]?.id||'');const current=window.DG11SelectedTrip;
   const allBookings=isDemo()?DBOOKINGS:await data('bookings');const metrics=H.margin({bookings:allBookings,costs,tripId:current});
   const tripLabel=x=>`${x.titolo||x.destinazione} · ${x.data_partenza}`;
   const filtered=costs.filter(c=>!current||c.viaggio_id===current);
   const names=Object.fromEntries(suppliers.map(s=>[s.id,s.ragione_sociale]));
   return sec('Fornitori e costi viaggio','Spese previste e pagate collegate a ogni viaggio · margine previsionale')+disabledDemo()+
   (error?cardInfo('Archivio costi non ancora attivo in Supabase. Applicare e collaudare prima la migrazione in staging: '+error,'warn'):'')+
   `<div class="action-row">${btn('cost-new','＋ Aggiungi costo viaggio')}${btn('costs-csv','⇩ Esporta costi CSV')}${btn('supplier-new','＋ Aggiungi fornitore')}</div>`+
   `<section class="panel dg11-panel"><div class="dg11-top"><label class="field"><span>Viaggio</span><select id="dg11-trip-filter">${trips.map(t=>`<option value="${txt(t.id)}" ${t.id===current?'selected':''}>${txt(tripLabel(t))}</option>`).join('')}</select></label></div>`+
   `<div class="dg11-money-grid"><div><span>Ricavi previsti</span><strong>${euro(metrics.ricavi_previsti)}</strong><small>Quote prenotazioni non annullate</small></div><div><span>Costi previsti</span><strong>${euro(metrics.costi_previsti)}</strong><small>Da schede costo, non include tutte le imposte</small></div><div><span>Margine previsionale</span><strong>${euro(metrics.margine_previsionale)}</strong><small>Ricavi meno costi; NON utile fiscale</small></div></div>`+
   `<div class="metric-belt"><div class="mini-metric"><strong>${euro(metrics.incassato)}</strong><span>Incassato dai clienti</span></div><div class="mini-metric"><strong>${euro(metrics.costi_pagati)}</strong><span>Costi già pagati</span></div><div class="mini-metric"><strong>${euro(metrics.residuo_clienti)}</strong><span>Residui clienti</span></div></div></section>`+
   mainPanel('Costi del viaggio selezionato',table(filtered,[['CATEGORIA',r=>txt(r.categoria)],['FORNITORE',r=>txt(names[r.fornitore_id]||'—')],['DESCRIZIONE',r=>txt(r.descrizione)],['IMPORTO',r=>euro(r.importo_previsto)],['STATO',r=>status(r.stato)],['AZIONE',r=>isDemo()?'—':r.stato==='Previsto'?btn('cost-edit','✎ Modifica / Paga',r.id):'<span class="chip">Registrato</span>']]))+
   cardInfo('La registrazione di un costo PAGATO genera una sola uscita nel registro economia_movimenti. Se il metodo è POS o bonifico non riduce la cassa in contanti. I costi già pagati non sono liberamente cancellabili: eventuali rettifiche sono tracciate.','info');
 }
 function openIncome(){if(isDemo())return toast('Funzione riservata agli operatori');const now=itDate();
   modal('Registra contanti extra ricevuti',`<form id="dg11-income" data-request-id="${crypto.randomUUID()}"><div class="form-grid">${input('Data incasso','date',cashDate,'date','required max="'+now+'"')}${input('Importo contanti non ancora registrati (€)','amount','','number','required min="0.01" step="0.01"')}${field('Causale / da chi ricevuti','description','','required minlength="8" maxlength="500"')}</div><label class="dg11-check"><input type="checkbox" name="unrecorded" required> Confermo che questa somma NON è già stata registrata come acconto, saldo, pagamento noleggio o altro movimento.</label><p class="small-note">Esempio: hai ricevuto 150 €, ma 100 € sono già registrati come acconto. Devi inserire qui solo i 50 € ancora mancanti dalla contabilità.</p><div class="action-row"><button type="submit" class="btn btn-main">Registra entrata verificata</button></div></form>`);
 }
 async function openSupplier(id=''){if(isDemo())return toast('Modalità demo: nessuna scrittura');const rows=await DGData.rows('suppliers');const x=rows.find(r=>r.id===id)||{};
   modal(id?'Modifica fornitore':'Nuovo fornitore',`<form id="dg11-supplier" data-id="${txt(id)}"><div class="form-grid">${input('Ragione sociale','ragione_sociale',x.ragione_sociale,'text','required maxlength="180"')}${select('Categoria','categoria',cats,x.categoria||'Altro')}${input('Referente','referente',x.referente)}${input('Telefono','telefono',x.telefono,'tel')}${input('Email','email',x.email,'email')}${input('Partita IVA','partita_iva',x.partita_iva,'text','maxlength="16"')}${input('Codice fiscale','codice_fiscale',x.codice_fiscale)}${input('Indirizzo','indirizzo',x.indirizzo)}${input('Città','citta',x.citta)}${select('Stato','attivo',[['true','Attivo'],['false','Disattivo']],String(x.attivo!==false))}${field('Note','note',x.note,'maxlength="1500"')}</div><div class="action-row"><button type="submit" class="btn btn-main">Salva fornitore</button></div></form>`);
 }
 async function openCost(id=''){if(isDemo())return toast('Modalità demo: nessuna scrittura');const [trips,suppliers,costs]=await Promise.all([data('trips'),DGData.rows('suppliers'),DGData.rows('tripCosts')]);const c=costs.find(x=>x.id===id)||{};
   if(id&&!c.id)throw Error('Costo non trovato');if(c.stato==='Pagato')throw Error('Costo pagato: richiedere una rettifica contabile, non modificarlo');
   modal(id?'Modifica costo / registra pagamento':'Nuovo costo di viaggio',`<form id="dg11-cost" data-id="${txt(id)}"><div class="form-grid">${select('Viaggio','viaggio_id',trips.map(t=>[t.id,`${t.titolo||t.destinazione} · ${t.data_partenza}`]),c.viaggio_id||window.DG11SelectedTrip||trips[0]?.id)}${select('Fornitore','fornitore_id',[['','Nessuno / da indicare'],...suppliers.filter(x=>x.attivo||x.id===c.fornitore_id).map(s=>[s.id,s.ragione_sociale])],c.fornitore_id)}${select('Categoria','categoria',cats,c.categoria||'Carburante')}${input('Descrizione costo','descrizione',c.descrizione,'text','required minlength="3" maxlength="500"')}${input('Importo totale (€)','importo_previsto',c.importo_previsto??'', 'number','required min="0" step="0.01"')}${select('Stato','stato',[['Previsto','Preventivato (nessuna uscita di cassa)'],['Pagato','Pagato (registra uscita contabile)']],c.stato||'Previsto')}${select('Metodo di pagamento','metodo',methods,c.metodo||'')}${input('Data competenza / pagamento','data_costo',c.data_costo||itDate(),'date','required')}${input('Numero documento','numero_documento',c.numero_documento,'text','maxlength="90"')}${field('Note','note',c.note,'maxlength="1500"')}</div><p class="small-note">Se imposti Pagato, un movimento viene aggiunto al registro delle spese una sola volta; non potrai più cambiare liberamente l’importo.</p><div class="action-row"><button type="submit" class="btn btn-main">Salva costo</button></div></form>`);
 }
 async function submitIncome(form){const v=Object.fromEntries(new FormData(form));if(!v.unrecorded)throw Error('Conferma che la somma non è già stata contabilizzata');const amount=H.money(H.cents(v.amount));if(amount<=0)throw Error('L’importo deve essere positivo');if(String(v.description||'').trim().length<8)throw Error('Descrizione troppo breve');
   if(!confirm(`Confermi una NUOVA entrata contanti di ${euro(amount)}?\nNon deve essere già presente fra gli incassi di viaggi o noleggi.`))return;
   const out=await DGData.rpc('dg11_incasso_extra_v1',{p_data:v.date,p_importo:amount,p_descrizione:v.description.trim(),p_riferimento:form.dataset.requestId});if(out?.success!==true)throw Error('Incasso non confermato');closeModal();cache={};toast('Nuovo incasso registrato in cassa');go('cashClosing');
 }
 async function submitSupplier(form){const v=Object.fromEntries(new FormData(form)),id=form.dataset.id||'';if(!String(v.ragione_sociale||'').trim())throw Error('Inserisci la ragione sociale');
   const fields={ragione_sociale:v.ragione_sociale.trim(),categoria:v.categoria,referente:v.referente||null,telefono:v.telefono||null,email:v.email||null,partita_iva:v.partita_iva||null,codice_fiscale:v.codice_fiscale||null,indirizzo:v.indirizzo||null,citta:v.citta||null,attivo:v.attivo==='true',note:v.note||null};
   if(!confirm(`${id?'Aggiornare':'Creare'} il fornitore «${v.ragione_sociale}»?`))return;
   if(id)await DGData.update('fornitori',id,fields);else await DGData.insert('fornitori',fields);
   closeModal();cache={};toast('Fornitore salvato su Supabase');go('suppliers');
 }
 async function submitCost(form){const v=Object.fromEntries(new FormData(form));const amount=H.money(H.cents(v.importo_previsto));if(amount<0)throw Error('Costo non valido');if(v.stato==='Pagato'&&(!v.metodo||amount===0))throw Error('Se il costo è pagato, indica importo e metodo');
   const params={viaggio_id:v.viaggio_id,fornitore_id:v.fornitore_id||null,descrizione:v.descrizione.trim(),categoria:v.categoria,importo_previsto:amount,stato:v.stato,metodo:v.metodo||null,data_costo:v.data_costo,numero_documento:v.numero_documento,note:v.note};
   if(!confirm(`${v.stato==='Pagato'?'REGISTRARE USCITA':'SALVARE COSTO'} di ${euro(amount)}?\n${v.stato==='Pagato'?'L’uscita resterà nello storico e non sarà cancellabile liberamente.':'Il costo è previsto: non verrà detratto dalla cassa finché non sarà pagato.'}`))return;
   const out=await DGData.rpc('dg11_salva_costo_viaggio_v1',{p_id:form.dataset.id||null,p_dati:params});if(out?.success!==true)throw Error('Registrazione del costo non confermata');closeModal();cache={};toast('Costo viaggio salvato e sincronizzato');go('tripCosts');
 }
 function downloadCSV(rows,name){DGData.downloadCSV(rows,name)}
 async function doAction(verb,id){
  if(verb==='recalc'){if(isDemo())return;const node=document.getElementById('dg11-date');cashDate=node?.value||itDate();go('cashClosing');}
  else if(verb==='income-new')openIncome();
  else if(verb==='supplier-new')await openSupplier();
  else if(verb==='supplier-edit')await openSupplier(id);
  else if(verb==='cost-new')await openCost();
  else if(verb==='cost-edit')await openCost(id);
  else if(verb==='cash-csv'){const rows=isDemo()?demoClosures:await DGData.rows('cashClosures');downloadCSV([['DATA','OPERATORE','TEORICO','CONTATI','DIFFERENZA','NOTE'],...rows.filter(r=>isDemo()||r.operatore_user_id===DGData.actor?.id).map(r=>[r.data_chiusura,r.operatore,r.saldo_teorico,r.contanti_contati,r.differenza,r.note])],'DELGROSSO_CHIUSURE_CASSA.csv');}
  else if(verb==='suppliers-csv'){const rows=isDemo()?suppliersDemo():await DGData.rows('suppliers');downloadCSV([['RAGIONE SOCIALE','CATEGORIA','TELEFONO','EMAIL','PIVA','ATTIVO'],...rows.map(r=>[r.ragione_sociale,r.categoria,r.telefono,r.email,r.partita_iva,r.attivo])],'DELGROSSO_FORNITORI.csv');}
  else if(verb==='costs-csv'){const rows=isDemo()?[]:await DGData.rows('tripCosts');downloadCSV([['DATA','VIAGGIO_ID','FORNITORE_ID','CATEGORIA','DESCRIZIONE','IMPORTO','STATO','METODO','DOCUMENTO'],...rows.map(x=>[x.data_costo,x.viaggio_id,x.fornitore_id,x.categoria,x.descrizione,x.importo_previsto,x.stato,x.metodo,x.numero_documento])],'DELGROSSO_COSTI_VIAGGIO.csv');}
 }
 NAV[1][1].push(['cashClosing','◷','Chiusura cassa giornaliera']);
 NAV[1][1].push(['suppliers','▥','Fornitori']);
 NAV[1][1].push(['tripCosts','↘','Costi viaggio e marginalità']);
 renders.cashClosing=cashPage;
 renders.suppliers=suppliersPage;
 renders.tripCosts=costsPage;
 document.addEventListener('click',async ev=>{const a=ev.target.closest('[data-dg11]');if(!a)return;
   a.disabled=true;try{await doAction(a.dataset.dg11,a.dataset.id||'')}catch(e){err(e)}finally{a.disabled=false;}
 });
 document.addEventListener('change',ev=>{if(ev.target?.id==='dg11-trip-filter'){window.DG11SelectedTrip=ev.target.value;go('tripCosts');}});
 document.addEventListener('input',ev=>{if(ev.target?.name==='counted'&&ev.target?.closest('#dg11-close')&&lastPreview){const diff=document.getElementById('dg11-diff');if(diff){try{diff.textContent='Differenza effettiva: '+euro(H.money(H.cents(ev.target.value)-H.cents(lastPreview.saldo_teorico)))}catch{diff.textContent='Importo non valido'}}}});
 document.addEventListener('submit',async ev=>{const form=ev.target;if(!['dg11-close','dg11-income','dg11-supplier','dg11-cost'].includes(form?.id))return;
   ev.preventDefault();ev.stopImmediatePropagation();const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=true;
   try{
     if(isDemo())throw Error('Salvataggio non disponibile in anteprima');
     if(form.id==='dg11-income')await submitIncome(form);
     else if(form.id==='dg11-supplier')await submitSupplier(form);
     else if(form.id==='dg11-cost')await submitCost(form);
     else{
       if(lastMode!=='server'||!lastPreview||lastPreview.gia_chiusa||lastPreview.saldo_iniziale_non_verificato||lastPreview.disallineamento)throw Error('Chiusura non autorizzata: verificare prima il saldo e i moduli SQL');
       const values=Object.fromEntries(new FormData(form));const counted=H.money(H.cents(values.counted));if(counted<0)throw Error('Contanti non validi');
       const difference=H.money(H.cents(counted)-H.cents(lastPreview.saldo_teorico));
       if(!confirm(`CONFERMA CHIUSURA ${cashDate}?\nSaldo teorico ${euro(lastPreview.saldo_teorico)}\nContanti contati ${euro(counted)}\nDifferenza ${euro(difference)}\n\nL’operazione verrà registrata nella cassa dell’operatore corrente.`))return;
       const out=await DGData.rpc('dg11_chiudi_cassa_v1',{p_data:cashDate,p_contanti_contati:counted,p_note:values.note||''});
       if(out?.success!==true)throw Error('Chiusura non confermata dal database');cache={};toast('Chiusura giornaliera registrata');go('cashClosing');
     }
   }catch(e){err(e)}finally{if(submit)submit.disabled=false;}
 });
 window.DGCashSuppliers11=Object.freeze({version:'1.1',cashPage,costsPage,suppliersPage});
})();
