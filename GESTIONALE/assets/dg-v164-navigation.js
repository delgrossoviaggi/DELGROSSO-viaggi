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
