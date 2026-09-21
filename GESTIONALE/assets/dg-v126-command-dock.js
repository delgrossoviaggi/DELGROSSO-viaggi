/* DELGROSSO V126 — operational command dock; no polling, no observers */
(function(){
  const EXCLUDED=['login.html','prenotazione.html','index.html'];
  const init=()=>{
    const path=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
    if(EXCLUDED.includes(path)||document.querySelector('.dg-command-dock')) return;
    const links=[
      ['⌂','Dashboard','dashboard.html'],
      ['🚌','Viaggi','viaggi.html'],
      ['📋','Prenotazioni','prenotazioni.html'],
      ['👤','Clienti','clienti.html'],
      ['💶','Pagamenti','pagamenti.html'],
      ['🛠️','Operativo','centro-operativo.html'],
      ['＋','Nuova prenotazione','prenotazione.html','dg-primary']
    ];
    const dock=document.createElement('nav');
    dock.className='dg-command-dock';
    dock.setAttribute('aria-label','Comandi rapidi gestionali');
    const label=document.createElement('span');
    label.className='dg-command-dock__label';
    label.textContent='Accesso rapido';
    dock.appendChild(label);
    const items=document.createElement('div');
    items.className='dg-command-dock__items';
    links.forEach(([icon,text,href,extra])=>{
      const a=document.createElement('a');
      a.href='./'+href;
      if(extra) a.className=extra;
      a.innerHTML='<span aria-hidden="true">'+icon+'</span><span>'+text+'</span>';
      if(path===href) a.setAttribute('aria-current','page');
      items.appendChild(a);
    });
    dock.appendChild(items);
    document.body.insertBefore(dock,document.body.firstElementChild||null);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
