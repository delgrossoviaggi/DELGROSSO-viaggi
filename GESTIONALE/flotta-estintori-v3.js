/* DELGROSSO — Gestione scadenze estintori flotta V3 */
(function(){
'use strict';
const $id=id=>document.getElementById(id);
const norm=v=>String(v||'').toLowerCase();
const eligible=f=>{
  const s=norm([f.titolo,f.marca,f.modello,f.categoria].join(' '));
  if(s.includes('mercedes')||s.includes('v250')) return false;
  return s.includes('bus gt')||s.includes('limousine')||s.includes('irizar')||s.includes('scania');
};
const currentDeadline=fid=>{
  return (state.scadenze||[])
    .filter(s=>s.riferimento_id===fid && (norm(s.tipo).includes('estint')||norm(s.titolo).includes('estint')) && !norm(s.stato).includes('complet'))
    .sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')))[0]||null;
};
const deadlineMeta=date=>{
  if(!date)return {txt:'Non impostata',cls:'neutral'};
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(String(date).slice(0,10)+'T12:00:00');
  const days=Math.ceil((d-today)/86400000);
  if(days<0)return {txt:`Scaduta ${dateIT(date)}`,cls:'danger'};
  if(days<=30)return {txt:`Scade ${dateIT(date)} · ${days} gg`,cls:'danger'};
  if(days<=90)return {txt:`Scade ${dateIT(date)} · ${days} gg`,cls:'wait'};
  return {txt:`Scade ${dateIT(date)}`,cls:'ok'};
};
function injectHeaderButton(){
  const sec=$id('page-flotta');if(!sec)return;
  const qa=sec.querySelector('.section-title .quick-actions');
  if(qa&&!$id('dgExtBtn')){
    const b=document.createElement('button');b.id='dgExtBtn';b.className='btn btn-secondary';b.innerHTML='🧯 Scadenza estintori';b.onclick=()=>openExtinguisherModal();qa.appendChild(b);
  }
}
function renderPanel(){
  const cards=$id('fleetCards');if(!cards)return;
  let panel=$id('dgExtinguisherPanel');
  if(!panel){panel=document.createElement('div');panel.id='dgExtinguisherPanel';panel.className='card';panel.style.marginTop='14px';cards.insertAdjacentElement('afterend',panel)}
  const list=(state.flotta||[]).filter(eligible);
  panel.innerHTML=`<div class="card-head"><h3>🧯 Scadenze estintori</h3><button class="btn btn-primary btn-sm" onclick="openExtinguisherModal()">Imposta / aggiorna</button></div><div class="card-body">${list.map(f=>{const d=currentDeadline(f.id),m=deadlineMeta(d?.data_scadenza);return `<div class="list-row"><div class="row-main"><strong>${esc(f.titolo||f.modello||f.targa||'Mezzo')}</strong><small>${esc(f.targa||'')} · ${esc(f.categoria||'')}</small></div><span class="pill ${m.cls}">${m.txt}</span><button class="btn btn-secondary btn-sm" onclick="openExtinguisherModal('${f.id}')">🧯 Modifica</button></div>`}).join('')||'<div class="empty">Nessun bus configurato.</div>'}</div>`;
}
const originalRenderFleet=window.renderFleet||renderFleet;
window.renderFleet=function(){
  const box=$id('fleetCards');
  if(box){
    box.innerHTML=(state.flotta||[]).map(f=>{const isEligible=eligible(f),d=isEligible?currentDeadline(f.id):null,m=deadlineMeta(d?.data_scadenza);return `<div class="module-card"><img src="${esc(f.immagine||'assets/bus-bianco-reale.jpg')}" style="width:100%;height:150px;object-fit:cover;border-radius:10px"><h3 style="margin-top:10px">${esc(f.titolo||f.marca+' '+f.modello)}</h3><p>${esc(f.targa||'Targa n/d')} · ${f.posti||0} posti</p><span class="pill ${f.stato==='Disponibile'||f.stato==='Operativo'?'ok':'neutral'}">${esc(f.stato||'Disponibile')}</span>${isEligible?` <span class="pill ${m.cls}">🧯 ${m.txt}</span>`:''}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px"><button class="btn btn-secondary btn-sm" onclick="openFleetModal('${f.id}')">Modifica</button><button class="btn btn-primary btn-sm" onclick="dgOpenFleetCalendar('${f.id}')">📅 Calendario</button>${isEligible?`<button class="btn btn-secondary btn-sm" onclick="openExtinguisherModal('${f.id}')">🧯 Estintori</button>`:''}</div></div>`}).join('')||'<div class="module-card"><h3>Nessun mezzo</h3><p>Aggiungi il primo mezzo della flotta.</p></div>';
  } else if(originalRenderFleet) originalRenderFleet();
  injectHeaderButton();renderPanel();
};
window.openExtinguisherModal=function(preselect=''){
  const buses=(state.flotta||[]).filter(eligible);
  if(!buses.length)return toast('Nessun Bus GT/Limousine configurato.',false);
  let date='';
  if(preselect) date=currentDeadline(preselect)?.data_scadenza||'';
  const rows=buses.map(f=>{const d=currentDeadline(f.id),checked=preselect?f.id===preselect:true;return `<label class="check-item" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #dbe5ef;border-radius:10px"><input class="dg-ext-fleet" type="checkbox" value="${f.id}" ${checked?'checked':''}><span style="flex:1"><b>${esc(f.titolo||f.modello||f.targa)}</b><small style="display:block">${esc(f.targa||'')} · attuale: ${d?.data_scadenza?dateIT(d.data_scadenza):'non impostata'}</small></span></label>`}).join('');
  openModal('🧯 Scadenza estintori — Flotta',`<div class="statusline info" style="margin-bottom:12px">Gestione dedicata ai 3 Bus GT e al Limousine Bus. Il Mercedes V250D è escluso.</div><div class="form-grid"><div class="field full"><label>Mezzi interessati</label><div style="display:grid;gap:8px">${rows}</div></div><div class="field"><label>Data scadenza estintori *</label><input id="dg_ext_date" type="date" value="${esc(date)}"></div><div class="field"><label>Priorità</label><select id="dg_ext_priority"><option value="normale">Normale</option><option value="alta">Alta</option></select></div><div class="field full"><label>Note</label><textarea id="dg_ext_notes" placeholder="Es. Controllo semestrale / sostituzione prevista"></textarea></div></div>`,`<button class="btn btn-secondary" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveExtinguisherExpiry()">🧯 Salva scadenza</button>`);
};
window.saveExtinguisherExpiry=async function(){
  const ids=[...document.querySelectorAll('.dg-ext-fleet:checked')].map(x=>x.value),date=$id('dg_ext_date')?.value,priority=$id('dg_ext_priority')?.value||'normale',notes=$id('dg_ext_notes')?.value?.trim()||null;
  if(!ids.length)return toast('Seleziona almeno un mezzo.',false);
  if(!date)return toast('Inserisci la data di scadenza degli estintori.',false);
  try{
    for(const fid of ids){
      const f=(state.flotta||[]).find(x=>x.id===fid),existing=currentDeadline(fid);
      const body={titolo:`Scadenza estintori — ${f?.titolo||f?.targa||'Mezzo'}`,descrizione:notes||'Scadenza estintori registrata dalla sezione Flotta',tipo:'Estintori',stato:'aperta',priorita:priority,data_scadenza:date,riferimento_tipo:'flotta',riferimento_id:fid,note:notes};
      if(existing) await api('scadenze_gestionale',`id=eq.${existing.id}`,{method:'PATCH',body});
      else await api('scadenze_gestionale','',{method:'POST',body});
      try{await api('audit_log_gestionale','',{method:'POST',body:{azione:'AGGIORNA_SCADENZA_ESTINTORI',entita:'flotta',entita_id:fid,descrizione:'Scadenza estintori aggiornata dalla Flotta',dati:{data_scadenza:date}}})}catch{}
    }
    closeModal();toast(`Scadenza estintori salvata per ${ids.length} mezz${ids.length===1?'o':'i'}`);await loadAll();
  }catch(e){toast('Impossibile salvare la scadenza: '+e.message,false)}
};
function afterLoad(){injectHeaderButton();renderPanel()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterLoad,{once:true});else afterLoad();
})();
