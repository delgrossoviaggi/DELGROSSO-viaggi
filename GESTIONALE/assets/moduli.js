/* DELGROSSO 3.0 Premium - Additional browser-only modules.
 * Production changes occur only following a user's explicit Save click and confirmation.
 * Remote Postgres RLS and existing transactional RPCs are the source of authority.
 */
'use strict';
NAV[1][1].push(['economy','▥','Economia e statistiche']);
NAV.push(['CONTROLLI AUTOMATICI', [['assistant','✦','Assistente e anomalie'],['archive','▣','Archivio centrale']]]);
NAV.push(['AMMINISTRAZIONE', [['quotes','▧','Preventivi'],['tasks','◷','Scadenze e agenda'],['transfers','⇆','Trasferimenti cassa'],['drivers','◈','Autisti / attivazione futura'],['settings','⚙','Impostazioni e sicurezza']]]);
const allActive=b=>!/annull|cancel|cancell/i.test(String(b.stato||''));
const uuid=()=>crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,x=>{const r=Math.random()*16|0;return(x==='x'?r:(r&3|8)).toString(16)});
const formInput=(label,name,type='text',opts={})=>`<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" ${opts.required?'required':''} ${opts.min?`min="${esc(opts.min)}"`:''} ${opts.max?`max="${esc(opts.max)}"`:''} ${opts.step?`step="${esc(opts.step)}"`:''} value="${esc(opts.value??'')}" ${opts.placeholder?`placeholder="${esc(opts.placeholder)}"`:''}></label>`;
const formSelect=(label,name,items)=>`<label class="field"><span>${esc(label)}</span><select name="${esc(name)}" required>${items.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('')}</select></label>`;
const commands=(items)=>`<div class="action-row">${items.map(([type,label])=>`<button type="button" class="btn-secondary" data-create="${type}">${esc(label)}</button>`).join('')}</div>`;
const linkById=(route,id,label)=>`<button class="btn-secondary" data-go="${esc(route)}" ${id?`data-trip="${esc(id)}"`:''}>${esc(label)}</button>`;
const callButton=(action,id,label)=>isDemo()?'—':`<button class="btn-secondary" data-action="${esc(action)}" data-id="${esc(id)}">${esc(label)}</button>`;
const titleOf=(t)=>t.titolo||t.destinazione||'Viaggio';
let draftSelected=new Set(),draftOccupied=new Set();
function requireLive(){if(isDemo())throw new Error('In anteprima non è possibile modificare dati. Accedi con un operatore Supabase autorizzato.');if(!DGData.sessionActive)throw new Error('Sessione non disponibile');}
function modal(title,content){let overlay=$('#dg-modal');if(!overlay){overlay=document.createElement('div');overlay.id='dg-modal';overlay.className='modal-layer';overlay.innerHTML='<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="dg-modal-title"><div class="modal-head"><h2 id="dg-modal-title"></h2><button class="modal-close" aria-label="Chiudi finestra">✕</button></div><div id="dg-modal-body"></div></div>';document.body.append(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.modal-close'))closeModal()})}
 $('#dg-modal-title').textContent=title;$('#dg-modal-body').innerHTML=content;overlay.classList.add('show');overlay.querySelector('input:not([type=hidden]),select')?.focus();}
function closeModal(){$('#dg-modal')?.classList.remove('show')}
function printBrandSheet(title,subtitle,html){const overlay=document.createElement('div');overlay.id='dg-print-only';overlay.innerHTML=`<section class="print-sheet"><div class="dg-print-brand"><img src="assets/logo-delgrosso.png" alt="Logo DELGROSSO"><div class="dg-print-brand-text"><h1>DELGROSSO VIAGGI &amp; LIMOUSINE BUS</h1><h2>${esc(title)}</h2><p>${esc(subtitle||'')}</p></div></div>${html}</section>`;document.body.append(overlay);const cleanup=()=>overlay.remove();window.addEventListener('afterprint',cleanup,{once:true});window.print();setTimeout(cleanup,120000);}
const actFooter=(verb='Salva')=>`<div class="modal-footer"><button class="btn-secondary" type="button" data-dismiss="1">Annulla</button><button class="btn btn-main" type="submit">${esc(verb)}</button></div>`;
const modelForm=(operation,fields,text='Salva')=>`<form id="dg-form" data-operation="${esc(operation)}"><div class="form-grid">${fields}</div><p id="dg-form-error" class="auth-error" hidden role="alert"></p>${actFooter(text)}</form>`;
async function pageRentals(){if(isDemo())return sec('Noleggi Bus')+cardInfo('In modalità anteprima i dati non sono reali.','info')+commands([['rental','＋ Nuovo noleggio']]);
 const rentals=await data('rentals');return sec('Noleggi e servizi autobus','Contratti e richieste registrati nel progetto Supabase')+commands([['rental','＋ Nuovo noleggio']])+mainPanel('Noleggi aziendali',table(rentals,[['DATA',x=>fmtDate(x.data_partenza)],['REFERENTE',x=>`<strong>${esc(x.referente||x.azienda||'—')}</strong>`],['TRATTA',x=>esc([x.tratta_partenza,x.tratta_destinazione].filter(Boolean).join(' → '))],['PASSEGGERI',x=>esc(x.passeggeri||'—')],['IMPORTO',x=>euro(x.prezzo_concordato)],['STATO',x=>status(x.stato_noleggio)]]));}
async function pageDeadlines(){if(isDemo())return sec('Agenda e scadenze')+commands([['deadline','＋ Nuova scadenza']])+cardInfo('Anteprima con dati dimostrativi.', 'info');
 const rows=await data('deadlines');return sec('Agenda e scadenze','Promemoria e attività registrati in Supabase')+commands([['deadline','＋ Nuova scadenza']])+mainPanel('Attività',table(rows.sort((a,b)=>String(a.data_scadenza).localeCompare(String(b.data_scadenza))),[['SCADENZA',x=>fmtDate(x.data_scadenza)],['TITOLO',x=>esc(x.titolo)],['PRIORITÀ',x=>esc(x.priorita||'—')],['STATO',x=>status(x.stato)],['AZIONI',x=>/chius|complet/i.test(x.stato)?'—':callButton('finish-deadline',x.id,'Completa')]]));}
async function pageQuotes(){if(isDemo())return sec('Preventivi')+commands([['quote','＋ Nuovo preventivo']]);
 const rows=await data('quotes');return sec('Preventivi','Elenco preventivi; emissione fiscale non prevista da questo modulo')+commands([['quote','＋ Nuovo preventivo']])+mainPanel('Preventivi',table(rows,[['DATA',x=>fmtDate(x.data_viaggio||x.created_at)],['CLIENTE',x=>esc([x.nome,x.cognome].filter(Boolean).join(' ')||x.azienda)],['DESTINAZIONE',x=>esc(x.destinazione||'—')],['PASSEGGERI',x=>esc(x.numero_passeggeri||'—')],['IMPORTO',x=>euro(x.importo_preventivo||x.importo)],['STATO',x=>status(x.stato)]]));}
async function pageDocuments(){if(isDemo())return sec('Documenti')+cardInfo('Anteprima: i documenti aziendali sono visibili solo dopo il login.', 'info');
 const [docs,trips,receipts]=await Promise.all([data('documents'),data('trips'),data('receiptarchive').catch(()=>[])]);const names=Object.fromEntries(trips.map(t=>[t.id,titleOf(t)]));
 return sec('Archivio documenti e PDF','Indice dei documenti Supabase: i file nei bucket privati richiedono accesso autorizzato')+mainPanel('Documenti archiviati',table(docs,[['DATA',x=>fmtDate(x.created_at)],['TITOLO',x=>esc(x.titolo||'Documento')],['CATEGORIA',x=>esc(x.categoria||'—')],['VIAGGIO',x=>esc(names[x.viaggio_id]||'—')],['STORAGE',x=>`<span class="small-note">${esc(x.storage_bucket||'—')} · archivio riservato</span>`],['FILE',x=>x.storage_path&&x.storage_bucket?`<button class="btn-secondary" data-storage-bucket="${esc(x.storage_bucket)}" data-storage-path="${esc(x.storage_path)}">Apri</button>`:'—']]))+mainPanel('Ricevute storiche e versioni',table(receipts.slice(0,300),[['DATA',x=>fmtDate(x.data_pagamento||x.created_at)],['NUMERO',x=>esc(x.receipt_number||'—')],['CLIENTE',x=>esc(x.cliente||'—')],['TIPO',x=>esc(x.tipo||x.kind||'—')],['IMPORTO',x=>euro(x.importo)],['FILE',x=>x.professional_path||x.legacy_path?`<button class="btn-secondary" data-storage-bucket="ricevute-prenotazioni" data-storage-path="${esc(x.professional_path||x.legacy_path)}">Ricevuta</button> <button class="btn-secondary" data-action="print-receipt-archive" data-id="${esc(x.id)}">Versione con logo</button>`:'—']]))+
  cardInfo('I file privati non vengono resi pubblici. Per aprirli occorre il flusso di autorizzazione del bucket e la verifica delle policy Storage.', 'info');}
async function pageInvoices(){return sec('Fatturazione integrata','Predisposizione gestionale; invio SdI richiede provider certificato e configurazione fiscale')+
 mainPanel('Stato del modulo',`<div class="feature-grid"><div class="feature"><strong>01 · Anagrafiche e dati</strong><p>Clienti, importi e riferimenti delle prenotazioni già disponibili via Supabase.</p></div><div class="feature"><strong>02 · Bozza proforma</strong><p>È possibile stampare un riepilogo interno; non è una fattura fiscale.</p></div><div class="feature"><strong>03 · Fatturazione elettronica</strong><p>Integrazione SdI, firma/conservazione e numerazione fiscale da predisporre con commercialista/provider.</p></div></div><div class="action-row"><button type="button" class="btn-secondary" data-action="invoice-preview">Stampa riepilogo non fiscale</button></div>`)+
 cardInfo('Nessuna fattura elettronica viene inviata o generata come documento fiscale da questa versione web.', 'warn');}
async function pageTransfers(){if(isDemo())return sec('Trasferimenti cassa')+cardInfo('Registrazioni reali riservate agli operatori.', 'info');
 const [rows,operators]=await Promise.all([data('transfers'),data('cashoperators')]);const names=Object.fromEntries(operators.map(o=>[o.user_id,o.nome||o.username]));
 return sec('Trasferimenti tra operatori','Storico delle quote trasferite tra le casse autorizzate')+mainPanel('Movimenti',table(rows,[['DATA',x=>fmtDate(x.data_trasferimento)],['DA',x=>esc(names[x.da_operatore_user_id]||'Operatore')],['A',x=>esc(names[x.a_operatore_user_id]||'Operatore')],['IMPORTO',x=>euro(x.importo)],['STATO',x=>status(x.stato)]]));}
async function pageDriver(){return sec('Autisti e turni','Attivazione successiva, come da specifica aziendale')+mainPanel('Pianificazione autisti',cardInfo('Archivio e turnazioni degli autisti attivabili in una versione successiva. Nessun accesso autista è stato abilitato.', 'info'));}
async function pageSettings(){return sec('Impostazioni e sicurezza','DELGROSSO VIAGGI & LIMOUSINE BUS')+mainPanel('Ambiente installato',`<div class="feature-grid">
 <div class="feature"><strong>Piattaforma</strong><p>Web app HTML / CSS / JavaScript. Nessuna dipendenza da Python o Node sul PC.</p></div>
 <div class="feature"><strong>Database</strong><p>Supabase gestionale · ${isDemo()?'modalità dimostrativa':'sessione autenticata con policy RLS'}.</p></div>
 <div class="feature"><strong>Sicurezza</strong><p>Token solo nella memoria temporanea del browser; logout distrugge la sessione locale. Non usare PC condivisi.</p></div>
 <div class="feature"><strong>Operazioni</strong><p>Le modifiche richiedono un clic esplicito di salvataggio, una conferma e il permesso nel database.</p></div>
 <div class="feature"><strong>Pagamenti online</strong><p>Non attivi: architettura da integrare a seguito di decisione aziendale.</p></div>
 <div class="feature"><strong>WhatsApp Business</strong><p>Modalità ibrida assistita; nessuna creazione automatica di gruppi o messaggi non autorizzati.</p></div></div>`)+(isDemo()?cardInfo('Per cambiare la password accedi prima come Nicola o Raffaele.', 'info'):commands([['password-change','🔐 Cambia password del mio profilo']])+cardInfo('La modifica riguarda soltanto il tuo account Supabase. Password mai salvata nell’HTML o nei file.', 'info'));}
async function pageCRM(){const rows=await data('customers');const bs=isDemo()?DEMO.bookings:await data('bookings');
 return sec('Clienti e storico prenotazioni','Anagrafiche e storico interno DELGROSSO')+
 commands([['customer','＋ Nuovo cliente']])+`<div class="filters"><label class="search-box">⌕ <input id="filter-customers" placeholder="Cerca cliente, telefono, email..."></label><span class="chip">${rows.length} schede</span></div><div id="customers-table">${renderCustomersEnhanced(rows,bs)}</div>`;}
function renderCustomersEnhanced(rows,bookings){return mainPanel('Rubrica clienti',table(rows,[['NOMINATIVO',x=>`<strong>${esc([x.nome,x.cognome].filter(Boolean).join(' ')||'—')}</strong><div class="small-note">${esc(x.codice_cliente||'')}</div>`],['TELEFONO',x=>esc(x.telefono||'—')],['EMAIL',x=>esc(x.email||'—')],['PRENOTAZIONI',x=>{const key=String(x.telefono||'').replace(/\D/g,'');return key.length>=9?bookings.filter(b=>String(b.telefono||'').replace(/\D/g,'')===key).length:'—'}],['AZIONE',x=>callButton('client-detail',x.id,'Scheda')]]));}
async function pageAccounting(name){if(isDemo())return pageCash(name);
 let operators=[];try{operators=await data('cashoperators')}catch(e){return pageCash(name)+cardInfo('Dettaglio casse non disponibile: '+e.message,'warn')}
 const filtered=operators.filter(x=>!name||(x.nome||x.username||'').toLowerCase().includes(name.toLowerCase()));
 return sec(name?'Contabilità '+name:'Cassa generale','Saldo netti prodotti dal database aziendale, con controllo degli operatori')+
 mainPanel('Cassa operatori',table(filtered,[['OPERATORE',x=>`<strong>${esc(x.nome||x.username||'Operatore')}</strong>`],['CASSA NETTA',x=>euro(x.cassa_netto)],['CONTANTI NETTI',x=>euro(x.contanti_netto)],['TRASFERIMENTI USCITA',x=>euro(x.trasferimenti_uscita)],['TRASFERIMENTI ENTRATA',x=>euro(x.trasferimenti_entrata)]]))+
 cardInfo('Verificare le quadrature, i rimborsi e le chiusure prima dell’utilizzo contabile ufficiale.','info');}
async function pageSeatLayouts(){const trips=await data('trips');return sec('Piantine e editor','Crea uno schema numerato automaticamente e consulta le piantine esistenti')+
 commands([['layout','＋ Disegna piantina']])+mainPanel('Piantine dei viaggi',table(trips,[['VIAGGIO',x=>esc(titleOf(x))],['CAPIENZA',x=>esc(x.posti_totali||0)],['MODELLO',x=>esc(x.autobus||'—')],['AZIONE',x=>linkById('control',x.id,'Apri piantina')]]))+
 cardInfo('La disposizione numerata dell’editor è una bozza personalizzabile; la capienza reale e i posti del viaggio vanno verificati prima di assegnarla a un autobus.', 'info');}
async function pageBookingsEnhanced(){const [rows,trips]=await Promise.all([data('bookings'),data('trips')]);const names=Object.fromEntries(trips.map(t=>[t.id,titleOf(t)]));
 return sec('Prenotazioni','Posti, acconti, saldi e check-in con controlli Supabase')+commands([['booking','＋ Nuova prenotazione']])+
 `<div class="filters"><label class="search-box">⌕ <input id="filter-bookings" placeholder="Cerca nominativo, viaggio, fermata..."></label><select id="bookings-trip"><option value="">Tutti i viaggi</option>${trips.map(t=>`<option value="${esc(t.id)}">${esc(titleOf(t))}</option>`).join('')}</select></div><div id="table-bookings">${renderBookingsEnhanced(rows,names)}</div>`;}
function renderBookingsEnhanced(rows,trips){return mainPanel('Prenotazioni',table(rows,[['REFERENTE',x=>`<strong>${esc(x.cliente_nome||x.cliente||'—')}</strong>`],['VIAGGIO',x=>esc(trips[x.viaggio_id]||'—')],['POSTI',x=>esc(x.posti_selezionati||'Da verificare')],['PERSONE',x=>esc(x.posti)],['PAGATO',x=>euro(x.pagato)],['STATO',x=>status(x.stato)],['AZIONI',x=>isDemo()?'—':`${callButton('edit-booking',x.id,'Modifica')} ${callButton('checkin',x.id,x.checkin_effettuato?'Check-in ✓':'Check-in')} <button type="button" class="btn-secondary" data-dg10-confirmation="${esc(x.id)}">${x.confirmation_storage_path?'Scarica conferma':'Genera conferma PDF'}</button>`]]));}
async function pageTripsEnhanced(){const trips=await data('trips');return sec('Viaggi e partenze','Gestione programmazione e BUS BIS')+commands([['trip','＋ Nuovo viaggio']])+`<div class="filters"><label class="search-box">⌕ <input id="filter-trips" placeholder="Cerca viaggio, destinazione, autobus..."></label><span class="chip">${trips.length} viaggi</span></div><div id="table-trips">${renderTripTable(trips)}</div>`;}
async function pagePaymentsEnhanced(){const rows=await data('payments');return sec('Pagamenti e ricevute','Registrazione transazionale tramite funzioni aziendali Supabase')+commands([['payment','＋ Registra acconto / saldo']])+mainPanel('Movimenti registrati',table(rows,[['DATA',x=>fmtDate(x.data_pagamento||x.created_at)],['TIPO',x=>status(x.tipo)],['IMPORTO',x=>euro(x.importo)],['OPERATORE',x=>esc(x.incassato_da||'—')],['RICEVUTA',x=>esc(x.receipt_number||'Da generare')],['AZIONE',x=>callButton('print-payment',x.id,'Ricevuta con logo')]]))+
 cardInfo('La ricevuta fiscale e il documento PDF devono essere verificati nel sistema ufficiale. La registrazione di un pagamento non equivale all’emissione automatica di fattura.', 'info');}
async function pageControlEnhanced(){const base=await pageControl();return base+(isDemo()?'':commands([['booking','＋ Prenota posti']]))}
async function pageWhatsappEnhanced(){const customers=await data('customers');return sec('Centro WhatsApp ibrido','Contatti autorizzati: apertura manuale WhatsApp Business')+
 commands([['contact-export','⇩ Esporta contatti del viaggio']])+mainPanel('Rubrica WhatsApp',table(customers.filter(x=>x.telefono).slice(0,100),[['CLIENTE',x=>esc([x.nome,x.cognome].filter(Boolean).join(' '))],['NUMERO',x=>esc(x.telefono)],['CHAT',x=>{const d=String(x.telefono||'').replace(/\D/g,'');const number=d.startsWith('39')?d:'39'+d;return d.length>=9?`<a class="btn-secondary" href="https://wa.me/${number}" target="_blank" rel="noopener noreferrer">Apri chat</a>`:'—'}]]))+
 cardInfo('I messaggi non sono inviati automaticamente. Il consenso ai gruppi resta obbligatorio.','info');}
function fieldDate(){return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Rome'}).format(new Date())}
async function openCreate(type,refId=''){
 if(type==='password-change'){
  requireLive();
  return modal('Cambio password · '+me,modelForm('password-change',
   formInput('Nuova password (min. 12 caratteri)','new_password','password',{required:true})+
   formInput('Conferma nuova password','confirm_password','password',{required:true}),
   'Aggiorna password'));
 }

 if(type==='all-trips-pdf'){requireLive();DGData.printAllTrips(await data('trips'),await data('bookings'));return;}
 if(type==='all-trips-csv'){requireLive();const trips=await data('trips'),bookings=await data('bookings');const names=Object.fromEntries(trips.map(t=>[t.id,titleOf(t)]));DGData.downloadCSV([['VIAGGIO','DATA','REFERENTE','TELEFONO','POSTI','FERMATA','PERSONE','PAGATO'],...bookings.filter(allActive).map(b=>[names[b.viaggio_id]||'',trips.find(t=>t.id===b.viaggio_id)?.data_partenza||'',b.cliente_nome||b.cliente,b.telefono,b.posti_selezionati,b.fermata_partenza,b.posti,b.pagato])],'DELGROSSO_TUTTI_PRENOTATI.csv');return;}
 if(type==='contact-export'){
  if(isDemo())throw new Error('Accedi per esportare i dati reali');
  const trips=await data('trips');modal('Esporta contatti WhatsApp',modelForm('export-contacts',formSelect('Seleziona viaggio','trip_id',trips.map(t=>[t.id,titleOf(t)+' · '+t.data_partenza])),'Esporta CSV'));return;
 }
 if(type==='layout'){
  modal('Editor piantine numerate',modelForm('layout',formInput('Nome piantina','nome','text',{required:true,placeholder:'Es. GT57 Larino'})+formInput('Numero posti','posti','number',{required:true,min:1,max:100,value:57})+formInput('Posti per fila','per_fila','number',{required:true,min:2,max:5,value:4}),'Genera modello'));
  return;
 }
 requireLive();
 if(type==='customer')return modal('Nuovo cliente CRM',modelForm('customer',formInput('Nome','nome','text',{required:true})+formInput('Cognome','cognome','text',{required:true})+formInput('Telefono','telefono','tel')+formInput('Email','email','email'),'Registra cliente'));
 if(type==='deadline')return modal('Nuova attività / scadenza',modelForm('deadline',formInput('Titolo','titolo','text',{required:true})+formInput('Data scadenza','data_scadenza','date',{required:true,value:fieldDate()})+formSelect('Priorità','priorita',[['normale','Normale'],['alta','Alta'],['bassa','Bassa']])+formInput('Descrizione','descrizione'),'Registra attività'));
 if(type==='rental')return modal('Nuovo noleggio autobus',modelForm('rental',formInput('Referente','referente','text',{required:true})+formInput('Telefono','telefono','tel')+formInput('Partenza da','tratta_partenza','text',{required:true})+formInput('Arrivo a','tratta_destinazione','text',{required:true})+formInput('Data','data_partenza','date',{required:true,value:fieldDate()})+formInput('Passeggeri','passeggeri','number',{min:1,max:100})+formInput('Prezzo concordato (€)','prezzo_concordato','number',{min:0,step:'0.01'}),'Registra noleggio'));
 if(type==='quote')return modal('Nuovo preventivo',modelForm('quote',formInput('Nome','nome','text',{required:true})+formInput('Cognome','cognome','text',{required:true})+formInput('Telefono','telefono','tel',{required:true})+formInput('Destinazione','destinazione','text',{required:true})+formInput('Data viaggio','data_viaggio','date',{required:true,value:fieldDate()})+formInput('Numero passeggeri','numero_passeggeri','number',{min:1,max:200})+formInput('Prezzo preventivo (€)','importo_preventivo','number',{min:0,step:'0.01'}),'Salva preventivo'));
 if(type==='trip'){
  const fleet=(await data('fleet')).filter(f=>f.attivo&&!/mercedes|v250/i.test([f.titolo,f.modello].join(' ')));
  return modal('Nuovo viaggio · non pubblicato',modelForm('trip',formInput('Titolo del viaggio','titolo','text',{required:true})+formInput('Destinazione','destinazione','text',{required:true})+formInput('Data partenza','data_partenza','date',{required:true,value:fieldDate()})+formInput('Ora partenza','ora_partenza','time',{required:true,value:'06:00'})+formInput('Prezzo a persona (€)','prezzo','number',{required:true,min:0,step:'0.01'})+formSelect('Autobus','autobus_id',fleet.map(f=>[f.id,`${f.titolo||f.modello} · ${f.posti} posti`]))+formInput('Minimo partecipanti','minimo_partecipanti','number',{required:true,min:1,max:200,value:40}), 'Registra viaggio'));
 }
 if(type==='booking'||type==='edit-booking'){
  const trips=await data('trips'),bookings=await data('bookings');const existing=type==='edit-booking'?bookings.find(x=>x.id===refId):null;
  const available=trips.filter(t=>!t.archiviato_at&&t.posti_totali>0);const chosen=existing?.viaggio_id||selectedTrip||available[0]?.id;
  if(!chosen)throw new Error('Non ci sono viaggi validi per la prenotazione');
  const fields=formSelect('Viaggio','viaggio_id',available.map(t=>[t.id,titleOf(t)+' · '+t.data_partenza]))+
   formInput('Referente / nominativo','cliente','text',{required:true,value:existing?.cliente_nome||existing?.cliente||''})+formInput('Telefono','telefono','tel',{value:existing?.telefono})+
   formInput('Email','email','email',{value:existing?.email})+formInput('Fermata di partenza','fermata_partenza','text',{required:true,value:existing?.fermata_partenza||''})+
   formInput('Totale da pagare (€)','totale','number',{required:true,min:0,step:'0.01',value:existing?.totale??''})+
   formInput('Note','note','text',{value:existing?.note||''})+
   `<input type="hidden" name="giorni_acconto" value="${esc(existing?.giorni_acconto??2)}">`+
   `<input type="hidden" name="booking_id" value="${esc(existing?.id||'')}"><div class="form-seats"><strong>Seleziona i sedili liberi</strong><p class="small-note">I posti già occupati sono bloccati; Supabase verifica nuovamente eventuali conflitti al salvataggio.</p><div id="draft-seats" class="draft-seats"></div><div class="chosen-count" id="chosen-count">0 sedili selezionati</div></div>`;
  modal(existing?'Modifica prenotazione':'Nuova prenotazione',modelForm('booking',fields,existing?'Salva modifiche':'Conferma prenotazione'));
  const sel=$('#dg-form [name="viaggio_id"]');sel.value=chosen;
  sel.addEventListener('change',()=>updateDraftSeats(sel.value,existing?.id));await updateDraftSeats(chosen,existing?.id);
  return;
 }
 if(type==='payment'){
  const [bookings,trips]=await Promise.all([data('bookings'),data('trips')]);const names=Object.fromEntries(trips.map(t=>[t.id,titleOf(t)]));const active=bookings.filter(allActive);
  return modal('Registra pagamento',modelForm('payment',formSelect('Prenotazione','booking_id',active.map(b=>[b.id,`${b.cliente_nome||b.cliente} · ${names[b.viaggio_id]||''} · da riscuotere ${euro(Math.max(0,Number(b.totale||0)-Number(b.pagato||0)))}`]))+
   formSelect('Tipo pagamento','tipo',[['Acconto','Acconto'],['Saldo','Saldo']])+formInput('Importo (€)','importo','number',{required:true,min:0.01,step:'0.01'})+
   formSelect('Metodo','metodo',[['CONTANTI','Contanti'],['POS','POS'],['BONIFICO','Bonifico']])+formInput('Data incasso','data','date',{required:true,value:fieldDate()})+formInput('Note','note'),'Registra incasso'));
 }
}
async function updateDraftSeats(tripId,editingId){const trips=await data('trips');const trip=trips.find(t=>t.id===tripId);if(!trip)return;
 const allBookings=await data('bookings'),allSeatRows=isDemo()?[]:await data('seatrows');
 const excluding=allBookings.filter(b=>b.id!==editingId);
 const excludeRows=allSeatRows.filter(r=>r.prenotazione_id!==editingId);
 const overview=DGData.seatOverview(trip,excluding,excludeRows);
 draftOccupied=new Set(overview.occupied);draftSelected=new Set(editingId?
  allBookings.filter(b=>b.id===editingId).flatMap(b=>String(b.posti_selezionati||'').split(',').map(x=>Number(x.trim())).filter(n=>Number.isInteger(n)&&n>0)):[]);
 const el=$('#draft-seats');if(!el)return;
 el.innerHTML=Array.from({length:overview.capacity},(_,i)=>{const n=i+1;const busy=draftOccupied.has(n);return `<button type="button" class="draft-seat ${busy?'busy':draftSelected.has(n)?'selected':''}" data-seatnum="${n}" ${busy?'disabled':''} aria-label="Posto ${n} ${busy?'occupato':draftSelected.has(n)?'selezionato':'libero'}">${n}</button>`}).join('');
 $('#chosen-count').textContent=`${draftSelected.size} sedili selezionati / ${overview.free_count} liberi`;
}
async function actionClicked(type,id){requireLive();if(type==='checkin'){
 const b=(await data('bookings')).find(b=>b.id===id);if(!b||!allActive(b))throw Error('Prenotazione non valida o annullata');
 const next=!Boolean(b.checkin_effettuato);if(!confirm(`Confermi ${next?'il check-in':'l’annullamento del check-in'} per ${b.cliente_nome||b.cliente}?`))return;
 await DGData.update('prenotazioni',id,{checkin_effettuato:next,checked_in_at:next?new Date().toISOString():null,checkin_operatore:next?me:null});await revalidate(['bookings']);toast('Check-in aggiornato');go(page);return;
 }
 if(type==='edit-booking')return openCreate('edit-booking',id);
 if(type==='finish-deadline'){
  if(!confirm('Contrassegnare la scadenza come completata?'))return;
  await DGData.update('scadenze_gestionale',id,{stato:'completata',completata_at:new Date().toISOString()});await revalidate(['deadlines']);toast('Attività completata');go(page);return;
 }
 if(type==='client-detail'){
  const client=(await data('customers')).find(c=>c.id===id);if(!client)return;
  const bs=await data('bookings'),ts=await data('trips');const tripNames=Object.fromEntries(ts.map(t=>[t.id,titleOf(t)]));const phone=String(client.telefono||'').replace(/\D/g,'');
  const historical=bs.filter(b=>phone.length>=9&&String(b.telefono||'').replace(/\D/g,'')===phone);
  modal('Scheda cliente · '+[client.nome,client.cognome].join(' '),`<div class="modal-content"><p><strong>Telefono:</strong> ${esc(client.telefono||'—')}</p><p><strong>Email:</strong> ${esc(client.email||'—')}</p><h3>Viaggi e quote associate al numero</h3>${table(historical,[['VIAGGIO',b=>esc(tripNames[b.viaggio_id])],['PERSONE',b=>esc(b.posti)],['TOTALE',b=>euro(b.totale)],['PAGATO',b=>euro(b.pagato)],['STATO',b=>status(b.stato)]])}<p class="small-note">Associazione per numero telefonico: verificare omonimie e recapiti condivisi.</p></div>`);return;
 }
 if(type==='print-payment'){
  const [payments,bookings,trips]=await Promise.all([data('payments'),data('bookings'),data('trips')]);
  const pay=payments.find(x=>x.id===id);if(!pay)throw Error('Pagamento non trovato');
  const book=bookings.find(x=>x.id===pay.prenotazione_id||x.id===pay.booking_id);
  const trip=trips.find(x=>x.id===book?.viaggio_id);
  printBrandSheet('RICEVUTA DI '+String(pay.tipo||'PAGAMENTO').toUpperCase()+' · '+(pay.receipt_number||''),'Documento gestionale con logo aziendale',`<p><strong>Numero ricevuta:</strong> ${esc(pay.receipt_number||'Da assegnare')}</p><p><strong>Cliente:</strong> ${esc(book?.cliente_nome||book?.cliente||'—')}</p><p><strong>Viaggio:</strong> ${esc(trip?titleOf(trip):'—')}</p><p><strong>Data incasso:</strong> ${esc(fmtDate(pay.data_pagamento||pay.created_at))}</p><p><strong>Tipo:</strong> ${esc(pay.tipo||'—')}</p><p><strong>Metodo:</strong> ${esc(pay.metodo||pay.metodo_pagamento||'—')}</p><p><strong>Importo:</strong> ${euro(pay.importo)}</p><p><strong>Operatore:</strong> ${esc(pay.incassato_da||'—')}</p><p class="small-note">Documento gestionale ristampato dal browser con logo aziendale. Verificare sempre l’archivio ufficiale.</p>`);return;
 }
 if(type==='print-receipt-archive'){
  const receipts=await data('receiptarchive');
  const r=receipts.find(x=>String(x.id)===String(id));if(!r)throw Error('Ricevuta archiviata non trovata');
  printBrandSheet('Ricevuta storica '+(r.receipt_number||''),'Versione consultazione con logo aziendale',`<p><strong>Numero ricevuta:</strong> ${esc(r.receipt_number||'—')}</p><p><strong>Cliente:</strong> ${esc(r.cliente||'—')}</p><p><strong>Servizio:</strong> ${esc(r.servizio||'—')}</p><p><strong>Tipo:</strong> ${esc(r.tipo||r.kind||'—')}</p><p><strong>Data pagamento:</strong> ${esc(fmtDate(r.data_pagamento||r.created_at))}</p><p><strong>Metodo:</strong> ${esc(r.metodo||'—')}</p><p><strong>Importo:</strong> ${euro(r.importo)}</p><p><strong>Operatore:</strong> ${esc(r.operatore||'—')}</p><p class="small-note">Questa ristampa non sostituisce il PDF archiviato nel bucket privato, ma applica il logo DELGROSSO per consultazione e stampa veloce.</p>`);return;
 }
  if(type==='invoice-preview'){
  if(!confirm('Stampare un riepilogo gestionale NON FISCALE? Non è una fattura valida.'))return;
  const bookings=await data('bookings');const totals=bookings.filter(allActive).reduce((acc,b)=>({total:acc.total+Number(b.totale||0),paid:acc.paid+Number(b.pagato||0)}),{total:0,paid:0});
  printBrandSheet('Riepilogo interno · NON È UNA FATTURA','Documento informativo, privo di validità fiscale.',`<p>Prenotazioni attive: ${bookings.filter(allActive).length}</p><p>Valore quote registrate: ${euro(totals.total)}</p><p>Pagato: ${euro(totals.paid)}</p><p>Documento informativo, privo di validità fiscale.</p>`);
 }
}
async function revalidate(keys){for(const k of keys)delete cache[k];}
async function submitForm(form){const op=form.dataset.operation;const values=Object.fromEntries(new FormData(form));
 if(op==='password-change'){
  requireLive();
  if(!values.new_password||values.new_password!==values.confirm_password)throw Error('Le due password non coincidono');
  if(!confirm('Cambiare la password del profilo '+me+'?'))return;
  await DGData.changeOwnPassword(values.new_password);
  form.reset();closeModal();toast('Password aggiornata nel tuo account Supabase');return;
 }
 if(op==='layout'){
  const n=Number(values.posti),per=Number(values.per_fila);if(!values.nome.trim()||!Number.isInteger(n)||n<1||n>100||!Number.isInteger(per)||per<2||per>5)throw Error('Modello non valido');
  const rows=[];for(let i=0;i<n;i+=per)rows.push(Array.from({length:Math.min(per,n-i)},(_,k)=>i+k+1));
  const payload={nome:values.nome,posti_totali:n,posti_per_fila:per,file:rows,layout_version:1,disposizione:'NUMERAZIONE_AUTOMATICA_DA_VERIFICARE'};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});DGData.downloadCSV([['MODELLO',values.nome],['POSTI',n]],'DELGROSSO_LAYOUT_'+n+'_SCHEDA.csv');
  const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='DELGROSSO_PIANTINA_'+n+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);closeModal();toast('Schema numerato esportato (non assegnato al viaggio)');return;
 }
 if(op==='export-contacts'){await csvDownload(values.trip_id,'phones');closeModal();return;}
 requireLive();const confirmText={customer:'Creare questo cliente?',trip:'Creare un nuovo viaggio non pubblicato?',booking:'Confermare il salvataggio della prenotazione e dei sedili su Supabase?',payment:'Registrare questo incasso in modo definitivo?',deadline:'Registrare questa scadenza?',rental:'Registrare questo noleggio?',quote:'Registrare questo preventivo?'};
 if(!confirm(confirmText[op]||'Confermi questa modifica al database aziendale?'))return;
 if(op==='customer'){await DGData.insert('clienti',{nome:values.nome.trim(),cognome:values.cognome.trim(),telefono:values.telefono,email:values.email});await revalidate(['customers']);}
 else if(op==='deadline'){await DGData.insert('scadenze_gestionale',{titolo:values.titolo.trim(),descrizione:values.descrizione||null,priorita:values.priorita,data_scadenza:values.data_scadenza,stato:'aperta'});await revalidate(['deadlines']);}
 else if(op==='rental'){await DGData.insert('noleggi_bus',{referente:values.referente.trim(),telefono:values.telefono||null,tratta_partenza:values.tratta_partenza.trim(),tratta_destinazione:values.tratta_destinazione.trim(),data_partenza:values.data_partenza,passeggeri:values.passeggeri?Number(values.passeggeri):null,prezzo_concordato:values.prezzo_concordato?Number(values.prezzo_concordato):null,stato_noleggio:'Richiesto'});await revalidate(['rentals']);}
 else if(op==='quote'){await DGData.insert('preventivi',{nome:values.nome.trim(),cognome:values.cognome.trim(),telefono:values.telefono.trim(),destinazione:values.destinazione.trim(),data_viaggio:values.data_viaggio,numero_passeggeri:values.numero_passeggeri?Number(values.numero_passeggeri):null,importo_preventivo:values.importo_preventivo?Number(values.importo_preventivo):null,stato:'Nuovo'});await revalidate(['quotes']);}
 else if(op==='trip'){
  const fl=(await data('fleet')).find(f=>f.id===values.autobus_id);if(!fl)throw Error('Autobus non riconosciuto');
  await DGData.insert('viaggi',{titolo:values.titolo.trim(),destinazione:values.destinazione.trim(),data_partenza:values.data_partenza,ora_partenza:values.ora_partenza,prezzo:Number(values.prezzo),posti_totali:Number(fl.posti),minimo_partecipanti:Number(values.minimo_partecipanti),autobus_id:fl.id,autobus:fl.titolo||fl.modello,stato:'Programmato',pubblicato:'NO'});await revalidate(['trips']);
 }
 else if(op==='booking'){
  const seats=[...draftSelected].sort((a,b)=>a-b);if(!seats.length)throw Error('Seleziona almeno un posto');
  await DGData.saveBooking({id:values.booking_id||uuid(),trip_id:values.viaggio_id,client:values.cliente,phone:values.telefono,email:values.email,stop:values.fermata_partenza,notes:values.note,seats,price:values.totale,days:Number(values.giorni_acconto)||2,status:(values.booking_id?(cache.bookings||[]).find(b=>b.id===values.booking_id)?.stato:'In attesa acconto')||'In attesa acconto'});
  await revalidate(['trips','bookings','seatrows','payments']);
 }
 else if(op==='payment'){
  await DGData.registerPayment({booking_id:values.booking_id,type:values.tipo,amount:values.importo,method:values.metodo,date:values.data,note:values.note});await revalidate(['bookings','payments','cashoperators']);
 }
 else throw Error('Operazione non riconosciuta');
 closeModal();toast('Operazione salvata su Supabase');await loadPage();
}
async function pageReportsEnhanced(){const html=await pageReports();return commands([['all-trips-pdf','🖨 Elenco prenotati di TUTTI i viaggi in PDF'],['all-trips-csv','⇩ Elenco generale CSV']])+html;}
async function pageEconomy(){const [trips,bookings]=await Promise.all([data('trips'),data('bookings')]);
 const values=trips.map(t=>{const bs=bookings.filter(b=>b.viaggio_id===t.id&&allActive(b));return {...t,booked:bs.reduce((a,b)=>a+Number(b.posti||0),0),quoted:bs.reduce((a,b)=>a+Number(b.totale||0),0),paid:bs.reduce((a,b)=>a+Number(b.pagato||0),0)}});
 const gross=values.reduce((a,b)=>a+b.quoted,0),collected=values.reduce((a,b)=>a+b.paid,0);
 return sec('Economia e statistiche','Analisi delle quote dalle prenotazioni · non sostituisce la contabilità fiscale')+
 `<div class="metric-belt" style="margin-bottom:18px"><div class="mini-metric"><strong>${euro(gross)}</strong><span>Quote totali registrate</span></div><div class="mini-metric"><strong>${euro(collected)}</strong><span>Quote pagate dichiarate</span></div><div class="mini-metric"><strong>${euro(Math.max(0,gross-collected))}</strong><span>Residuo indicativo</span></div></div>`+
 mainPanel('Economia per viaggio',table(values,[['VIAGGIO',x=>esc(titleOf(x))],['DATA',x=>fmtDate(x.data_partenza)],['PRENOTATI',x=>`${x.booked} / ${x.posti_totali}`],['RIEMPIMENTO',x=>{const percent=x.posti_totali?Math.round(100*x.booked/x.posti_totali):0;return `<div class="progress" style="width:130px"><span style="width:${Math.min(100,percent)}%"></span></div><small>${percent}%</small>`}],['QUOTATO',x=>euro(x.quoted)],['PAGATO',x=>euro(x.paid)],['DA RISCUOTERE',x=>euro(Math.max(0,x.quoted-x.paid))]]))+
 cardInfo('Non include l’esatta quadratura di rimborsi, storni, trasferimenti, spese o chiusure contabili.', 'warn');
}
async function pageAssistant(){if(isDemo())return sec('Assistente operativo')+cardInfo('L’analisi automatica richiede i dati effettivi; nell’anteprima non viene presentata come report reale.', 'info');
 const [trips,bookings,seats,deadlines]=await Promise.all([data('trips'),data('bookings'),data('seatrows'),data('deadlines').catch(()=>[])]);
 const notices=[];const now=fieldDate();for(const trip of trips){const map=DGData.seatOverview(trip,bookings,seats);
 if(map.legacy_only.length)notices.push({type:'Posti solo storico',name:titleOf(trip),detail:`${map.legacy_only.length} posti da riconciliare nelle assegnazioni relazionali`,id:trip.id});
 if(map.counter_mismatch)notices.push({type:'Contatore non allineato',name:titleOf(trip),detail:`Contatore: ${map.counter_claim}; piantina: ${map.occupied_count}`,id:trip.id});
 if(map.over_capacity.length)notices.push({type:'Posti fuori capienza',name:titleOf(trip),detail:`Posti da verificare: ${map.over_capacity.join(', ')}`,id:trip.id});
 const min=Number(trip.minimo_partecipanti||40);if(trip.data_partenza>=now&&!trip.archiviato_at&&Number(trip.posti_occupati)<min)notices.push({type:'Minimo non raggiunto',name:titleOf(trip),detail:`${Math.max(0,min-Number(trip.posti_occupati||0))} partecipanti mancanti per il minimo registrato`,id:trip.id});
 }
 const urgent=deadlines.filter(d=>d.data_scadenza&&d.data_scadenza<now&&!/complet|chius/i.test(d.stato||''));
 for(const d of urgent)notices.push({type:'Scadenza arretrata',name:d.titolo,detail:'Scadenza: '+d.data_scadenza,id:''});
 return sec('Assistente operativo e anomalie','Controlli automatici basati su regole verificabili · nessun servizio AI esterno')+
 `<div class="metric-belt" style="margin-bottom:18px"><div class="mini-metric"><strong>${notices.length}</strong><span>Segnalazioni</span></div><div class="mini-metric"><strong>${notices.filter(x=>x.type==='Posti solo storico').length}</strong><span>Viaggi con posti legacy</span></div></div>`+
 mainPanel('Segnalazioni da controllare',table(notices,[['TIPO',x=>status(x.type)],['RIFERIMENTO',x=>esc(x.name)],['MOTIVO',x=>esc(x.detail)],['DETTAGLIO',x=>x.id?linkById('control',x.id,'Apri'):'—']]))+
 cardInfo('L’assistente non cambia prenotazioni, quote o piantine. Le decisioni operative spettano all’organizzazione.', 'info');
}
// Upgrade existing pages, keeping visual design and advanced Control Room.
renders.rentals=pageRentals;
renders.economy=pageEconomy;
renders.assistant=pageAssistant;
renders.archive=pageDocuments;
renders.agenda=pageDeadlines;
renders.tasks=pageDeadlines;
renders.quotes=pageQuotes;
renders.documents=pageDocuments;
renders.invoices=pageInvoices;
renders.transfers=pageTransfers;
renders.drivers=pageDriver;
renders.settings=pageSettings;
renders.customers=pageCRM;
renders.cash=()=>pageAccounting();
renders.nicola=()=>pageAccounting('Nicola');
renders.raffaele=()=>pageAccounting('Raffaele');
renders.layouts=pageSeatLayouts;
renders.bookings=pageBookingsEnhanced;
renders.trips=pageTripsEnhanced;
renders.payments=pagePaymentsEnhanced;
renders.control=pageControlEnhanced;
renders.whatsapp=pageWhatsappEnhanced;
renders.reports=pageReportsEnhanced;
// Add modules not present in original menu as navigable items.
NAV[2][1]=NAV[2][1].filter(([id])=>id!=='agenda');NAV[4][1].unshift(['agenda','◷','Agenda']);
const attachPrev=attachPageEvents;
attachPageEvents=function(){
  // Original handlers depend on original render functions. Wrap replacements where necessary.
  if(page==='bookings'&&$('#filter-bookings')){
    const update=()=>{const q=$('#filter-bookings').value.toLocaleLowerCase('it'),id=$('#bookings-trip').value;
      const names=Object.fromEntries((cache.trips||DTRIPS).map(t=>[t.id,titleOf(t)]));
      $('#table-bookings').innerHTML=renderBookingsEnhanced((cache.bookings||DBOOKINGS).filter(x=>(!id||x.viaggio_id===id)&&[x.cliente_nome,x.cliente,x.fermata_partenza,names[x.viaggio_id]].join(' ').toLocaleLowerCase('it').includes(q)),names)};
    if(isDemo()){cache.bookings=DBOOKINGS;cache.trips=DTRIPS;}
    $('#filter-bookings').addEventListener('input',update);$('#bookings-trip').addEventListener('change',update);
  }else if(page==='customers'&&$('#filter-customers')){
    if(isDemo()){cache.customers=DEMO.customers;cache.bookings=DEMO.bookings;}
    $('#filter-customers').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase('it');$('#customers-table').innerHTML=renderCustomersEnhanced((cache.customers||[]).filter(x=>[x.nome,x.cognome,x.telefono,x.email].join(' ').toLocaleLowerCase('it').includes(q)),cache.bookings||[])});
  }else attachPrev();
};
document.addEventListener('click',async e=>{
 const d=e.target.closest('[data-create]'),a=e.target.closest('[data-action]'),seat=e.target.closest('[data-seatnum]'),close=e.target.closest('[data-dismiss]'),download=e.target.closest('[data-storage-path]');
 if(close){closeModal();return}
 if(seat){const n=Number(seat.dataset.seatnum);if(draftOccupied.has(n))return;
  if(draftSelected.has(n))draftSelected.delete(n);else draftSelected.add(n);
  seat.classList.toggle('selected',draftSelected.has(n));seat.setAttribute('aria-label',`Posto ${n} ${draftSelected.has(n)?'selezionato':'libero'}`);
  $('#chosen-count').textContent=`${draftSelected.size} sedili selezionati`;return;
 }
 try{if(download){requireLive();await DGData.downloadPrivate(download.dataset.storageBucket,download.dataset.storagePath)}if(d)await openCreate(d.dataset.create);if(a)await actionClicked(a.dataset.action,a.dataset.id)}catch(error){toast(error.message);}
});
document.addEventListener('submit',async e=>{if(e.target?.id!=='dg-form')return;e.preventDefault();const b=e.target.querySelector('button[type=submit]');if(b)b.disabled=true;
 try{await submitForm(e.target)}catch(error){const holder=$('#dg-form-error');if(holder){holder.textContent=error.message;holder.hidden=false}else toast(error.message)}finally{if(b)b.disabled=false;}
});
