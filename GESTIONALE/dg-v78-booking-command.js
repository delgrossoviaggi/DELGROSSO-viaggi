/* Del Grosso V78 — Prenotazioni Control Room. UI-only layer: uses the existing rendered booking table. */
(()=>{
 'use strict';
 const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 ready(()=>{
  const table=document.getElementById('bookingTable'), wrap=table?.closest('.booking-table-wrap');
  if(!table||!wrap)return;
  if(document.getElementById('dgV78Command'))return;
  const host=document.createElement('section'); host.id='dgV78Command'; host.className='dg78-command';
  host.innerHTML=`<div class="dg78-command-head"><div class="dg78-command-title"><div class="dg78-command-mark">🎫</div><div><strong>Control Room Prenotazioni</strong><small>Operatività, incassi e passeggeri in un'unica vista</small></div></div><div class="dg78-live-pill"><i></i> DATI LIVE</div></div>
   <div class="dg78-kpis"><div class="dg78-kpi accent"><small>Prenotazioni</small><strong id="dg78Count">0</strong><span>risultati visualizzati</span></div><div class="dg78-kpi"><small>Confermate</small><strong id="dg78Confirmed">0</strong><span>confermate / saldate</span></div><div class="dg78-kpi"><small>Passeggeri</small><strong id="dg78People">0</strong><span>posti prenotati</span></div><div class="dg78-kpi"><small>Valore</small><strong id="dg78Value">€ 0</strong><span>totale prenotazioni</span></div><div class="dg78-kpi"><small>Da incassare</small><strong id="dg78Due">€ 0</strong><span>residuo attuale</span></div></div>
   <div class="dg78-tools"><input id="dg78Search" type="search" placeholder="🔎 Cerca cliente, viaggio, codice…" autocomplete="off"><select id="dg78Trip"><option value="">Tutti i viaggi</option></select><select id="dg78Date"><option value="">Tutte le date</option></select><select id="dg78Pay"><option value="">Tutti i pagamenti</option><option value="Confermata">Confermate</option><option value="Acconto Ricevuto">Acconto ricevuto</option><option value="Saldata">Saldate</option><option value="In Attesa">In attesa</option><option value="Annullata">Annullate</option></select><select id="dg78Presence"><option value="">Presenza: tutte</option><option value="present">Presenti</option><option value="absent">Non presenti</option></select><button class="primary" id="dg78Reset" type="button">↺ Azzera filtri</button></div>
   <div class="dg78-chips" role="toolbar" aria-label="Filtri rapidi"><button class="dg78-chip active" data-filter="all">Tutte</button><button class="dg78-chip" data-filter="today">Oggi</button><button class="dg78-chip" data-filter="open">Da incassare</button><button class="dg78-chip" data-filter="confirmed">Confermate</button><button class="dg78-chip" data-filter="absent">Da verificare</button><button class="dg78-chip" data-filter="cancelled">Annullate</button></div>`;
  const h=wrap.parentElement; h.insertBefore(host,wrap);
  const mobile=document.createElement('div'); mobile.id='dgV78MobileList'; mobile.className='dg78-mobile-list'; wrap.parentElement.insertBefore(mobile,wrap);
  let mode=window.innerWidth<=700?'cards':'table';
  let lastOptionsSig='', lastMobileSig='', syncQueued=false, syncTimer=0;
  const euro=v=>{const n=Number(String(v??'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)};
  const norm=s=>String(s??'').trim().toLowerCase();
  const rows=()=>Array.from(table.querySelectorAll('tbody tr'));
  const getRowData=tr=>{const td=Array.from(tr.children); const txt=i=>String(td[i]?.textContent||'').trim(); const check=tr.querySelector('.presenceToggle'); return {tr,id:tr.dataset.id||'',code:txt(0),client:txt(1),trip:txt(2),date:txt(3),people:Number(txt(4).replace(/\D/g,''))||0,total:euro(txt(5)),paid:euro(txt(6)),due:euro(txt(7)),status:txt(8),present:!!check?.checked, rowText:norm(tr.textContent)};};
  const setMainSearch=v=>{const s=document.getElementById('searchBooking');if(s&&s.value!==v){s.value=v;s.dispatchEvent(new Event('input',{bubbles:true}));}};
  const buildOptions=()=>{const data=rows().map(getRowData); const trips=[...new Set(data.map(x=>x.trip).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')); const dates=[...new Set(data.map(x=>x.date).filter(Boolean))].sort(); const t=document.getElementById('dg78Trip'),d=document.getElementById('dg78Date'); if(t){const cur=t.value;t.innerHTML='<option value="">Tutti i viaggi</option>'+trips.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');t.value=trips.includes(cur)?cur:''} if(d){const cur=d.value;d.innerHTML='<option value="">Tutte le date</option>'+dates.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');d.value=dates.includes(cur)?cur:''}};
  const sync=()=>{
   const data=rows().map(getRowData);
   const optionsSig=data.map(x=>x.trip+'\x1f'+x.date).join('\x1e');
   if(optionsSig!==lastOptionsSig){ buildOptions(data); lastOptionsSig=optionsSig; }
 const trip=document.getElementById('dg78Trip')?.value||'',date=document.getElementById('dg78Date')?.value||'',pay=document.getElementById('dg78Pay')?.value||'',pres=document.getElementById('dg78Presence')?.value||'',q=norm(document.getElementById('dg78Search')?.value||'');
   const activeChip=document.querySelector('.dg78-chip.active')?.dataset.filter||'all';
   let visible=data.filter(x=>(!trip||x.trip===trip)&&(!date||x.date===date)&&(!pay||x.status===pay)&&(!pres||(pres==='present'?x.present:!x.present))&&(!q||x.rowText.includes(q)));
   const today=new Date().toLocaleDateString('it-IT');
   if(activeChip==='today') visible=visible.filter(x=>x.date===today||x.date===new Date().toISOString().slice(0,10));
   if(activeChip==='open') visible=visible.filter(x=>!/^€\s?0/.test(x.due));
   if(activeChip==='confirmed') visible=visible.filter(x=>['Confermata','Saldata'].includes(x.status));
   if(activeChip==='absent') visible=visible.filter(x=>!x.present&&x.status!=='Annullata');
   if(activeChip==='cancelled') visible=visible.filter(x=>x.status==='Annullata');
   const ids=new Set(visible.map(x=>x.id)); data.forEach(x=>x.tr.style.display=ids.has(x.id)?'':'none');
   let people=0,value=0,due=0,confirmed=0;visible.forEach(x=>{people+=x.people;value+=Number(x.total.replace(/[^0-9,-]/g,'').replace(/\./g,'').replace(',','.'))||0;due+=Number(x.due.replace(/[^0-9,-]/g,'').replace(/\./g,'').replace(',','.'))||0;if(['Confermata','Saldata'].includes(x.status))confirmed++});
   const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('dg78Count',visible.length);set('dg78Confirmed',confirmed);set('dg78People',people);set('dg78Value',euro(value));set('dg78Due',euro(due));
   const mobileSig=mode+'|'+visible.map(x=>[x.id,x.status,x.people,x.present,x.total,x.paid,x.due].join('~')).join('§');
   if(mobileSig!==lastMobileSig){ lastMobileSig=mobileSig; mobile.innerHTML=visible.length?visible.map(x=>`<article class="dg78-mobile-card" data-id="${esc(x.id)}"><div class="dg78-mobile-top"><div class="dg78-mobile-person"><strong>${esc(x.client||'Cliente non indicato')}</strong><small>${esc(x.code)} · ${esc(x.date)}</small></div><span class="dg78-mobile-status">${esc(x.status||'In Attesa')}</span></div><div class="dg78-mobile-trip"><strong>${esc(x.trip||'Viaggio non indicato')}</strong><span>👥 ${x.people} ${x.people===1?'posto':'posti'} · ${esc(x.present?'Presenza registrata':'Presenza da verificare')}</span></div><div class="dg78-mobile-grid"><div><small>Totale</small><b>${esc(x.total)}</b></div><div><small>Pagato</small><b>${esc(x.paid)}</b></div><div><small>Residuo</small><b>${esc(x.due)}</b></div></div><div class="dg78-mobile-actions"><button class="primary" data-action="open">Apri scheda</button><button data-action="seat">🪑 Posti</button><button data-action="presence">${x.present?'✓ Presente':'○ Presenza'}</button></div></article>`).join(''):'<div class="dg78-empty">Nessuna prenotazione corrisponde ai filtri selezionati.</div>';
   }
   host.classList.toggle('dg78-view-cards',mode==='cards');host.classList.toggle('dg78-view-table',mode==='table');
  };
  host.addEventListener('input',e=>{if(e.target.id==='dg78Search'){setMainSearch(e.target.value);clearTimeout(syncTimer);syncTimer=setTimeout(sync,120)}});
  ['dg78Trip','dg78Date','dg78Pay','dg78Presence'].forEach(id=>document.getElementById(id)?.addEventListener('change',sync));
  document.getElementById('dg78Reset')?.addEventListener('click',()=>{document.getElementById('dg78Search').value='';setMainSearch('');['dg78Trip','dg78Date','dg78Pay','dg78Presence'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.querySelectorAll('.dg78-chip').forEach((b,i)=>b.classList.toggle('active',i===0));sync()});
  host.querySelectorAll('.dg78-chip').forEach(btn=>btn.addEventListener('click',()=>{host.querySelectorAll('.dg78-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');sync()}));
  mobile.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const card=b.closest('[data-id]');const id=card?.dataset.id;if(!id)return;const row=table.querySelector(`tbody tr[data-id="${CSS.escape(id)}"]`);if(!row)return;let sel=b.dataset.action==='open'?'.openBtn':b.dataset.action==='seat'?'.changeSeatBtn':'.presenceToggle';const target=row.querySelector(sel);if(!target)return;if(sel==='.presenceToggle'){target.checked=!target.checked;target.dispatchEvent(new Event('change',{bubbles:true}))}else target.click();});
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(sync,220)});observer.observe(table.querySelector('tbody')||table,{childList:true,subtree:true});
  window.addEventListener('resize',()=>{const next=window.innerWidth<=700?'cards':'table';if(next!==mode){mode=next;sync()}});
  requestAnimationFrame(sync);setTimeout(sync,700);
 });
})();
