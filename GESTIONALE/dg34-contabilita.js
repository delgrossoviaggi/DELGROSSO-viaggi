/* DELGROSSO VIAGGI — DG34 · contabilita' integrata nel V2 classico.
   LETTURE AUTENTICATE RLS: non usa service_role, non scrive tabelle e non memorizza dati sensibili.
   Modello soldi in centesimi DG2OperatorLedger, documenti DG2Pdf già nel V2 Fusion.
 */
(function DG34Finance(){
 'use strict';
 const PREFIX='dg34-', BASE_ROUTES=['dg34-cassa','dg34-nicola','dg34-raffaele','dg34-economia','dg34-moduli','dg34-diagnostica'];
 const R=Object.freeze({
  payments:['pagamenti','id,prenotazione_id,viaggio_id,cliente,importo,tipo,stato,metodo,metodo_pagamento,incassato_da,incassato_da_user_id,receipt_number,data_pagamento,created_at'],
  operators:['operatori_gestionale','user_id,username,nome,attivo'],
  transfers:['cassa_trasferimenti','id,da_operatore_user_id,a_operatore_user_id,importo,data_trasferimento,stato,note'],
  trips:['viaggi','id,titolo,destinazione,data_partenza,autobus,bis_parent_id,bis_numero,posti_totali,archiviato_at'],
  bookings:['prenotazioni','id,viaggio_id,cliente,cliente_nome,posti,totale,pagato,stato,codice,fermata_partenza'],
  economy:['economia_movimenti','id,tipo,categoria,descrizione,importo,data_movimento,metodo,viaggio_id,noleggio_id,origine,pagamento_id,noleggio_pagamento_id,operatore'],
  rentalPayments:['noleggi_bus_pagamenti','id,noleggio_id,tipo,importo,metodo,data_pagamento,incassato_da,incassato_da_user_id,receipt_number'],
  rentals:['noleggi_bus','id,referente,azienda,tratta_partenza,tratta_destinazione,data_partenza,stato_noleggio,archiviato_at'],
  cashClosures:['cassa_chiusure','id,data_chiusura,operatore,saldo_teorico,contanti_contati,differenza,created_at']
 });
 const REQUIRED=['payments','operators','transfers','trips','bookings'];
 const ALL=[...REQUIRED,'economy','rentalPayments','rentals','cashClosures'];
 let snapshot=null,expires=0,loading=null,renderSeq=0,activeTrip='',search='',historyFilter='';
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const eurC=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((Number(x)||0)/100);
 const eur=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(x)||0);
 const moneyC=x=>{const v=Number(x);return Number.isFinite(v)?Math.round(v*100):null};
 const date=x=>{const d=String(x||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return '—';return d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4)};
 const n=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const key=x=>String(x??'');
 const registered=p=>/^(registrato|confermato|pagato|eseguito|completato)$/i.test(String(p.stato||'').trim());
 const isRefund=p=>/rimborso/i.test(String(p.tipo||''));
 const cashMethod=p=>/^(contanti|contante|cash|denaro contante)$/.test(n(p.metodo_pagamento||p.metodo));
 const el=id=>document.getElementById(id);
 const sheet=(title,sub,buttons,body)=>`<div class="dg34-head"><div><small>DELGROSSO V2 FUSION · DG34 · CONTABILITÀ REALE</small><h2>${safe(title)}</h2><p>${safe(sub)}</p></div><div class="dg34-actions">${buttons||''}</div></div>${body}`;
 const button=(name,action,extra='')=>`<button type="button" class="btn btn-secondary btn-sm" data-dg34="${action}" ${extra}>${name}</button>`;
 const label=(s,type='info')=>`<span class="dg34-pill ${type}">${safe(s)}</span>`;
 const note=(s,type='warning')=>`<div class="dg34-note ${type}">${safe(s)}</div>`;
 const table=(headers,rows)=>`<div class="dg34-scroll"><table class="dg34-table"><thead><tr>${headers.map(h=>`<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="dg34-empty">Nessun dato nel filtro selezionato.</td></tr>`}</tbody></table></div>`;
 const tr=c=>`<tr>${c.map(s=>`<td>${s}</td>`).join('')}</tr>`;
 const pane=(t,body)=>`<div class="dg34-panel"><h3>${safe(t)}</h3>${body}</div>`;
 const stat=(t,v,sub)=>`<div class="dg34-stat"><small>${safe(t)}</small><strong>${v}</strong><span>${safe(sub||'')}</span></div>`;
 const guardLogin=()=>{if(typeof authSession==='undefined'||!authSession?.access_token||!authSession?.user?.id)throw Error('Accedi con il tuo profilo Nicola o Raffaele. La contabilità non è disponibile senza una sessione Supabase autorizzata.');return authSession.user.id};
 async function paged(tab,fields){
  const rows=[],size=400,limit=10000;
  for(let offset=0;offset<limit;offset+=size){
   const q=new URLSearchParams({select:fields,limit:String(size),offset:String(offset),order:(tab==='operatori_gestionale'?'user_id.asc':'id.asc')});
   const part=await api(tab,q.toString(),{noCache:true,timeout:16000});
   if(!Array.isArray(part))throw Error('Risposta inattesa da '+tab);
   rows.push(...part);if(part.length<size)return rows;
  }
  throw Error(tab+': troppi dati per il caricamento completo. Non sono stati calcolati totali parziali.');
 }
 async function load(force=false){
  const user=guardLogin();
  if(snapshot&&snapshot.user!==user){snapshot=null;expires=0;loading=null}
  if(!force&&snapshot&&Date.now()<expires)return snapshot;
  if(loading)return loading;
  loading=(async()=>{
    const data={user,errors:{},loadedAt:new Date(),tables:{}};
    // Esegue al massimo tre query contemporaneamente per non bloccare il browser.
    for(let i=0;i<ALL.length;i+=3){
      await Promise.all(ALL.slice(i,i+3).map(async k=>{
        const [t,f]=R[k];try{data.tables[k]=await paged(t,f)}catch(e){data.errors[k]=e.message;data.tables[k]=null}
      }));
    }
    if(guardLogin()!==user)throw Error('Operatore cambiato durante il caricamento. Ripetere la sincronizzazione.');
    const failures=REQUIRED.filter(k=>data.errors[k]);
    if(failures.length)throw Error('Archivi contabili non leggibili ('+failures.map(k=>R[k][0]+': '+data.errors[k]).join(' | ')+'). Nessun totale parziale è stato visualizzato.');
    const Model=window.DG2OperatorLedger;
    if(!Model?.build)throw Error('Modulo contabile mancante: controlla suite/operator-ledger.js nello ZIP.');
    data.model=Model.build({trips:data.tables.trips,bookings:data.tables.bookings,payments:data.tables.payments,operators:data.tables.operators,transfers:data.tables.transfers});
    data.rentals=buildRental(data);
    data.coherent=verify(data);
    snapshot=data;expires=Date.now()+45000;
    return data;
  })();
  try{return await loading}finally{loading=null}
 }
 function verify(data){
  const all=data.tables.payments.filter(registered),total=all.reduce((s,p)=>s+(isRefund(p)?-Math.abs(moneyC(p.importo)||0):(moneyC(p.importo)||0)),0);
  const mods=data.model.profiles;
  const calculated=mods.nicola.net+mods.raffaele.net+mods.nonAttribuiti.net;
  if(total!==calculated)throw Error(`Quadratura contabile non riuscita: tabella pagamenti ${eurC(total)}, modello ${eurC(calculated)}. Nessun report approvabile.`);
  return {total,calculated,count:all.length,rowsFetched:data.tables.payments.length};
 }
 function whoFor(p,byId){
  const id=key(p.incassato_da_user_id),op=id?byId.get(id):null;
  const name=id?(op||''):n(p.incassato_da);
  return name==='nicola'||name==='raffaele'?name:'nonAttribuiti';
 }
 function buildRental(data){
  if(data.errors.rentalPayments||data.errors.rentals)return null;
  const byId=new Map(data.tables.operators.filter(x=>x.attivo!==false).map(o=>[key(o.user_id),n(o.username||o.nome)]));
  const byRental=new Map((data.tables.rentals||[]).map(r=>[key(r.id),r]));
  const result={nicola:{net:0,cash:0,electronic:0,other:0,items:[]},raffaele:{net:0,cash:0,electronic:0,other:0,items:[]},nonAttribuiti:{net:0,cash:0,electronic:0,other:0,items:[]},issues:[]};
  const seen=new Set();
  for(const p of data.tables.rentalPayments){
   if(seen.has(key(p.id)))continue;seen.add(key(p.id));
   const amount=moneyC(p.importo);
   if(amount===null){result.issues.push('Importo noleggio non valido: '+key(p.id));continue}
   const who=whoFor(p,byId),row={id:p.id,amount:isRefund(p)?-Math.abs(amount):amount,who,method:p.metodo||'Non indicato',date:p.data_pagamento||'',receipt:p.receipt_number||'',rental:byRental.get(key(p.noleggio_id))?.referente||byRental.get(key(p.noleggio_id))?.azienda||'Noleggio',kind:p.tipo||'Pagamento'};
   const out=result[who];out.net+=row.amount;const m=n(p.metodo);
   if(cashMethod(p))out.cash+=row.amount;
   else if(/carta|pos|bancomat|bonific|stripe|paypal|satispay|online/i.test(m))out.electronic+=row.amount;
   else out.other+=row.amount;
   out.items.push(row);
  }
  return result;
 }
 const totalTrip=acc=>acc.nicola.net+acc.raffaele.net+acc.nonAttribuiti.net;
 const totalRental=acc=>acc?.nicola.net+acc?.raffaele.net+acc?.nonAttribuiti.net||0;
 const problems=data=>Object.entries(data.errors).map(([k,x])=>R[k][0]+': '+x);
 function routeMenu(){
  const list=[['dg34-cassa','Cassa generale'],['dg34-nicola','Contabilità Nicola'],['dg34-raffaele','Contabilità Raffaele'],['dg34-economia','Economia e noleggi'],['dg34-moduli','Tutte le sezioni V2'],['dg34-diagnostica','Verifica Supabase']];
  return `<div class="dg34-tabs">${list.map(([p,s])=>`<button type="button" data-dg34="route" data-route="${p}" class="${state?.page===p?'active':''}">${safe(s)}</button>`).join('')}</div>`;
 }
 function totalsTable(data){const profiles=data.model.profiles,rental=data.rentals;
  const labels=[['nicola','Nicola'],['raffaele','Raffaele'],['nonAttribuiti','Da attribuire']];
  return table(['Operatore','Viaggi · netto','Noleggi · netto','Totale registrato','Contanti viaggi','Trasferimenti netti'],labels.map(([k,t])=>{
   const p=profiles[k],rent=rental?.[k];return tr([`<b>${t}</b>`,eurC(p.net),rent?eurC(rent.net):'Non disponibile',rent?`<b>${eurC(p.net+rent.net)}</b>`:'—',eurC(p.cash),eurC(p.transferredIn-p.transferredOut)]);
  }));
 }
 function renderCassa(data){const p=data.model.profiles,r=data.rentals,all=totalTrip(p)+(r?totalRental(r):0);
  const totalCash=p.nicola.cash+p.raffaele.cash+p.nonAttribuiti.cash+(r?r.nicola.cash+r.raffaele.cash+r.nonAttribuiti.cash:0);
  const tickets=[stat('Incassi netti viaggi',eurC(totalTrip(p)),'Acconti e saldi meno rimborsi'),stat('Incassi netti noleggi',r?eurC(totalRental(r)):'—',r?'Registro separato':'Tabella non accessibile'),stat('Totale incassi registrati',r?eurC(all):'—','Non somma di nuovo Economia'),stat('Contanti registrati',r?eurC(totalCash):'—','Prima della quadratura fisica')].join('');
  const groups=[...p.nicola.trips,...p.raffaele.trips,...p.nonAttribuiti.trips];const byGroup=new Map();
  groups.forEach(g=>{let v=byGroup.get(g.id);if(!v){v={trip:g.trip,net:0,count:0,nicola:0,raffaele:0,nonAttribuiti:0};byGroup.set(g.id,v)}v.net+=g.net;v.count+=g.movements.length;v[g.movements[0]?.who||'nonAttribuiti']+=g.net});
  // Ricalcola l'importo per ciascun operatore: nello stesso viaggio possono esserci movimenti di più operatori.
  const tripRows=[...byGroup.entries()].map(([id,v])=>{for(const k of ['nicola','raffaele','nonAttribuiti'])v[k]=(p[k].trips.find(g=>g.id===id)?.net)||0;
   return tr([`<b>${safe(v.trip?.titolo||'Viaggio')}</b><small>${date(v.trip?.data_partenza)}</small>`,eurC(v.nicola),eurC(v.raffaele),eurC(v.nonAttribuiti),`<b>${eurC(v.net)}</b>`,String(v.count),button('Apri','trip',`data-trip="${safe(id)}"`)]);
  });
  const transferRows=data.tables.transfers.map(t=>tr([date(t.data_trasferimento),safe(data.tables.operators.find(x=>x.user_id===t.da_operatore_user_id)?.nome||'—'),safe(data.tables.operators.find(x=>x.user_id===t.a_operatore_user_id)?.nome||'—'),eur(t.importo),safe(t.stato)]));
  return sheet('Cassa generale · Nicola e Raffaele','Dati direttamente da Supabase, nessuna attribuzione automatica dei pagamenti senza operatore',button('Aggiorna da Supabase','refresh')+button('Scarica CSV','csv-cassa')+button('Registra incasso nel V2','payments'),`<div class="dg34-kpis">${tickets}</div>`+pane('Contabilità per operatore',totalsTable(data))+pane('Incassi raggruppati per viaggio · BUS BIS incluso',table(['Viaggio','Nicola','Raffaele','Da attribuire','Netto','N. pag.',''],tripRows))+pane('Trasferimenti cassa (non sono nuovi incassi)',table(['Data','Da','A','Importo','Stato'],transferRows))+note('Le somme di pagamenti, noleggi e movimenti Economia sono registri differenti. Non vengono sommate due volte. Il saldo contanti fisico richiede anche le chiusure e le spese di cassa.','info'));
 }
 function renderPerson(data,who){const prof=data.model.profiles[who],rent=data.rentals?.[who],title=who==='nicola'?'Nicola':'Raffaele';
  const selected=activeTrip||'',q=n(search),movs=prof.movements.filter(x=>(!selected||x.rootTripId===selected)&&(n([x.client,x.trip,x.receipt,x.booking].join(' ')).includes(q)));
  const allTripChoices=[...new Map(prof.trips.map(g=>[g.id,g.trip])).entries()];
  const choices=`<div class="dg34-filters"><label>Viaggio<select id="dg34-trip"><option value="">Tutti i viaggi</option>${allTripChoices.map(([id,t])=>`<option value="${safe(id)}" ${id===selected?'selected':''}>${safe(t?.titolo||'Viaggio')} · ${date(t?.data_partenza)}</option>`).join('')}</select></label><label>Cliente o ricevuta<input id="dg34-search" type="search" value="${safe(search)}" placeholder="Cerca cliente, ricevuta, numero..." autocomplete="off"></label></div>`;
  const rows=movs.map(m=>tr([date(m.date),`<b>${safe(m.client)}</b><small>${safe(m.receipt)}</small>`,safe(m.trip)+(m.bus>1?' · BUS '+m.bus:''),safe(m.method),m.refund?label('Rimborso','warn'):label('Incasso','ok'),`<b>${eurC(m.amount)}</b>`]));
  const trips=prof.trips.map(g=>tr([safe(g.trip?.titolo||'—')+'<small>'+date(g.trip?.data_partenza)+'</small>',eurC(g.net),eurC(g.cash),eurC(g.electronic),String(g.movements.length),button('PDF viaggio','pdf-person-trip',`data-who="${who}" data-trip="${safe(g.id)}"`)]));
  const rents=rent?table(['Data','Noleggio','Tipo','Metodo','Importo'],rent.items.map(m=>tr([date(m.date),safe(m.rental),safe(m.kind),safe(m.method),eurC(m.amount)]))):note('La tabella dei pagamenti noleggi non è leggibile: il totale noleggi non è incluso.');
  const kpis=[stat('Gite · netto',eurC(prof.net),'Incassi - rimborsi'),stat('Gite · contanti',eurC(prof.cash),'Non include POS/bonifici'),stat('Gite · elettronici',eurC(prof.electronic),'POS e bonifici'),stat('Noleggi · netto',rent?eurC(rent.net):'—','Registro noleggi separato'),stat('Trasferimenti ricevuti',eurC(prof.transferredIn),'Trasferimenti interni'),stat('Trasferimenti consegnati',eurC(prof.transferredOut),'Non sottrarre dagli incassi')].join('');
  const financeSection=pane('Cerca incassi, acconti, saldi e rimborsi',
    choices+`<div id="dg34-person-table">${table(['Data','Cliente / ricevuta','Viaggio / BUS','Metodo','Tipo','Importo'],rows)}</div>`)+
    `<p class="dg34-caption">${movs.length} movimenti nel filtro; i totali in alto includono tutti i movimenti attribuiti all'operatore.</p>`;
  const tripSection=pane('Riepilogo per viaggio',table(['Viaggio','Netto','Contanti','POS/bonifici','Movimenti',''],trips));
  const rentSection=pane('Noleggi · registro indipendente',rents);
  const cashSection=pane('Quadratura contanti',
    `<div class="dg34-stats-inline">Contanti gite ${eurC(prof.cash)} + Contanti noleggi ${rent?eurC(rent.cash):'—'} + Trasferimenti ricevuti ${eurC(prof.transferredIn)} − Trasferimenti consegnati ${eurC(prof.transferredOut)}</div>`+
    note('Il denaro effettivamente in cassa può differire per spese, prelievi o chiusure non riconciliate. Non rappresentiamo questo totale come saldo bancario.','info'));
  const buttons=button('Aggiorna','refresh')+button('PDF contabilità '+title,'pdf-person',`data-who="${who}"`)+button('CSV','csv-person',`data-who="${who}"`);
  return sheet('Contabilità '+title,'Tutti i movimenti registrati da '+title+'; nessun importo inventato',buttons,
    `<div class="dg34-kpis">${kpis}</div>`+financeSection+tripSection+rentSection+cashSection);

 }
 function renderEconomy(data){
  if(data.errors.economy)return sheet('Economia, noleggi e chiusure','Controlli dei movimenti registrati',button('Aggiorna','refresh'),note(data.errors.economy));
  const eco=data.tables.economy,ent=eco.filter(m=>n(m.tipo)==='entrata'),usc=eco.filter(m=>n(m.tipo)==='uscita');
  const sum=a=>a.reduce((p,x)=>p+Math.abs(moneyC(x.importo)||0),0);
  const movementRows=eco.slice().sort((a,b)=>key(b.data_movimento).localeCompare(key(a.data_movimento))).slice(0,250).map(m=>tr([date(m.data_movimento),safe(m.tipo),safe(m.categoria),safe(m.descrizione),eur(m.importo),safe(m.origine||'—'),safe(m.operatore||'—')]));
  const cierre=data.tables.cashClosures||[];
  const crows=cierre.map(m=>tr([date(m.data_chiusura),safe(m.operatore),eur(m.saldo_teorico),eur(m.contanti_contati),eur(m.differenza)]));
  return sheet('Economia e contabilità noleggi','La tabella Economia è un registro distinto dagli incassi delle prenotazioni',button('Aggiorna','refresh')+button('CSV Economia','csv-economia')+button('Apri Economia V2','economy'),`<div class="dg34-kpis">${stat('Entrate Economia',eurC(sum(ent)),'Registrazioni contabili')}${stat('Uscite Economia',eurC(sum(usc)),'Registrazioni contabili')}${stat('Saldo registrato',eurC(sum(ent)-sum(usc)),'Non aggiunge incassi di nuovo')}${stat('Chiusure cassa',data.errors.cashClosures?'—':String(cierre.length),'Da riconciliare per operatore')}</div>`+pane('Movimenti Economia recenti',table(['Data','Tipo','Categoria','Descrizione','Importo','Origine','Operatore'],movementRows))+pane('Chiusure cassa storiche',data.errors.cashClosures?note(data.errors.cashClosures):table(['Data','Operatore','Teorico','Contanti contati','Differenza'],crows))+note('Le entrate provenienti automaticamente da pagamenti e noleggi possono essere già incluse nel registro Economia: non sommarle ai pagamenti una seconda volta.','info'));
 }
 function renderDiagnostics(data){
  const rows=ALL.map(k=>tr([safe(R[k][0]),data.errors[k]?label('NON LEGGIBILE','warn'):label('OK','ok'),data.errors[k]?safe(data.errors[k]):String(data.tables[k]?.length||0)]));
  return sheet('Verifica collegamento Supabase','Diagnostica di lettura effettuata dall’operatore V2 autenticato',button('Verifica di nuovo','refresh'),`<div class="dg34-kpis">${stat('Utente','Autenticato','RLS Supabase')}${stat('Movimenti pagamenti',String(data.coherent.rowsFetched),'Tabella pagamenti')}${stat('Movimenti riconciliati',String(data.coherent.count),'Registrati')}${stat('Controllo totale',eurC(data.coherent.total),'Somma in centesimi verificata')}</div>`+pane('Stato dei moduli',table(['Tabella','Stato','Righe / errore'],rows))+pane('Eventuali segnalazioni',data.model.issues.length?data.model.issues.map(x=>note(x)).join(''):'<p class="dg34-success">Nessuna anomalia rilevata dal modello dei pagamenti.</p>')+note('La lettura autenticata non certifica le scritture di prenotazioni, incassi e rimborsi. Queste richiedono test transazionali dedicati prima del rilascio finale.','info'));
 }
 function renderModules(data){
  const links=[['Dashboard V2','dashboard'],['Viaggi e BUS BIS','viaggi'],['Prenotazioni','prenotazioni'],['Control Room e check-in','controlroom'],['Contabilità Nicola','dg34-nicola'],['Contabilità Raffaele','dg34-raffaele'],['Cassa generale','dg34-cassa'],['Economia e movimenti','economia'],['Pagamenti e ricevute','pagamenti'],['Archivio documenti','documenti'],['Agenda e scadenze','agenda'],['Clienti e CRM','clienti'],['Noleggi BUS','noleggi'],['Flotta','flotta'],['Fornitori e costi','fornitori'],['WhatsApp Business','whatsapp'],['Preventivi','preventivi'],['Backup & export','backup'],['Diagnostica Supabase','dg34-diagnostica']];
  return sheet('Tutte le sezioni del V2 Fusion','I vecchi moduli rimangono nel gestionale originale; le integrazioni contabili hanno accesso diretto',button('Aggiorna dati contabili','refresh'),`<div class="dg34-menu-grid">${links.map(([label,route])=>`<button type="button" data-dg34="route" data-route="${route}">${safe(label)} <span>Apri ›</span></button>`).join('')}</div>`+pane('Diagnostica archivio contabile',`<p>Caricati: <b>${data.tables.trips.length} viaggi</b>, <b>${data.tables.bookings.length} prenotazioni</b>, <b>${data.tables.payments.length} pagamenti</b> e <b>${data.tables.transfers.length} trasferimenti</b>.</p>`)+note('Le sezioni legacy V2 mantengono le loro funzioni originali. Questa integrazione non dichiara collaudate tutte le operazioni di scrittura degli altri moduli.','info'));
 }
 function renderTrip(data,id){const p=data.model.profiles;
  const t=data.tables.trips.find(x=>key(x.id)===id);const root=t||data.tables.trips.find(x=>x.bis_parent_id===id);
  if(!root)throw Error('Viaggio non trovato');
  const m=['nicola','raffaele','nonAttribuiti'].flatMap(k=>p[k].movements.filter(x=>x.rootTripId===id));
  const body=table(['Data','Operatore','Cliente','Tipo','Metodo','Importo'],m.map(x=>tr([date(x.date),safe(x.who),safe(x.client),x.refund?'Rimborso':'Incasso',safe(x.method),eurC(x.amount)])));
  return sheet('Contabilità viaggio · '+(root.titolo||root.destinazione||''),'BUS/BIS raggruppati senza duplicare i pagamenti',button('Torna alla cassa','route','data-route="dg34-cassa"')+button('PDF Nicola viaggio','pdf-person-trip',`data-who="nicola" data-trip="${safe(id)}"`)+button('PDF Raffaele viaggio','pdf-person-trip',`data-who="raffaele" data-trip="${safe(id)}"`),pane('Movimenti collegati al viaggio',body)+`<div class="dg34-kpis">${stat('Totale netto',eurC(m.reduce((a,x)=>a+x.amount,0)),'Solo registro viaggi')}${stat('Movimenti',String(m.length),'Incassi e rimborsi')}</div>`);
 }
 function pageTitle(route){return {'dg34-cassa':'Cassa generale','dg34-nicola':'Contabilità Nicola','dg34-raffaele':'Contabilità Raffaele','dg34-economia':'Economia e noleggi','dg34-moduli':'Tutte le funzioni','dg34-diagnostica':'Stato Supabase'}[route]||'Contabilità viaggio'}
 async function renderRoute(route,{force=false}={}){
  const target=el('page-'+route),localSeq=++renderSeq;if(!target)return;
  target.innerHTML=routeMenu()+`<div class="dg34-loading" role="status">◌ Verifica contabile autenticata in corso…</div>`;
  try{
   const data=await load(force);if(localSeq!==renderSeq||state.page!==route)return;
   const content=route==='dg34-cassa'?renderCassa(data):route==='dg34-nicola'?renderPerson(data,'nicola'):route==='dg34-raffaele'?renderPerson(data,'raffaele'):route==='dg34-economia'?renderEconomy(data):route==='dg34-diagnostica'?renderDiagnostics(data):renderModules(data);
   target.innerHTML=routeMenu()+`<div class="dg34-content">${content}</div>`+`<p class="dg34-stamp">Ultimo aggiornamento: ${safe(data.loadedAt.toLocaleString('it-IT'))} · visibilità limitata ai permessi del tuo operatore Supabase</p>`;
  }catch(err){if(localSeq!==renderSeq||state.page!==route)return;target.innerHTML=routeMenu()+`<div class="dg34-content">${sheet(pageTitle(route),'Nessun totale sarà mostrato finché la lettura non sarà completa',button('Riprova sincronizzazione','refresh'),note(err.message))}</div>`}
 }
 function exportCsv(rows,name){
  const clean=v=>{let s=String(v??'').replace(/\r?\n/g,' ').trim();if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const body='\ufeff'+rows.map(r=>r.map(clean).join(';')).join('\r\n');
  const blob=new Blob([body],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 async function onAction(action,node){
  const route=node.dataset.route,who=node.dataset.who==='raffaele'?'raffaele':'nicola';
  if(action==='route')return window.go(route);
  if(action==='payments')return window.go('pagamenti');
  if(action==='economy')return window.go('economia');
  if(action==='refresh'){expires=0;snapshot=null;return renderRoute(state.page,{force:true})}
  const data=await load();
  if(action==='trip')return (async()=>{const original=state.page,id=node.dataset.trip;const frame=el('page-'+original);if(!frame)return;
   frame.innerHTML=routeMenu()+renderTrip(data,id);})();
  if(action==='pdf-person'||action==='pdf-person-trip'){
   if(!window.DG2Pdf?.saveOperatorPdf)throw Error('Generatore PDF assente: manca suite/pdf-report.js');
   const selectedTrip=action==='pdf-person-trip'?node.dataset.trip:'';
   const outputProfile={...data.model.profiles[who],rentals:selectedTrip?null:data.rentals?.[who]};
   const file=window.DG2Pdf.saveOperatorPdf(outputProfile,selectedTrip);
   notifyOk('PDF creato: '+file);return;
  }
  if(action==='csv-person'){
   const p=data.model.profiles[who];return exportCsv([['Data','Operatore','Cliente','Viaggio','BUS','Ricevuta','Metodo','Tipo','Importo EUR'],...p.movements.map(x=>[x.date,who,x.client,x.trip,x.bus,x.receipt,x.method,x.refund?'Rimborso':'Incasso',(x.amount/100).toFixed(2)])],'DELGROSSO_CONTABILITA_'+who.toUpperCase());
  }
  if(action==='csv-economia'){
   if(data.errors.economy)throw Error(data.errors.economy);
   return exportCsv([['Data','Tipo','Categoria','Descrizione','Importo EUR','Origine','Operatore'],...data.tables.economy.map(x=>[x.data_movimento,x.tipo,x.categoria,x.descrizione,x.importo,x.origine,x.operatore])],'DELGROSSO_ECONOMIA_SUPABASE');
  }
  if(action==='csv-cassa'){
   const p=data.model.profiles,r=data.rentals;
   return exportCsv([['Operatore','Viaggi netto EUR','Noleggi netto EUR','Contanti viaggi EUR','Trasferimenti ricevuti EUR','Trasferimenti consegnati EUR'],...['nicola','raffaele','nonAttribuiti'].map(k=>[k,(p[k].net/100).toFixed(2),r?(r[k].net/100).toFixed(2):'NON DISPONIBILE',(p[k].cash/100).toFixed(2),(p[k].transferredIn/100).toFixed(2),(p[k].transferredOut/100).toFixed(2)])],'DELGROSSO_CASSA_RICONCILIAZIONE');
  }
 }
 function notifyOk(t){if(typeof toast==='function')toast(t);else console.info(t)}
 function inject(){
  const host=document.querySelector('main.main > .content')||document.querySelector('main .content')||document.querySelector('main');if(!host||typeof window.go!=='function')return;
  BASE_ROUTES.forEach(x=>{if(el('page-'+x))return;const s=document.createElement('section');s.className='page dg34-page';s.id='page-'+x;host.append(s)});
  const nav=el('sideNav'),prior=nav?.querySelector('[data-page="contabilitaquote"]');
  const items=[['dg34-cassa','◈','Cassa generale'],['dg34-nicola','€','Contabilità Nicola'],['dg34-raffaele','€','Contabilità Raffaele'],['dg34-economia','▥','Economia e noleggi'],['dg34-moduli','▦','Tutti i moduli'],['dg34-diagnostica','✓','Stato Supabase']];
  if(nav){
   const anchor=prior||nav.querySelector('[data-page="pagamenti"]');
   for(const [route,icon,title]of items){if(nav.querySelector(`[data-page="${route}"]`))continue;
    const b=document.createElement('button');b.type='button';b.dataset.page=route;b.className='dg34-nav';b.innerHTML=`<span class="ico">${icon}</span><span>${safe(title)}</span>`;anchor?.parentNode?.insertBefore(b,anchor);}
  }
  const mobile=document.querySelector('.mobile-menu-grid');if(mobile){
   const first=mobile.querySelector('button[onclick*="dgSuiteOpen(\'cassa"]');
   for(const [route,icon,title]of items){if(mobile.querySelector(`[data-dg34-route="${route}"]`))continue;
    const b=document.createElement('button');b.type='button';b.dataset.dg34Route=route;b.innerHTML=`${icon}<span>${safe(title)}</span>`;mobile.insertBefore(b,first||null);}
  }
  if(typeof PAGE_META!=='undefined')Object.assign(PAGE_META,{
   'dg34-cassa':['Cassa generale','Incassi e trasferimenti, lettura Supabase'],
   'dg34-nicola':['Contabilità Nicola','Quote, versamenti, rimborsi e PDF'],
   'dg34-raffaele':['Contabilità Raffaele','Quote, versamenti, rimborsi e PDF'],
   'dg34-economia':['Economia e noleggi','Registri separati, niente doppi conteggi'],
   'dg34-moduli':['Tutti i moduli','Funzioni originali V2 e integrazioni'],
   'dg34-diagnostica':['Diagnostica Supabase','Stato tabelle e quadratura pagamenti']});
  const oldGo=window.go;window.go=function(route){
   const r=oldGo(route);if(BASE_ROUTES.includes(route)){activeTrip='';search='';renderRoute(route)}return r;
  };
  // I pulsanti data-page del V2 sono gestiti dai listener originali, mentre su Safari
  // i nuovi link appaiono anche quando il menu viene ricostruito.
  nav?.addEventListener('click',e=>{const b=e.target.closest('.dg34-nav');if(!b)return;e.preventDefault();e.stopImmediatePropagation();window.go(b.dataset.page)},true);
  mobile?.addEventListener('click',e=>{const b=e.target.closest('[data-dg34-route]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();window.go(b.dataset.dg34Route);if(typeof toggleMobileMenu==='function')toggleMobileMenu(false)},true);
  document.addEventListener('click',e=>{
   const b=e.target.closest('[data-dg34]');if(!b)return;e.preventDefault();if(b.disabled)return;
   onAction(b.dataset.dg34,b).catch(err=>{notifyOk('Errore: '+err.message);console.warn('DG34:',err.message)});
  });
  document.addEventListener('change',e=>{if(e.target.id==='dg34-trip'){activeTrip=e.target.value;renderRoute(state.page)}},true);
  document.addEventListener('input',e=>{if(e.target.id!=='dg34-search')return;search=e.target.value;
   // Aggiorna SOLO le righe senza distruggere l'input o far perdere il focus su iPhone.
   clearTimeout(inject.searchTimer);inject.searchTimer=setTimeout(()=>{
    const route=state?.page,which=route==='dg34-nicola'?'nicola':route==='dg34-raffaele'?'raffaele':null;
    const target=el('dg34-person-table');if(!which||!snapshot||!target)return;
    const profile=snapshot.model.profiles[which],query=n(search);
    const rows=profile.movements.filter(x=>(!activeTrip||x.rootTripId===activeTrip)&&n([x.client,x.trip,x.receipt,x.booking].join(' ')).includes(query))
      .map(m=>tr([date(m.date),`<b>${safe(m.client)}</b><small>${safe(m.receipt)}</small>`,safe(m.trip)+(m.bus>1?' · BUS '+m.bus:''),safe(m.method),m.refund?label('Rimborso','warn'):label('Incasso','ok'),`<b>${eurC(m.amount)}</b>`]));
    target.innerHTML=table(['Data','Cliente / ricevuta','Viaggio / BUS','Metodo','Tipo','Importo'],rows);
   },180);
  },true);
  // Invalida anche i report privati al logout V2, senza conservare dati localmente.
  const previousLogout=window.dgSuiteLogout;
  if(typeof previousLogout==='function')window.dgSuiteLogout=function(...args){snapshot=null;expires=0;loading=null;renderSeq++;
   for(const route of BASE_ROUTES){const x=el('page-'+route);if(x)x.textContent='Sessione terminata. Effettua il login per visualizzare la contabilità.';}
   return previousLogout.apply(this,args);
  };
  if(state?.page&&BASE_ROUTES.includes(state.page))renderRoute(state.page);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
 // Nessun accesso SQL in background: carica soltanto quando una pagina viene aperta.
 window.DG34Finance=Object.freeze({version:'DG34.1',invalidate:()=>{snapshot=null;expires=0},get status(){return snapshot?{loadedAt:snapshot.loadedAt,errors:Object.keys(snapshot.errors)}:null}});
})();
