/* DELGROSSO GESTIONALE V192 — unified navigation + mobile data presentation. */
(function(){'use strict';
 if(window.__DG_V192__) return; window.__DG_V192__=true;
 const file=(location.pathname.split('/').pop()||'dashboard.html').toLowerCase();
 const nav=[['dashboard.html','⌂','Home'],['viaggi.html','✦','Viaggi'],['prenotazioni.html','☷','Prenotazioni'],['checkin.html','⌗','Check-in'],['pagamenti.html','€','Pagamenti'],['centro-operativo.html','◉','Operativo'],['archivio.html','▥','Archivio'],['clienti.html','♙','Clienti'],['noleggi-bus.html','🚌','Noleggi']];
 function addMobileNav(){if(file==='login.html'||document.querySelector('.dg190-mobilebar')) return; const bar=document.createElement('nav');bar.className='dg190-mobilebar';bar.setAttribute('aria-label','Navigazione gestionale'); const main=nav.slice(0,5); main.forEach(([href,ico,label])=>{const a=document.createElement('a');a.href='./'+href;a.className=file===href?'is-active':'';a.innerHTML='<span class="ico">'+ico+'</span><span>'+label+'</span>';bar.appendChild(a)}); const a=document.createElement('a');a.href=file==='dashboard.html'?'./centro-operativo.html':'./dashboard.html';a.innerHTML='<span class="ico">'+(file==='dashboard.html'?'◉':'⌂')+'</span><span>'+(file==='dashboard.html'?'Operativo':'Home')+'</span>';bar.appendChild(a);document.body.appendChild(bar);}
 function labelTables(){document.querySelectorAll('table').forEach(table=>{if(table.id==='seatMap'||table.classList.contains('keep-table')) return;const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());if(!heads.length) return;table.classList.add('dg192-mobile-cards');table.querySelectorAll('tbody tr').forEach(tr=>{[...tr.children].forEach((td,i)=>{if(!td.dataset.label&&heads[i]) td.dataset.label=heads[i]})});});}
 function dashboard(){if(file!=='dashboard.html') return;document.body.classList.add('dg190-dashboard');
   const root=document.querySelector('.dg190-control');if(!root) return;
   // Keep the rich analytics available, but behind one deliberate "Approfondimenti" action.
   const legacy=[...document.querySelectorAll('.overview-grid,.widgets-grid')];
   if(!legacy.length) return;
   const wrap=document.createElement('section');wrap.className='dg192-details';wrap.style.marginTop='12px';
   const btn=document.createElement('button');btn.type='button';btn.textContent='▸ Apri approfondimenti e analytics';btn.setAttribute('aria-expanded','false');btn.style.cssText='width:100%;min-height:44px;border:1px solid #dfe7ef;border-radius:12px;background:#fff;color:#08233b;font-weight:800;cursor:pointer';
   const body=document.createElement('div');body.hidden=true;body.style.marginTop='12px';
   legacy.forEach(x=>{body.appendChild(x)});wrap.append(btn,body);root.parentNode.insertBefore(wrap,root.nextSibling);
   btn.addEventListener('click',()=>{const open=!body.hidden;body.hidden=open;btn.setAttribute('aria-expanded',String(!open));btn.textContent=(open?'▸ Apri':'▾ Chiudi')+' approfondimenti e analytics';});
 }
 function init(){document.body.classList.add('dg192-page');addMobileNav();labelTables();dashboard();setTimeout(labelTables,900);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
