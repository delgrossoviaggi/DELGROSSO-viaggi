/* DELGROSSO 2.7.1: archivio storico Agenda, attività + scadenze */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let agendaRows=[];
async function agendaHistorical(){
 const [deadlines,activities]=isDemo()?[DEMO.deadlines||[],[]]:await Promise.all([DGData.rows('deadlines',{order:'created_at.desc'}),DGData.rows('activities',{order:'created_at.desc'})]);
 agendaRows=[...deadlines.map(x=>({...x,_kind:'Scadenza',_day:x.data_scadenza,_note:x.note||''})),...activities.map(x=>({...x,_kind:'Attività',_day:x.scadenza||String(x.created_at||'').slice(0,10),_note:''}))].sort((a,b)=>String(b.created_at||b._day).localeCompare(String(a.created_at||a._day)));
 return sec('Agenda completa · Appunti e scadenze','Archivio storico originale di Supabase, anche le attività completate')+
 '<div class="metric-belt"><div class="mini-metric"><strong>'+activities.length+'</strong><span>Attività e appunti</span></div><div class="mini-metric"><strong>'+deadlines.length+'</strong><span>Scadenze</span></div><div class="mini-metric"><strong>'+agendaRows.length+'</strong><span>Totale storico</span></div></div>'+
 '<div class="action-row"><button class="btn-secondary" data-agenda27="new">＋ Nuovo appunto</button><button class="btn-secondary" data-dg8-action="new:deadlines">＋ Nuova scadenza</button><button class="btn-secondary" data-agenda27="csv">⇩ Esporta CSV Agenda</button></div>'+
 '<div class="filters"><label class="search-box">⌕ <input id="dg27-history-search" placeholder="Cerca tutti gli appunti..."></label></div>'+
 '<div id="dg27-history-list">'+(agendaRows.map(x=>'<article class="panel" style="padding:16px;margin-bottom:12px"><h3>'+esc(x.titolo)+'</h3><div class="small-note">'+esc(x._kind)+' · '+esc(x._day||'Senza data')+' · '+esc(x.stato||'aperta')+' · '+esc(x.priorita||'normale')+'</div><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(x.descrizione||'')+'</p><div style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(x._note)+'</div>'+(isDemo()?'':x._kind==='Attività'?'<button class="btn-secondary" data-agenda27="edit" data-id="'+esc(x.id)+'">✎ Modifica attività</button>':'<button class="btn-secondary" data-dg8-action="edit:deadlines" data-dg8-id="'+esc(x.id)+'">✎ Modifica scadenza</button>')+'</article>').join('')||'<p>Nessuna annotazione presente.</p>')+'</div>';
}
function editor(row){
 document.getElementById('dg27-activity-editor')?.remove();
 const root=document.createElement('div');root.id='dg27-activity-editor';root.style.cssText='position:fixed;inset:0;z-index:100000;background:#002b4088;display:grid;place-items:center;padding:14px';
 root.innerHTML='<div style="background:#fff;width:min(600px,100%);border-radius:16px;padding:20px;max-height:92vh;overflow:auto"><h3>'+(row?'Modifica attività':'Nuovo appunto')+'</h3><form id="dg27-editor-form" style="display:grid;gap:9px">'+
 '<label>Titolo <input name="titolo" required maxlength="180" value="'+esc(row?.titolo||'')+'"></label>'+
 '<label>Testo dell’appunto <textarea name="descrizione" maxlength="10000" rows="7" style="width:100%">'+esc(row?.descrizione||'')+'</textarea></label>'+
 '<label>Data <input name="scadenza" type="date" value="'+esc(row?.scadenza||'')+'"></label>'+
 '<label>Stato <select name="stato"><option value="aperta">Aperta</option><option value="in corso">In corso</option><option value="completata">Completata</option></select></label>'+
 '<label>Priorità <select name="priorita"><option value="normale">Normale</option><option value="alta">Alta</option><option value="bassa">Bassa</option></select></label>'+
 '<label>Assegnata a <input name="assegnata_a" value="'+esc(row?.assegnata_a||'')+'"></label>'+
 '<div class="action-row"><button type="submit" class="btn-main">Salva su Supabase</button><button type="button" class="btn-secondary" id="dg27-close">Chiudi</button></div><p id="dg27-editor-error" role="alert" style="color:#a22"></p></form></div>';
 document.body.append(root);const form=root.querySelector('form');if(row){form.elements.stato.value=row.stato||'aperta';form.elements.priorita.value=row.priorita||'normale';}
 root.querySelector('#dg27-close').onclick=()=>root.remove();
 form.onsubmit=async ev=>{ev.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;try{
   const data={titolo:form.elements.titolo.value.trim(),descrizione:form.elements.descrizione.value,scadenza:form.elements.scadenza.value||null,stato:form.elements.stato.value,priorita:form.elements.priorita.value,assegnata_a:form.elements.assegnata_a.value||null};
   if(data.titolo.length<2)throw Error('Titolo mancante');
   if(row)await DGData.update('attivita_gestionale',row.id,data);else await DGData.insert('attivita_gestionale',data);
   root.remove();loadPage();toast('Appunto salvato in Supabase');
  }catch(e){root.querySelector('#dg27-editor-error').textContent=e.message;btn.disabled=false;}};
}
renders.agenda=agendaHistorical;
document.addEventListener('input',e=>{if(e.target.id==='dg27-history-search'){const q=e.target.value.toLowerCase();document.querySelectorAll('#dg27-history-list article').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(q));}});
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-agenda27]');if(!btn)return;e.preventDefault();
 try{
  if(btn.dataset.agenda27==='csv'){DGData.downloadCSV([['TIPO','TITOLO','DATA','STATO','PRIORITÀ','DESCRIZIONE','NOTE'],...agendaRows.map(r=>[r._kind,r.titolo,r._day,r.stato,r.priorita,r.descrizione,r._note])],'DELGROSSO_AGENDA_STORICA.csv');return;}
  if(isDemo())throw Error('Accedi per modificare i dati');
  const row=btn.dataset.agenda27==='edit'?agendaRows.find(r=>r._kind==='Attività'&&r.id===btn.dataset.id):null;
  if(btn.dataset.agenda27==='edit'&&!row)throw Error('Appunto non trovato');
  editor(row);
 }catch(err){toast(err.message);}
});
})();