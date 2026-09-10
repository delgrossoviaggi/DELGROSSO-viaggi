/* DELGROSSO V50 — Noleggi Bus integration for Dashboard & Statistics */
const db=await window.DG_SUPABASE_SYNC.getClient();
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const $=id=>document.getElementById(id);
async function load(){
 try{
  const {data,error}=await db.from('noleggi_bus').select('id,id_noleggio,referente,azienda,data_partenza,data_rientro,prezzo_concordato,acconto,stato_noleggio,stato_pagamento,noleggi_bus_mezzi(flotta_id)').order('data_partenza',{ascending:false});
  if(error) throw error;
  const rows=data||[], active=rows.filter(x=>!['Annullato','Completato'].includes(String(x.stato_noleggio||'')));
  const total=active.reduce((s,x)=>s+Number(x.prezzo_concordato||0),0), paid=active.reduce((s,x)=>s+Number(x.acconto||0),0);
  const buses=new Set(active.flatMap(x=>(x.noleggi_bus_mezzi||[]).map(m=>m.flotta_id)).filter(Boolean));
  const today=new Date().toISOString().slice(0,10);
  const todayRows=active.filter(x=>String(x.data_partenza||'').slice(0,10)===today);
  const stats={count:active.length,total,paid,due:Math.max(total-paid,0),buses:buses.size,today:todayRows.length};
  if(document.body.dataset.dgNoleggiMounted==='1') return;
  document.body.dataset.dgNoleggiMounted='1';
  mountDashboard(stats,rows); mountStatistics(stats,rows);
 }catch(e){console.warn('[DG V50] Noleggi Bus stats non disponibili',e)}
}
function mountDashboard(s,rows){
 const grid=document.querySelector('.kpi-grid'); if(grid){
  const cards=[['Noleggi Bus attivi',s.count,'./noleggi-bus.html','Contratti in corso o pianificati.','tone-violet'],['Valore noleggi',money(s.total),'./noleggi-bus.html','Valore concordato dei noleggi attivi.','tone-gold'],['Incassato noleggi',money(s.paid),'./noleggi-bus.html','Acconti registrati sui noleggi.','tone-green'],['Da incassare noleggi',money(s.due),'./noleggi-bus.html','Residuo dei noleggi attivi.','tone-orange'],['Bus impegnati',String(s.buses),'./noleggi-bus.html','Mezzi assegnati ai noleggi attivi.','tone-sky']];
  cards.forEach(([label,val,route,meta,tone])=>{const a=document.createElement('article');a.className=`kpi-card app-card ${tone} dg-noleggi-kpi`;a.dataset.route=route;a.tabIndex=0;a.setAttribute('role','link');a.innerHTML=`<span class="kpi-label">${label}</span><strong class="kpi-value">${val}</strong><p class="kpi-meta">${meta}</p>`;grid.appendChild(a);});
 }
 const charts=document.querySelector('.charts-section'); if(charts&&!document.getElementById('dgNoleggiPanel')){
  const sec=document.createElement('section');sec.id='dgNoleggiPanel';sec.className='app-card dg-noleggi-panel';
  const upcoming=rows.filter(x=>!['Annullato','Completato'].includes(String(x.stato_noleggio||''))).slice(0,5);
  sec.innerHTML=`<div class="section-heading"><div><span class="eyebrow">Noleggi Bus</span><h2>Centro operativo noleggi</h2><p class="charts-period-meta">Noleggi integrati nella visione generale del Gestionale.</p></div><a class="dg-v50-link" href="./noleggi-bus.html">Apri Noleggi Bus →</a></div><div class="dg-noleggi-summary"><div><b>${s.count}</b><span>Attivi</span></div><div><b>${money(s.total)}</b><span>Valore</span></div><div><b>${money(s.paid)}</b><span>Incassato</span></div><div><b>${money(s.due)}</b><span>Da incassare</span></div><div><b>${s.buses}</b><span>Bus impegnati</span></div></div><div class="dg-noleggi-list">${upcoming.length?upcoming.map(x=>`<div><strong>${x.referente||x.azienda||'Noleggio'}</strong><span>${x.data_partenza?new Date(x.data_partenza).toLocaleDateString('it-IT'):''} · ${money(x.prezzo_concordato)}</span></div>`).join(''):'<p>Nessun noleggio attivo.</p>'}</div>`;
  charts.insertAdjacentElement('afterend',sec);
 }
}
function mountStatistics(s,rows){
 const root=document.querySelector('main')||document.body; if(!location.pathname.toLowerCase().includes('statistiche.html')||document.getElementById('dgNoleggiStats')) return;
 const box=document.createElement('section');box.id='dgNoleggiStats';box.className='dg-v50-stats app-card';
 box.innerHTML=`<div class="section-heading"><div><span class="eyebrow">Noleggi Bus</span><h2>Statistiche noleggi</h2><p class="charts-period-meta">I noleggi entrano nel quadro statistico del Gestionale.</p></div><a class="dg-v50-link" href="./noleggi-bus.html">Gestisci noleggi →</a></div><div class="dg-v50-stat-grid"><div><span>Noleggi attivi</span><strong>${s.count}</strong></div><div><span>Valore concordato</span><strong>${money(s.total)}</strong></div><div><span>Incassato</span><strong>${money(s.paid)}</strong></div><div><span>Da incassare</span><strong>${money(s.due)}</strong></div><div><span>Bus impegnati</span><strong>${s.buses}</strong></div><div><span>Noleggi oggi</span><strong>${s.today}</strong></div></div>`;
 root.appendChild(box);
 const table=document.querySelector('table'); if(table && table.tHead && !document.getElementById('dgNoleggiStatRow')){
  const tr=document.createElement('tr');tr.id='dgNoleggiStatRow';tr.innerHTML='<td><strong>Noleggi Bus</strong></td><td>Integrati</td><td>'+s.count+'</td><td>'+money(s.total)+'</td>';table.tBody?.appendChild(tr);
 }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(load,80)); else setTimeout(load,80);
