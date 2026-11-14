/* DELGROSSO VIAGGI 3.0 ULTIMATE v2.4 — Ultime prenotazioni e notifiche in diretta.
   Ordine per timestamp di creazione, NON per data partenza viaggio.
   WebSocket Supabase Postgres Changes + recupero periodico su REST/RLS.
 */
'use strict';
(function(global){
 const ESC=x=>esc(x??'');
 const PAGE_SIZE=50;
 const formatter=new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Europe/Rome'});
 const dayFormatter=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Rome'});
 const isValidDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 function timestamp(row){const v=row?.created_at;return isValidDate(v)?Date.parse(v):0;}
 function sorted(rows){return [...(Array.isArray(rows)?rows:[])].sort((a,b)=>timestamp(b)-timestamp(a)||String(b.id||'').localeCompare(String(a.id||'')));}
 function formatInstant(value){return isValidDate(value)?formatter.format(new Date(value)).replace(',',' ·'):'Data/ora non registrata';}
 function isToday(value){return isValidDate(value)&&dayFormatter.format(new Date(value))===dayFormatter.format(new Date());}
 const keys=rows=>new Set(rows.map(x=>x.id).filter(Boolean));
 let knownBookings=null,knownNotices=null,latestFetch=0,lastSuccessful=0,ongoing=null,debounce=null,realtimeState='connessione';
 let bookingRows=[],noticeRows=[],notificationReads=[];
 let bookingPage=0,noticePage=0;
 const filters={bookingSearch:'',trip:'',noticeSearch:''};
 const active=()=>mode==='live'&&DGData.sessionActive;
 const canTouch=()=>active()&&!document.hidden&&!document.querySelector('#dg-modal.show');
 function setRefreshBadge(){const node=document.getElementById('dg24-live-pill');if(!node)return;
  const state=realtimeState==='connesso'?'Diretta Supabase':realtimeState==='connessione'?'Connessione Realtime':'Sincronizzazione automatica';
  node.textContent=`● ${state} · ${lastSuccessful?formatter.format(new Date(lastSuccessful)):'in attesa'}`;
  node.title='Prenotazioni e notifiche ordinate dalla più recente. Aggiornamento automatico tramite Realtime e controllo periodico.';
 }
 function bookingList(){const q=filters.bookingSearch.trim().toLocaleLowerCase('it');
  return sorted(bookingRows).filter(b=>(!filters.trip||b.viaggio_id===filters.trip)&&(!q||
    [b.cliente_nome,b.cliente,b.telefono,b.fermata_partenza,(cache.trips||[]).find(t=>t.id===b.viaggio_id)?.titolo].join(' ').toLocaleLowerCase('it').includes(q)));
 }
 function bookRow(b,trips){return `<tr><td class="dg24-time"><strong>${ESC(formatInstant(b.created_at))}</strong>${isToday(b.created_at)?'<span class="dg24-today">OGGI</span>':''}</td>`+
  `<td><strong>${ESC(b.cliente_nome||b.cliente||'—')}</strong><div class="small-note">${ESC(b.telefono||'')}</div></td>`+
  `<td>${ESC(trips[b.viaggio_id]||'—')}</td><td>${ESC(b.posti)}</td><td>${ESC(b.posti_selezionati||'Da verificare')}</td><td>${ESC(b.fermata_partenza||'—')}</td><td>${euro(b.pagato)}</td><td>${status(b.stato)}</td>`+
  `<td>${isDemo()?'—':`${callButton('edit-booking',b.id,'Modifica')} ${callButton('checkin',b.id,b.checkin_effettuato?'Check-in ✓':'Check-in')} <button class="btn-secondary" type="button" data-dg10-confirmation="${ESC(b.id)}">${b.confirmation_storage_path?'Scarica PDF':'Genera PDF'}</button>`}</td></tr>`;}
 function bookingTable(rows){const trips=Object.fromEntries((cache.trips||[]).map(t=>[t.id,t.titolo||t.destinazione]));
  if(!rows.length)return '<div class="empty">Nessuna prenotazione con questi filtri.</div>';
  return `<div class="table-scroll"><table><thead><tr><th>DATA E ORA PRENOTAZIONE</th><th>CLIENTE</th><th>VIAGGIO</th><th>PERSONE</th><th>POSTI</th><th>FERMATA</th><th>PAGATO</th><th>STATO</th><th>AZIONI</th></tr></thead><tbody>${rows.map(b=>bookRow(b,trips)).join('')}</tbody></table></div>`;
 }
 function pageControls(prefix,page,total){return `<div class="dg24-page-control"><span>${total} risultati · pagina ${page+1} di ${Math.max(1,Math.ceil(total/PAGE_SIZE))}</span>`+
  `<span><button class="btn-secondary" type="button" data-dg24-nav="${prefix}:prev" ${page===0?'disabled':''}>← Più recenti</button> `+
  `<button class="btn-secondary" type="button" data-dg24-nav="${prefix}:next" ${(page+1)*PAGE_SIZE>=total?'disabled':''}>Più vecchi →</button></span></div>`;
 }
 function refreshBookingSection(){if(page!=='bookings')return;
  const list=bookingList();bookingPage=Math.min(bookingPage,Math.max(0,Math.ceil(list.length/PAGE_SIZE)-1));
  const node=document.getElementById('dg24-bookings-list');if(!node)return;
  node.innerHTML=bookingTable(list.slice(bookingPage*PAGE_SIZE,(bookingPage+1)*PAGE_SIZE))+
   pageControls('bookings',bookingPage,list.length);
  const count=document.getElementById('dg24-booking-count');if(count)count.textContent=`${list.length} prenotazioni · ${sorted(bookingRows).filter(x=>isToday(x.created_at)).length} ricevute oggi`;
 }
 function noticeList(){const q=filters.noticeSearch.trim().toLocaleLowerCase('it');
  return sorted(noticeRows).filter(n=>!q||[n.titolo,n.messaggio,n.tipo].join(' ').toLocaleLowerCase('it').includes(q));
 }
 function notificationTable(rows){const who=DGData.actor?.id;const seen=new Set(notificationReads.filter(x=>x.operator_user_id===who).map(x=>x.notification_id));
  if(!rows.length)return '<div class="empty">Non risultano notifiche con questi filtri.</div>';
  return `<div class="table-scroll"><table><thead><tr><th>DATA E ORA</th><th>OGGETTO</th><th>MESSAGGIO</th><th>TIPO</th><th>LETTURA</th><th>AZIONI</th></tr></thead><tbody>${rows.map(n=>
    `<tr><td class="dg24-time"><strong>${ESC(formatInstant(n.created_at))}</strong>${isToday(n.created_at)?'<span class="dg24-today">OGGI</span>':''}</td>`+
    `<td><strong>${ESC(n.titolo||'Notifica')}</strong></td><td>${ESC(n.messaggio||'—')}</td><td>${status(n.tipo)}</td>`+
    `<td>${seen.has(n.id)?'<span class="chip ok">Letta</span>':'<span class="chip warn">Da leggere</span>'}</td><td>${isDemo()?'—':
    `<button type="button" class="btn-secondary" data-dg8-action="edit:notifications" data-dg8-id="${ESC(n.id)}">Modifica</button> `+
    (seen.has(n.id)?'':`<button type="button" class="btn-secondary" data-dg8-action="read-notice" data-dg8-id="${ESC(n.id)}">Segna letta</button>`)}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function latestBookingsCard(){const recent=sorted(bookingRows).slice(0,12);const trips=Object.fromEntries((cache.trips||[]).map(x=>[x.id,x.titolo||x.destinazione]));
  return `<section class="panel"><div class="panel-head"><div><h3>Nuove prenotazioni ricevute</h3><p>In ordine di arrivo: prima l’ultima prenotazione, con data e ora italiane.</p></div><button class="btn-secondary" type="button" data-go="bookings">Apri prenotazioni</button></div>`+
    (recent.length?`<div class="table-scroll"><table><thead><tr><th>DATA E ORA</th><th>CLIENTE</th><th>VIAGGIO</th><th>PERSONE</th><th>STATO</th></tr></thead><tbody>${recent.map(x=>`<tr><td class="dg24-time">${ESC(formatInstant(x.created_at))}${isToday(x.created_at)?'<span class="dg24-today">OGGI</span>':''}</td><td>${ESC(x.cliente_nome||x.cliente||'—')}</td><td>${ESC(trips[x.viaggio_id]||'—')}</td><td>${ESC(x.posti)}</td><td>${status(x.stato)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nessuna prenotazione ricevuta.</div>')+'</section>';
 }
 function refreshNotificationSection(){if(page!=='notifications')return;
  const list=noticeList();noticePage=Math.min(noticePage,Math.max(0,Math.ceil(list.length/PAGE_SIZE)-1));
  const pane=document.getElementById('dg24-notification-list');if(pane)pane.innerHTML=notificationTable(list.slice(noticePage*PAGE_SIZE,(noticePage+1)*PAGE_SIZE))+
  pageControls('notices',noticePage,list.length);
  const bookingsPane=document.getElementById('dg24-new-bookings');if(bookingsPane)bookingsPane.innerHTML=latestBookingsCard();
  const count=document.getElementById('dg24-notification-count');if(count)count.textContent=`${list.length} notifiche · ordinate dalla più recente`;
 }
 async function renderBookings24(){
  const [rows,trips]=await Promise.all([data('bookings'),data('trips')]);bookingRows=sorted(rows);cache.bookings=bookingRows;
  if(active()&&knownBookings===null)knownBookings=keys(bookingRows);
  const filtersTrip=(trips||[]).slice().sort((a,b)=>String(b.data_partenza||'').localeCompare(String(a.data_partenza||'')));
  const todayCount=bookingRows.filter(b=>isToday(b.created_at)).length;
  const controls=`<div class="filters dg24-filters"><label class="search-box">⌕ <input id="dg24-booking-search" type="search" value="${ESC(filters.bookingSearch)}" placeholder="Cerca cliente, fermata, telefono, viaggio"></label>`+
  `<select id="dg24-booking-trip"><option value="">Tutti i viaggi</option>${filtersTrip.map(t=>`<option value="${ESC(t.id)}" ${filters.trip===t.id?'selected':''}>${ESC(t.titolo||t.destinazione)}</option>`).join('')}</select>`+
  `<button type="button" class="btn-secondary" data-dg24-refresh="bookings">↻ Aggiorna ora</button></div>`;
  return sec('Prenotazioni · ultime ricevute','Ordinate dalla prenotazione più recente alla più vecchia, indipendentemente dalla data del viaggio.')+
   commands([['booking','＋ Nuova prenotazione']])+
   `<div class="dg24-current-status"><span id="dg24-live-pill">● Connessione Realtime</span><strong id="dg24-booking-count">${bookingRows.length} prenotazioni · ${todayCount} ricevute oggi</strong></div>`+
   controls+`<div id="dg24-bookings-list"></div>`;
 }
 async function renderNotifications24(){
  const [notifications,bookings,reads]=await Promise.all([data('notifications'),data('bookings'),isDemo()?Promise.resolve([]):data('notificationReads').catch(()=>[])]);
  noticeRows=sorted(notifications);bookingRows=sorted(bookings);notificationReads=reads;cache.notifications=noticeRows;cache.bookings=bookingRows;
  if(active()&&knownBookings===null)knownBookings=keys(bookingRows);if(active()&&knownNotices===null)knownNotices=keys(noticeRows);
  return sec('Notifiche · aggiornamento immediato','Ultima notifica in cima; il riepilogo delle nuove prenotazioni arriva direttamente da Supabase.')+
  `<div class="dg24-current-status"><span id="dg24-live-pill">● Connessione Realtime</span><strong id="dg24-notification-count">${noticeRows.length} notifiche</strong></div>`+
  `<div class="action-row"><button class="btn-secondary" type="button" data-dg8-action="new:notifications" data-dg8-id="">＋ Nuova notifica</button><button class="btn-secondary" type="button" data-dg24-refresh="notifications">↻ Aggiorna ora</button></div>`+
  `<div id="dg24-new-bookings"></div>`+
  `<div class="filters dg24-filters"><label class="search-box">⌕ <input type="search" id="dg24-notice-search" placeholder="Cerca tra le notifiche" value="${ESC(filters.noticeSearch)}"></label></div>`+
  `<div id="dg24-notification-list"></div>`+
  cardInfo('La lista è ordinata per data e ora di creazione, non per data del viaggio. Le letture delle notifiche restano separate per Nicola e Raffaele.','info');
 }
 // Renders used by loadPage. First paint list after the HTML is present.
 renders.bookings=renderBookings24;
 renders.notifications=renderNotifications24;
 const originalAttach=attachPageEvents;
 attachPageEvents=function(){originalAttach();if(page==='bookings')refreshBookingSection();if(page==='notifications')refreshNotificationSection();setRefreshBadge();};
 async function fetchLatest(){
  if(!canTouch()||ongoing)return ongoing;
  ongoing=(async()=>{
   try{
    const [freshB,freshN]=await Promise.all([
      DGData.rows('bookings',{order:'created_at.desc,id.desc'}),
      DGData.rows('notifications',{order:'created_at.desc,id.desc'})]);
    const earlierB=knownBookings,earlierN=knownNotices;
    bookingRows=sorted(freshB);noticeRows=sorted(freshN);
    cache.bookings=bookingRows;cache.notifications=noticeRows;
    // First synchronization sets baseline without announcing historical bookings.
    const incoming=earlierB?bookingRows.filter(x=>!earlierB.has(x.id)):[];
    knownBookings=keys(bookingRows);knownNotices=keys(noticeRows);
    latestFetch=lastSuccessful=Date.now();
    if(page==='notifications'){
      try{notificationReads=await DGData.rows('notificationReads');cache.notificationReads=notificationReads;}catch{}
    }
    refreshBookingSection();refreshNotificationSection();setRefreshBadge();
    if(incoming.length&&!document.hidden){
      toast(incoming.length===1?'🚌 Nuova prenotazione arrivata!':`🚌 ${incoming.length} nuove prenotazioni ricevute`);
    }
   }catch(err){if(page==='bookings'||page==='notifications'){
    const badge=document.getElementById('dg24-live-pill');if(badge)badge.textContent='● Controllo aggiornamenti non riuscito — riprova';
   }}finally{ongoing=null;}
  })();return ongoing;
 }
 function scheduleFetch(){if(debounce)clearTimeout(debounce);debounce=setTimeout(()=>{debounce=null;fetchLatest()},350);}
 global.addEventListener('dg24:session-started',()=>{knownBookings=null;knownNotices=null;latestFetch=0;scheduleFetch();});
 global.addEventListener('dg24:realtime-change',e=>{
  if(active()&&['prenotazioni','notifiche'].includes(e.detail?.table))scheduleFetch();
 });
 global.addEventListener('dg24:realtime-status',e=>{realtimeState=e.detail?.state||'riconnessione';setRefreshBadge();});
 global.addEventListener('dg3:mutazione-confermata',()=>{
  if(active()){knownBookings=null;knownNotices=null;scheduleFetch();}
 });
 document.addEventListener('input',e=>{
  if(e.target?.id==='dg24-booking-search'){filters.bookingSearch=e.target.value;bookingPage=0;refreshBookingSection();}
  if(e.target?.id==='dg24-notice-search'){filters.noticeSearch=e.target.value;noticePage=0;refreshNotificationSection();}
 });
 document.addEventListener('change',e=>{
  if(e.target?.id==='dg24-booking-trip'){filters.trip=e.target.value;bookingPage=0;refreshBookingSection();}
 });
 document.addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-dg24-refresh]');if(btn){e.preventDefault();lastSuccessful=0;scheduleFetch();}
  const nav=e.target.closest?.('[data-dg24-nav]');if(!nav)return;
  const [kind,direction]=nav.dataset.dg24Nav.split(':');
  if(kind==='bookings'){bookingPage=Math.max(0,bookingPage+(direction==='next'?1:-1));refreshBookingSection();}
  if(kind==='notices'){noticePage=Math.max(0,noticePage+(direction==='next'?1:-1));refreshNotificationSection();}
 });
 // Backup sync: if WebSocket is disconnected or events were missed, REST resynchronizes.
 // 15 sec only for visible operator session; this is not a push notification while app closed.
 setInterval(()=>{if(active()&&!document.hidden&&Date.now()-latestFetch>=14500)fetchLatest();},15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active())scheduleFetch();});
 global.addEventListener('focus',()=>{if(active())scheduleFetch();});
 global.DG24Test=Object.freeze({sorted,formatInstant,isToday});
})(window);
