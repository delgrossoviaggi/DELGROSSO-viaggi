/* DELGROSSO V6 — the same 8 primary features on desktop/iOS/Android.
   Works only inside an authenticated V1 session; does not manage credentials or Supabase permissions. */
(function(){'use strict';
  const items=[
   ['suite:piantine','Crea / Modifica piantine'],
   ['suite:cassa-nicola','Contabilità Nicola'],
   ['suite:cassa-raffaele','Contabilità Raffaele'],
   ['suite:agenda','Agenda completa'],
   ['suite:prenotazioni','Prenotazioni con piantina'],
   ['suite:pagamenti','Registra pagamento'],
   ['suite:archivio','Ricevute e documenti'],
   ['suite:notifiche','Notifiche prenotazioni'],
   ['rubrica-wa','📱 Numeri WhatsApp per viaggio'],
   ['scheda-cliente','👤 Scheda cliente · Viaggi e pagamenti']
  ];
  const $=id=>document.getElementById(id);
  const authenticated=()=>document.body.classList.contains('dg44-authenticated') && $('app')?.classList.contains('on');
  let lastFocused=null;
  function close(){
    const sheet=$('dg-v6-mobile-sheet'),bg=$('dg-v6-mobile-backdrop'),button=$('dg-v6-functions');
    if(!sheet)return;
    sheet.dataset.open='false';bg.dataset.open='false';button?.setAttribute('aria-expanded','false');
    if(lastFocused&&document.contains(lastFocused))lastFocused.focus({preventScroll:true});lastFocused=null;
  }
  function open(){
    if(!authenticated())return;
    const sheet=$('dg-v6-mobile-sheet'),bg=$('dg-v6-mobile-backdrop');
    if(!sheet)return;
    lastFocused=document.activeElement;sheet.dataset.open='true';bg.dataset.open='true';
    $('dg-v6-functions').setAttribute('aria-expanded','true');
    sheet.querySelector('button')?.focus({preventScroll:true});
  }
  function navigate(target){
    close();
    if(!authenticated()||typeof window.dg44Go!=='function')return;
    window.dg44Go(target);
    // On iOS and Android return to the top of the content panel after a route change.
    requestAnimationFrame(()=>{try{window.scrollTo({top:0,behavior:'instant'})}catch{window.scrollTo(0,0)}});
  }
  function init(){
    if($('dg-v6-mobile-dock'))return;
    const dock=document.createElement('nav');dock.id='dg-v6-mobile-dock';dock.setAttribute('aria-label','Navigazione rapida DELGROSSO su mobile');
    dock.innerHTML='<button type="button" id="dg-v6-home">⌂ Scrivania</button><button type="button" id="dg-v6-functions" aria-expanded="false" aria-controls="dg-v6-mobile-sheet">☷ Funzioni</button>';
    const bg=document.createElement('div');bg.id='dg-v6-mobile-backdrop';bg.dataset.open='false';
    const sheet=document.createElement('section');sheet.id='dg-v6-mobile-sheet';sheet.dataset.open='false';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Funzioni disponibili su tutti i dispositivi');
    sheet.innerHTML='<div class="dg-v6-sheet-header"><strong>Funzioni principali DELGROSSO</strong><button type="button" id="dg-v6-close" aria-label="Chiudi menu">×</button></div><div class="dg-v6-sheet-items"></div><div class="dg-v6-sheet-footer"><button type="button" id="dg-v6-all-sections">☰ Apri menu aziendale completo</button></div>';
    const container=sheet.querySelector('.dg-v6-sheet-items');
    items.forEach(([target,label])=>{
      const b=document.createElement('button');b.type='button';b.dataset.dgV6Target=target;
      b.textContent=label;b.addEventListener('click',()=>navigate(target));container.appendChild(b);
    });
    document.body.append(bg,sheet,dock);
    $('dg-v6-home').addEventListener('click',()=>navigate('dashboard'));
    $('dg-v6-functions').addEventListener('click',()=>sheet.dataset.open==='true'?close():open());
    $('dg-v6-close').addEventListener('click',close);bg.addEventListener('click',close);
    $('dg-v6-all-sections').addEventListener('click',()=>{close();if(!authenticated())return;
      if(typeof window.dg44ToggleMenu==='function')window.dg44ToggleMenu();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet.dataset.open==='true')close()});
    document.addEventListener('click',e=>{if(e.target?.closest?.('#dg44-sidebar-menu [data-dg44-target]'))close()});
    // Avoid a left-open mobile menu after a desktop/tablet breakpoint transition.
    window.addEventListener('resize',()=>{if(innerWidth>850)close()},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* DELGROSSO VIAGGI — FIX CAMBIO DATA V12, 13/11/2026.
 * Modulo aggiuntivo per GESTIONALE/index.html (V1). Nessuna nuova chiave o password.
 * Usa la RPC già presente dg_save_booking_v13 e mantiene gli incassi collegati.
 * Le scelte sono solo anteprime: le disponibilità sono ricontrollate da Supabase al salvataggio.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const norm = x => String(x ?? '').trim();
  const escaped = x => String(x ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const isCancelled = b => /annull|cancel|cancell|storn|rimbors/i.test(String(b?.stato || ''));
  const date = x => /^\d{4}-\d{2}-\d{2}/.test(String(x || '')) ? `${String(x).slice(8,10)}/${String(x).slice(5,7)}/${String(x).slice(0,4)}` : '—';
  const amount = x => new Intl.NumberFormat('it-IT', {style:'currency',currency:'EUR'}).format(Number(x)||0);
  const getState = () => typeof state !== 'undefined' ? state : null;
  let saving = false;
  let generationWarning = 0;

  function bookingsFor(id) {
    const s=getState();
    return (s?.prenotazioni || []).filter(b=>b.viaggio_id===id && !isCancelled(b));
  }
  function bookingSeats(b) {
    const s=getState();
    const rows=(s?.prenotazionePosti || []).filter(x=>x.prenotazione_id===b.id)
      .map(x=>norm(x.posto)).filter(Boolean);
    const fromText=norm(b.posti_selezionati).split(/[,;\s]+/).filter(Boolean);
    return [...new Set(rows.length?rows:fromText)].sort((a,b)=>Number(a)-Number(b));
  }
  function readTarget(targetId) {
    const s=getState(),trip=(s?.viaggi||[]).find(v=>v.id===targetId);
    if(!trip) return {bad:'Seleziona la nuova data'};
    if(trip.archiviato_at || /annull|cancel|chius/i.test(String(trip.stato || '')))
      return {bad:'La nuova partenza non è disponibile'};
    const cap=Number(trip.posti_totali);
    if(!Number.isSafeInteger(cap)||cap<1||cap>999) return {bad:'Capienza del viaggio non valida'};
    const active=bookingsFor(targetId);
    const activeIds=new Set(active.map(b=>b.id)),taken=new Set();
    const seatRows=s?.prenotazionePosti;
    if(!Array.isArray(seatRows)) return {bad:'Elenco posti non caricato: aggiorna il gestionale'};
    for(const row of seatRows){
      if(row.viaggio_id===targetId && activeIds.has(row.prenotazione_id)) taken.add(norm(row.posto));
    }
    for(const b of active){
      if(!seatRows.some(row=>row.prenotazione_id===b.id))
        for(const seat of bookingSeats(b)) taken.add(seat);
    }
    const used=active.reduce((sum,b)=>sum+Math.max(0,Number(b.posti)||0),0);
    return {trip,cap,taken,remaining:Math.max(0,cap-used),bad:null};
  }
  function stableChoice(items, b, targetId) {
    // Scelta pseudo-casuale stabile nell'anteprima, per non cambiare posti a ogni clic.
    const key=norm(b.id)+':'+norm(targetId);
    let hash=2166136261;
    for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return items[(hash>>>0)%items.length];
  }
  function propose(b,context,reserved,remaining) {
    const pax=Number(b.posti);
    if(!Number.isSafeInteger(pax)||pax<1||pax>99) return {bad:true,msg:'Numero passeggeri non valido',seats:[]};
    if(b.checkin_effettuato) return {bad:true,msg:'Check-in già registrato: verificare la prenotazione prima di spostarla',seats:[]};
    if(remaining<pax) return {bad:true,msg:`Posti insufficienti: disponibili ${remaining}, richiesti ${pax}`,seats:[]};
    const all=Array.from({length:context.cap},(_,i)=>String(i+1));
    const free=all.filter(n=>!reserved.has(n));
    if(free.length<pax) return {bad:true,msg:'Numerazione posti non sufficientemente libera',seats:[]};
    const old=bookingSeats(b);
    if(old.length===pax && old.every(n=>/^\d+$/.test(n) && Number(n)>0 && Number(n)<=context.cap && !reserved.has(n)))
      return {bad:false,kept:true,seats:old,msg:'Posti originali disponibili: '+old.join(', ')};
    let best=Infinity,groups=[];
    const numbers=free.map(Number);
    for(let i=0;i<=numbers.length-pax;i++) {
      const group=numbers.slice(i,i+pax),span=group[group.length-1]-group[0];
      if(span<best){best=span;groups=[group]}
      else if(span===best) groups.push(group);
    }
    const chosen=stableChoice(groups,b,context.trip.id).map(String);
    return {bad:false,kept:false,seats:chosen,msg:'Posti alternativi disponibili: '+chosen.join(', ')};
  }
  function planning() {
    const source=$('mv_source')?.value || '',target=$('mv_target')?.value || '';
    const s=getState(),rows=bookingsFor(source).filter(b=>!window.dgMoveSingleId || b.id===window.dgMoveSingleId);
    const context=readTarget(target),selection=window.dgMoveSelected instanceof Set?window.dgMoveSelected:new Set();
    const plans=new Map();
    if(context.bad)return {source,target,context,rows,selection,plans};
    const taken=new Set(context.taken);
    let remaining=context.remaining;
    for(const b of rows.filter(b=>selection.has(b.id))) {
      const p=propose(b,context,taken,remaining);plans.set(b.id,p);
      if(!p.bad){p.seats.forEach(n=>taken.add(n));remaining-=Number(b.posti)}
    }
    for(const b of rows.filter(b=>!selection.has(b.id))) {
      plans.set(b.id,propose(b,context,taken,remaining));
    }
    return {source,target,context,rows,selection,plans};
  }
  function renderPlan() {
    const list=$('mv_list'),summary=$('mv_summary');if(!list)return;
    const p=planning();let compatible=0;
    list.innerHTML=p.rows.map(b=>{
      const entry=p.plans.get(b.id)||{bad:true,seats:bookingSeats(b),msg:p.context.bad||'Seleziona una partenza'};
      if(!entry.bad)compatible++;
      const checked=p.selection.has(b.id);
      const info=entry.bad?entry.msg:(entry.kept?'✅ '+entry.msg:'🎲 '+entry.msg);
      return `<label class="list-row" style="cursor:${entry.bad?'not-allowed':'pointer'};align-items:flex-start">
        <input type="checkbox" style="width:20px;height:20px;margin-top:6px" ${checked?'checked':''} ${entry.bad&&!checked?'disabled':''} onchange="dgMoveToggle('${escaped(b.id)}',this.checked)">
        <div class="row-main"><strong>${escaped(b.cliente||b.cliente_nome||'Cliente')}</strong>
          <small>${escaped(b.telefono||'')} · ${Number(b.posti)||0} pax · posti originali <b>${escaped(bookingSeats(b).join(', ')||'—')}</b> · versato ${amount(b.pagato)} · residuo ${amount(b.saldo)}</small>
          <small style="color:${entry.bad?'#b91c1c':'#047857'}">${escaped(info)}</small>
        </div></label>`;
    }).join('')||'<div class="empty">Nessuna prenotazione attiva.</div>';
    const selected=p.rows.filter(b=>p.selection.has(b.id)),bad=selected.filter(b=>p.plans.get(b.id)?.bad);
    const pax=selected.reduce((sum,b)=>sum+(Number(b.posti)||0),0);
    const trip=p.context.trip;
    if(summary){
      summary.innerHTML=trip?`<b>${escaped(trip.titolo||trip.destinazione||'Viaggio')}</b> · ${date(trip.data_partenza)}<br>`+
        `Selezionati <b>${selected.length}</b> prenotazioni / <b>${pax}</b> passeggeri · Proponibili ${compatible}/${p.rows.length}`+
        `<br><small>Acconti e saldi già incassati rimangono registrati. Il prezzo della prenotazione non cambia automaticamente.</small>`:
        escaped(p.context.bad||'Seleziona la nuova data');
    }
    const btn=$('mv_confirm');if(btn){btn.disabled=saving||!trip||!selected.length||!!bad.length;btn.textContent=saving?'Spostamento in corso…':'🔄 Sposta con posti automatici'}
  }
  function selectAll() {
    const source=$('mv_source')?.value || '',target=$('mv_target')?.value || '';
    const context=readTarget(target);window.dgMoveSelected=new Set();
    if(context.bad){renderPlan();return}
    const taken=new Set(context.taken);let remaining=context.remaining;
    for(const b of bookingsFor(source)){
      const p=propose(b,context,taken,remaining);
      if(p.bad)continue;
      window.dgMoveSelected.add(b.id);p.seats.forEach(s=>taken.add(s));remaining-=Number(b.posti);
    }
    renderPlan();
  }
  async function execute() {
    if(saving)return;
    const p=planning(),source=p.source,target=p.target;
    const selected=p.rows.filter(b=>p.selection.has(b.id));
    if(!source||!target||source===target||!selected.length)
      return typeof toast==='function'&&toast('Seleziona una partenza diversa e almeno un prenotato',false);
    if(p.context.bad||selected.some(b=>p.plans.get(b.id)?.bad))
      return typeof toast==='function'&&toast('Posti non disponibili: controlla le proposte visualizzate',false);
    const s=getState(),src=(s?.viaggi||[]).find(v=>v.id===source),dst=p.context.trip;
    const targetStop=norm($('mv_stop')?.value);
    const pairs=selected.map(b=>({b,assignment:p.plans.get(b.id)}));
    const lines=pairs.map(({b,assignment})=>`${b.cliente||'Cliente'}: ${bookingSeats(b).join(', ')||'—'} → ${assignment.seats.join(', ')}`);
    const message=`Confermi il cambio data?\n\nDa: ${src?.titolo||''} · ${date(src?.data_partenza)}\nA: ${dst?.titolo||''} · ${date(dst?.data_partenza)}\n\n${lines.join('\n')}\n\nAcconti e saldi non saranno registrati una seconda volta. Il totale concordato rimane quello originale.`;
    if(!window.confirm(message))return;
    saving=true;generationWarning=0;renderPlan();let moved=0,failed='';
    try{
      if(typeof rpc!=='function')throw Error('Connessione gestionale non disponibile');
      for(const {b,assignment} of pairs){
        const body={
          viaggio_id:target,cliente:norm(b.cliente||b.cliente_nome),telefono:b.telefono||'',email:b.email||'',
          posti:Number(b.posti),totale:Number(b.totale),stato:b.stato||'Confermata',note:b.note||'',
          fermata_partenza:targetStop||norm(b.fermata_partenza)||'Da definire',
          giorni_acconto:Math.max(1,Number(b.giorni_acconto)||2)
        };
        try{
          const saved=await rpc('dg_save_booking_v13',{p_id:b.id,p_data:body,p_seats:assignment.seats});
          if(saved?.id!==b.id||saved?.viaggio_id!==target)
            throw Error('Risposta inattesa dal server: controllare la prenotazione prima di riprovare');
          moved++;
          try{await rpc('dg_generate_confirmation',{p_booking_id:b.id})}catch(e){generationWarning++;console.warn('Conferma PDF da rigenerare:',e?.message||e)}
        }catch(e){failed=String(e?.message||e);break}
      }
    }catch(e){failed=String(e?.message||e)}
    finally{
      saving=false;
      try{if(typeof closeModal==='function')closeModal();if(typeof loadAll==='function')await loadAll()}
      catch(e){failed+=` | Aggiornamento dati: ${e?.message||e}`}
      const report=`Spostate ${moved}/${pairs.length} prenotazioni.`+
        (generationWarning?` ${generationWarning} conferme PDF da rigenerare.`:'')+
        (failed?` Operazione interrotta: ${failed}`:' Verifica la nuova piantina e la scheda pagamenti.');
      if(typeof toast==='function')toast(report,!failed);
      if(failed)console.warn('Cambio data DELGROSSO:',report);
    }
  }
  const previousOpen=window.openMoveBookingsModal;
  if(typeof previousOpen!=='function'){
    console.warn('Cambio data V12: la finestra di spostamento originale non è stata trovata.');
    return;
  }
  window.openMoveBookingsModal=function(id=''){
    const result=previousOpen(id);
    const title=$('modalTitle');if(title)title.textContent=id?'Sposta prenotazione · posti automatici':'Sposta prenotati · posti automatici';
    const note=Array.from(document.querySelectorAll('.statusline.live')).find(el=>el.textContent?.includes('Cambio data sicuro'));
    if(note)note.innerHTML='<b>🎲 Cambio data con posti automatici</b><br>Se i posti originali sono liberi rimangono uguali; altrimenti vengono proposti altri posti liberi. Pagamenti e ricevute storiche restano conservati.';
    renderPlan();
    return result;
  };
  window.dgMoveConflict=function(b,target){
    const context=readTarget(target);
    if(context.bad)return {bad:true,msg:context.bad,seats:bookingSeats(b)};
    return propose(b,context,new Set(context.taken),context.remaining);
  };
  window.renderMoveBookingChoices=renderPlan;
  window.dgMoveSelectAllCompatible=selectAll;
  window.executeMoveBookings=execute;
  // Banner diagnostico, senza credenziali o dati cliente.
  window.dgMoveAutoVersion='V12.2-20261113';
  console.info('DELGROSSO: cambio data automatico attivo (V12.1)');
})();
