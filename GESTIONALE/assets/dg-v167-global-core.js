/* DELGROSSO V125 — safe UI normalization; no polling, no observers */
(function(){
  const ready=()=>{
    document.documentElement.dataset.dgUi='v125';
    document.body.classList.add('dg-v125');
    document.querySelectorAll('table').forEach(t=>{
      if(!t.parentElement?.classList.contains('table-responsive')){
        const w=document.createElement('div');w.className='table-responsive';t.parentNode.insertBefore(w,t);w.appendChild(t);
      }
    });
    document.querySelectorAll('button,a.btn,input[type="submit"],input[type="button"]').forEach(el=>el.setAttribute('data-dg-touch','true'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();


/* ===== V167 NEXT MODULE ===== */

/* DELGROSSO GESTIONALE — V155 SAFETY / SYNC GUARD */
(function(){
  'use strict';
  const ID='dg-v155-sync-status';
  const text=(s)=>String(s||'').trim();
  function mount(){
    if(document.getElementById(ID)) return document.getElementById(ID);
    const el=document.createElement('div');
    el.id=ID;
    el.innerHTML='<span class="dg-v155-dot"></span><span class="dg-v155-label">Connessione…</span><button type="button" class="dg-v155-refresh" title="Controlla connessione">↻</button>';
    document.body.appendChild(el);
    return el;
  }
  function set(status,message){
    const el=mount();
    el.dataset.status=status;
    const label=el.querySelector('.dg-v155-label');
    if(label) label.textContent=message;
  }
  async function check(){
    if(!navigator.onLine){ set('offline','OFFLINE — dati non sincronizzati'); return false; }
    const api=window.DG_SUPABASE_SYNC;
    if(!api?.healthCheck){ set('waiting','SUPABASE — avvio…'); return false; }
    set('checking','Verifica Supabase…');
    try{
      const r=await api.healthCheck();
      if(r?.ok){ set('online',`SUPABASE ONLINE${r.latencyMs!=null?` · ${r.latencyMs} ms`:''}`); return true; }
      set('error','SUPABASE NON RAGGIUNGIBILE');
      return false;
    }catch(e){ set('error','SUPABASE NON RAGGIUNGIBILE'); return false; }
  }
  function bind(){
    const el=mount();
    el.querySelector('.dg-v155-refresh')?.addEventListener('click',()=>check());
    window.addEventListener('online',()=>check());
    window.addEventListener('offline',()=>set('offline','OFFLINE — dati non sincronizzati'));
    window.addEventListener('dg:supabase:online',e=>set('online',`SUPABASE ONLINE${e.detail?.latencyMs!=null?` · ${e.detail.latencyMs} ms`:''}`));
    window.addEventListener('dg:supabase:offline',()=>set('error','SUPABASE NON RAGGIUNGIBILE'));
    window.addEventListener('dg:supabase:realtime-status',e=>{
      const s=e.detail?.status;
      if(s==='SUBSCRIBED') set('online','SUPABASE ONLINE · REALTIME ATTIVO');
      else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s)) set('warning','REALTIME IN RICONNESSIONE…');
    });
    window.addEventListener('dg:supabase:changed',()=>{
      if(navigator.onLine) set('online','AGGIORNAMENTO SUPABASE RICEVUTO');
    });
    window.addEventListener('dg:supabase:init-error',()=>set('error','ERRORE AVVIO SUPABASE'));
    window.addEventListener('beforeunload',function(e){
      if(window.DG_UNSAVED_CHANGES===true){e.preventDefault();e.returnValue='';}
    });
    check();
    window.setInterval(check,30000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();


/* ===== V167 NEXT MODULE ===== */

/* DELGROSSO GESTIONALE V164 — NAVIGATION / IA LAYER
   Presentation-only: no database, booking, payment or Supabase logic is touched. */
(function(){
  'use strict';
  if(window.__DG_V164_NAV__) return; window.__DG_V164_NAV__=true;
  const groups=[
    {title:'OPERATIVO',items:[
      ['dashboard.html','▦','Dashboard'],['viaggi.html','✦','Viaggi'],['prenotazioni.html','☷','Prenotazioni'],['checkin.html','⌗','Check-in'],['centro-operativo.html','◉','Centro Operativo']
    ]},
    {title:'CLIENTI & SERVIZI',items:[
      ['clienti.html','♙','Clienti'],['noleggi-bus.html','🚌','Noleggi Bus'],['preventivi.html','▤','Preventivi']
    ]},
    {title:'AMMINISTRAZIONE',items:[
      ['pagamenti.html','€','Pagamenti'],['archivio.html','▥','Archivio'],['economia.html','◈','Economia']
    ]},
    {title:'SISTEMA',items:[
      ['flotta.html','▰','Flotta'],['agenda.html','◷','Agenda'],['notifiche.html','◇','Notifiche'],['impostazioni.html','⚙','Impostazioni']
    ]}
  ];
  const hidden=['statistiche.html','preventivi-nuovo.html','prenotazione.html','dossier-cliente.html','dossier-viaggio.html','control-room-viaggio.html'];
  const file=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
  function menuHTML(){
    return groups.map(g=>'<div class="dg164-group"><div class="dg164-group-title">'+g.title+'</div>'+g.items.map(i=>'<a class="dg164-link '+(file===i[0]?'is-active':'')+'" href="./'+i[0]+'"><span class="dg164-icon">'+i[1]+'</span><span>'+i[2]+'</span></a>').join('')+'</div>').join('');
  }
  function build(){
    if(file==='login.html') return;
    document.body.classList.add('dg164-page');
    hidden.forEach(h=>document.querySelectorAll('a[href*="'+h+'"]').forEach(a=>a.closest('li')?.remove()||a.remove()));
    const existing=document.querySelector('.sidebar-nav');
    if(existing){ existing.innerHTML=menuHTML(); existing.classList.add('dg164-native-nav'); return; }
    const launcher=document.createElement('button'); launcher.className='dg164-launcher'; launcher.type='button'; launcher.setAttribute('aria-label','Apri navigazione'); launcher.innerHTML='<span>☰</span><b>Menu</b>';
    const backdrop=document.createElement('div'); backdrop.className='dg164-backdrop'; backdrop.hidden=true;
    const panel=document.createElement('aside'); panel.className='dg164-panel'; panel.innerHTML='<div class="dg164-brand"><div class="dg164-logo">DG</div><div><strong>DELGROSSO</strong><small>Gestionale operativo</small></div><button type="button" class="dg164-close" aria-label="Chiudi">×</button></div><nav>'+menuHTML()+'</nav><div class="dg164-footer">V164 · Interfaccia operativa</div>';
    document.body.append(launcher,backdrop,panel);
    const close=()=>{panel.classList.remove('open');backdrop.hidden=true;launcher.setAttribute('aria-expanded','false')};
    const open=()=>{panel.classList.add('open');backdrop.hidden=false;launcher.setAttribute('aria-expanded','true')};
    launcher.addEventListener('click',open); backdrop.addEventListener('click',close); panel.querySelector('.dg164-close').addEventListener('click',close);
    panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build,{once:true}); else build();
})();
