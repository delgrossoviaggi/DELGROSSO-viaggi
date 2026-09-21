/* DELGROSSO GESTIONALE V190 — control center and responsive navigation.
   Presentation-only. Existing application modules remain authoritative. */
(function(){
  'use strict';
  if(window.__DG_V190__) return; window.__DG_V190__=true;
  const file=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
  const nav=[
    ['dashboard.html','⌂','Home'],['viaggi.html','✦','Viaggi'],['prenotazioni.html','☷','Prenotazioni'],['checkin.html','⌗','Check-in'],['pagamenti.html','€','Pagamenti'],['archivio.html','▥','Archivio'],['centro-operativo.html','◉','Operativo'],['clienti.html','♙','Clienti'],['noleggi-bus.html','🚌','Noleggi']
  ];
  function mobileNav(){
    if(file==='login.html'||document.querySelector('.dg190-mobilebar')) return;
    const bar=document.createElement('nav'); bar.className='dg190-mobilebar'; bar.setAttribute('aria-label','Navigazione rapida');
    nav.slice(0,5).forEach(([href,ico,label])=>{const a=document.createElement('a');a.href='./'+href;a.className=file===href?'is-active':'';a.innerHTML='<span class="ico">'+ico+'</span><span>'+label+'</span>';bar.appendChild(a)});
    const more=document.createElement('a');more.href=file==='dashboard.html'?'./centro-operativo.html':'./dashboard.html';more.innerHTML='<span class="ico">⋯</span><span>'+ (file==='dashboard.html'?'Operativo':'Home') +'</span>';bar.appendChild(more);document.body.appendChild(bar);
  }
  function dashboard(){
    if(file!=='dashboard.html') return;
    document.body.classList.add('dg190-dashboard');
    const kpi=document.querySelector('.kpi-grid'); if(!kpi) return;
    const get=(id)=>document.getElementById(id);
    const card=(label,valueId,metaId,href,cls)=>{
      const el=document.createElement('article');el.className='dg190-focus-card '+(cls||'');
      el.innerHTML='<span class="label">'+label+'</span><strong class="value" id="dg190-'+valueId+'">0</strong><p class="meta" id="dg190-'+metaId+'">—</p>';
      const v=()=>{const s=get(valueId),m=get(metaId);if(s)el.querySelector('.value').textContent=s.textContent;if(m)el.querySelector('.meta').textContent=m.textContent};
      v();setTimeout(v,800);setTimeout(v,2000);setInterval(v,10000);
      el.dataset.href=href;el.addEventListener('click',()=>location.href=href);el.style.cursor='pointer';
      return el;
    };
    const root=document.createElement('section');root.className='dg190-control';root.setAttribute('aria-label','Centro di controllo operativo');
    const top=document.createElement('div');top.className='dg190-topgrid';
    top.append(
      card('Partenze oggi','metricTripsToday','metricTripsTodayMeta','./viaggi.html'),
      card('Passeggeri oggi','metricPassengersToday','metricPassengersTodayMeta','./prenotazioni.html'),
      card('Incassato oggi','metricCollectedToday','metricCollectedTodayMeta','./pagamenti.html'),
      card('Da incassare','metricOutstandingRevenue','metricOutstandingRevenueMeta','./pagamenti.html')
    );
    const main=document.createElement('div');main.className='dg190-main-grid';
    const left=document.createElement('article');left.className='dg190-panel';left.innerHTML='<div class="dg190-panel-head"><div><span class="eyebrow">AZIONI RAPIDE</span><h2>Operatività quotidiana</h2></div></div><div class="dg190-shortcuts"></div>';
    const shortcuts=[['Nuova prenotazione','./prenotazione.html'],['Gestisci viaggi','./viaggi.html'],['Controlla pagamenti','./pagamenti.html'],['Apri archivio','./archivio.html'],['Check-in','./checkin.html'],['Centro operativo','./centro-operativo.html'],['Clienti','./clienti.html'],['Noleggi Bus','./noleggi-bus.html']];
    shortcuts.forEach(([t,h])=>{const a=document.createElement('a');a.className='dg190-shortcut';a.href=h;a.textContent=t;left.querySelector('.dg190-shortcuts').appendChild(a)});
    const right=document.createElement('article');right.className='dg190-panel';right.innerHTML='<div class="dg190-panel-head"><div><span class="eyebrow">CONTROLLO</span><h2>Situazione da verificare</h2></div><a href="./archivio.html">Archivio →</a></div><div class="dg190-alerts"><div class="dg190-alert"><i class="dg190-dot"></i><div><strong>Documenti</strong><span>Usa Archivio per verificare conferme e ricevute mancanti.</span></div></div><div class="dg190-alert"><i class="dg190-dot"></i><div><strong>Prenotazioni</strong><span>Controlla posti, stato e pagamenti prima delle partenze.</span></div></div><div class="dg190-alert"><i class="dg190-dot"></i><div><strong>Partenze</strong><span>Il Centro Operativo raccoglie le attività della giornata.</span></div></div></div>';
    main.append(left,right);root.append(top,main);
    kpi.parentNode.insertBefore(root,kpi);
  }
  function init(){document.body.classList.add('dg190-page');mobileNav();dashboard();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
