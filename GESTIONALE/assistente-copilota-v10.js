/* DELGROSSO COPILOTA 360 V10 — actions with preview + explicit confirmation */
(function(){
'use strict';
const N=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const H=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const M=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const D=v=>v?new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('it-IT'):'—';
const active=b=>!N(b?.stato).includes('annull');
let plan=null;

function tokens(s){return N(s).split(/[^a-z0-9à-ÿ]+/).filter(x=>x.length>2)}
function score(text,q){const h=N(text),ts=tokens(q);return ts.reduce((n,t)=>n+(h.includes(t)?1:0),0)}
function trips(q){return [...(state.viaggi||[])].map(v=>({v,s:score([v.titolo,v.destinazione,v.data_partenza,v.id_viaggio].join(' '),q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.v)}
function books(q){return (state.prenotazioni||[]).filter(active).map(b=>({b,s:score([b.cliente,b.cliente_nome,b.telefono,b.codice,b.id_prenotazione,(state.viaggi||[]).find(v=>v.id===b.viaggio_id)?.titolo].join(' '),q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.b)}
function fleet(q){return (state.flotta||[]).filter(x=>x.attivo!==false).map(v=>({v,s:score([v.titolo,v.marca,v.modello,v.targa,v.categoria,v.descrizione].join(' '),q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.v)}
function clients(q){return (state.clienti||[]).map(c=>({c,s:score([c.nome,c.cognome,c.telefono,c.email,c.codice_cliente].join(' '),q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.c)}
function tripName(id){const v=(state.viaggi||[]).find(x=>x.id===id);return v?.titolo||v?.destinazione||'Viaggio'}
function capacity(v){const booked=(state.prenotazioni||[]).filter(b=>active(b)&&b.viaggio_id===v.id).reduce((n,b)=>n+Number(b.posti||0),0);return {booked,total:Number(v.posti_totali||0),free:Math.max(0,Number(v.posti_totali||0)-booked)}}
function dateISO(raw){const m=raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);if(m)return m[0];const d=raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);if(d)return `${d[3]}-${String(d[2]).padStart(2,'0')}-${String(d[1]).padStart(2,'0')}`;return ''}
function amount(raw){const m=raw.match(/(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)/i);return m?Number(m[1].replace(',','.')):0}
function km(raw){const m=raw.match(/(\d[\d.]*)\s*km\b/i);return m?Number(m[1].replace(/\./g,'')):null}
function box(){return document.getElementById('assistantDraft')}
function setPlan(p){plan=p;window.dgCopilotPlan=p;renderPlan()}
function clearPlan(){plan=null;window.dgCopilotPlan=null;if(box())box().innerHTML=''}
function selectHtml(id,label,arr,fmt){return `<div class="field full"><label>${H(label)}</label><select id="${id}"><option value="">— Seleziona —</option>${arr.map(x=>`<option value="${H(x.id)}">${H(fmt(x))}</option>`).join('')}</select></div>`}
function renderPlan(){
 const b=box(); if(!b||!plan)return;
 let selectors='';
 if(plan.need==='booking')selectors=selectHtml('cp_pick','Prenotazione corretta',plan.options,x=>`${x.cliente} · ${tripName(x.viaggio_id)} · ${x.posti||0} posti`);
 if(plan.need==='trip')selectors=selectHtml('cp_pick','Viaggio corretto',plan.options,x=>`${x.titolo||x.destinazione} · ${D(x.data_partenza)}`);
 if(plan.need==='fleet')selectors=selectHtml('cp_pick','Mezzo corretto',plan.options,x=>`${x.titolo||x.modello||x.marca} · ${x.targa||''}`);
 if(plan.need==='client')selectors=selectHtml('cp_pick','Cliente corretto',plan.options,x=>`${x.nome||''} ${x.cognome||''} · ${x.telefono||''}`);
 b.innerHTML=`<div class="module-card"><h3>🤖 Anteprima operazione</h3><div class="statusline" style="line-height:1.65">${plan.html}</div>${selectors}<div class="statusline" style="margin-top:10px">🔒 Nessuna modifica è stata ancora salvata.</div><div class="quick-actions" style="margin-top:10px"><button class="btn btn-green" onclick="dgCopilotConfirm()">✓ CONFERMA ED ESEGUI</button><button class="btn btn-secondary" onclick="dgCopilotCancel()">Annulla</button></div></div>`;
}
async function audit(action,entity,id,data){
 try{await api('audit_log_gestionale','',{method:'POST',body:{azione:action,entita:entity,entita_id:id||null,descrizione:'Operazione confermata tramite Assistente DELGROSSO',dati:data||{}}})}catch(_){}
}
function bookingChoice(){if(plan.target)return plan.target;const id=document.getElementById('cp_pick')?.value;return (state.prenotazioni||[]).find(x=>x.id===id)}
function tripChoice(){if(plan.target)return plan.target;const id=document.getElementById('cp_pick')?.value;return (state.viaggi||[]).find(x=>x.id===id)}
function fleetChoice(){if(plan.target)return plan.target;const id=document.getElementById('cp_pick')?.value;return (state.flotta||[]).find(x=>x.id===id)}
function clientChoice(){if(plan.target)return plan.target;const id=document.getElementById('cp_pick')?.value;return (state.clienti||[]).find(x=>x.id===id)}

async function interpret(raw){
 const q=N(raw); await loadAll();
 // Move booking
 if(/\b(sposta|trasferisci|cambia viaggio)\b/.test(q)){
   const bs=books(raw), vs=trips(raw); const b=bs[0], dest=vs.find(v=>v.id!==b?.viaggio_id)||vs[0];
   if(!b)return setPlan({kind:'move',need:'booking',options:(state.prenotazioni||[]).filter(active).slice(0,50),html:'Ho capito che vuoi <b>spostare una prenotazione</b>, ma devo sapere quale.'});
   if(!dest)return setPlan({kind:'move',target:b,need:'trip',options:(state.viaggi||[]).filter(v=>v.id!==b.viaggio_id),html:`Spostare <b>${H(b.cliente)}</b> da ${H(tripName(b.viaggio_id))}. Seleziona il viaggio di destinazione.`});
   const c=capacity(dest); return setPlan({kind:'move',target:b,dest,html:`Spostare <b>${H(b.cliente)}</b>: ${H(tripName(b.viaggio_id))} → <b>${H(dest.titolo)}</b>.<br>Posti richiesti: ${b.posti||0}. Disponibili nel nuovo viaggio: ${c.free}/${c.total}.`});
 }
 // Cancel booking
 if(/\b(annulla|cancella|elimina)\b.*\b(prenot|cliente|posto)|\b(non parte|rinuncia)\b/.test(q)){
   const bs=books(raw); return setPlan({kind:'cancel',target:bs.length===1?bs[0]:null,need:bs.length===1?null:'booking',options:bs.length?bs:(state.prenotazioni||[]).filter(active).slice(0,50),html:bs.length===1?`Annullare la prenotazione di <b>${H(bs[0].cliente)}</b> per ${H(tripName(bs[0].viaggio_id))}. I posti verranno liberati.`:'Seleziona la prenotazione da annullare.'});
 }
 // Check-in
 if(/\b(check.?in|presente|imbarcat)\b/.test(q)){
   const bs=books(raw), esito=/assente|non.*presente/.test(q)?'ASSENTE':/verific/.test(q)?'DA_VERIFICARE':'PRESENTE';
   return setPlan({kind:'checkin',target:bs.length===1?bs[0]:null,need:bs.length===1?null:'booking',options:bs.length?bs:(state.prenotazioni||[]).filter(active).slice(0,50),esito,html:bs.length===1?`Registrare check-in <b>${esito}</b> per ${H(bs[0].cliente)} · ${H(tripName(bs[0].viaggio_id))}.`:`Seleziona la prenotazione per il check-in <b>${esito}</b>.`});
 }
 // Publish/hide trip
 if(/\b(pubblica|pubblicato|nascondi|non pubblicare|togli.*sito)\b/.test(q)){
   const vs=trips(raw),pub=!/\b(nascondi|non pubblicare|togli.*sito)\b/.test(q);
   return setPlan({kind:'publish',target:vs.length===1?vs[0]:null,need:vs.length===1?null:'trip',options:vs.length?vs:(state.viaggi||[]).slice(0,50),pub,html:vs.length===1?`${pub?'Pubblicare':'Nascondere'} <b>${H(vs[0].titolo)}</b> sul sito.`:`Seleziona il viaggio da ${pub?'pubblicare':'nascondere'}.`});
 }
 // Assign vehicle
 if(/\b(assegna|metti|imposta)\b.*\b(bus|autobus|mezzo)\b/.test(q)){
   const vs=trips(raw), fs=fleet(raw), v=vs[0], f=fs[0];
   if(!v)return setPlan({kind:'assign',need:'trip',options:(state.viaggi||[]).slice(0,50),vehicle:f||null,html:'Seleziona il viaggio a cui assegnare il mezzo.'});
   if(!f)return setPlan({kind:'assign',target:v,need:'fleet',options:(state.flotta||[]).filter(x=>x.attivo!==false),html:`Assegnazione mezzo a <b>${H(v.titolo)}</b>. Seleziona il mezzo.`});
   return setPlan({kind:'assign',target:v,vehicle:f,html:`Assegnare <b>${H(f.titolo||f.modello||f.targa)}</b> al viaggio <b>${H(v.titolo)}</b> del ${D(v.data_partenza)}. Prima del salvataggio controllerò sovrapposizioni.`});
 }
 // Fleet deadlines
 if(/\b(estintor|revisione|assicurazione|bollo)\b/.test(q)){
   const type=/estintor/.test(q)?'Estintori':/revisione/.test(q)?'Revisione':/assicurazione/.test(q)?'Assicurazione':'Bollo';
   let d=dateISO(raw); if(!d){const months={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};for(const [m,n] of Object.entries(months)){const x=q.match(new RegExp(m+'\\s+(20\\\\d{2})'));if(x){const last=new Date(Number(x[1]),n,0).getDate();d=`${x[1]}-${String(n).padStart(2,'0')}-${last}`;break}}}
   let targets=(state.flotta||[]).filter(x=>x.attivo!==false);
   if(/\btranne\b/.test(q)){const ex=fleet(q.split('tranne')[1]||''); if(ex.length)targets=targets.filter(x=>!ex.some(e=>e.id===x.id))}
   else {const fs=fleet(raw); if(fs.length)targets=fs.slice(0,1)}
   if(!d)return setPlan({kind:'noop',html:`Ho individuato la scadenza <b>${type}</b>, ma manca una data precisa.`});
   return setPlan({kind:'deadline',targets,date:d,type,html:`Impostare scadenza <b>${type}</b> al ${D(d)} per:<br>${targets.map(x=>'• '+H(x.titolo||x.modello||x.targa)).join('<br>')}`});
 }
 // Maintenance
 if(/\b(tagliando|manutenzione|pneumatic|gomme)\b/.test(q)){
   const fs=fleet(raw), f=fs[0], type=/tagliando/.test(q)?'Tagliando':/pneumatic|gomme/.test(q)?'Pneumatici':'Manutenzione', d=dateISO(raw)||new Date().toISOString().slice(0,10), kms=km(raw);
   return setPlan({kind:'maintenance',target:f||null,need:f?null:'fleet',options:fleet(raw).length?fleet(raw):(state.flotta||[]).filter(x=>x.attivo!==false),type,date:d,kms,html:f?`Registrare <b>${type}</b> per ${H(f.titolo||f.modello||f.targa)} in data ${D(d)}${kms?` a ${kms} km`:''}.`:`Seleziona il mezzo su cui registrare <b>${type}</b>.`});
 }
 // Block vehicle
 if(/\b(blocca|indisponibile|fermo)\b.*\b(bus|mezzo|autobus)\b/.test(q)){
   const fs=fleet(raw),f=fs[0],d=dateISO(raw);
   return setPlan({kind:'block',target:f||null,need:f?null:'fleet',options:fs.length?fs:(state.flotta||[]).filter(x=>x.attivo!==false),date:d,html:`Bloccare ${f?'<b>'+H(f.titolo||f.modello||f.targa)+'</b>':'il mezzo selezionato'}${d?' per il '+D(d):''}.`});
 }
 // Activity/reminder
 if(/\b(attivita|promemoria|ricordami|scadenza)\b/.test(q)){
   const d=dateISO(raw); return setPlan({kind:'task',title:raw,date:d,html:`Creare attività: <b>${H(raw)}</b>${d?` · scadenza ${D(d)}`:''}.`});
 }
 // Client note
 if(/\b(nota|annota|scrivi)\b.*\b(cliente|su)\b/.test(q)){
   const cs=clients(raw);return setPlan({kind:'clientnote',target:cs.length===1?cs[0]:null,need:cs.length===1?null:'client',options:cs.length?cs:(state.clienti||[]).slice(0,50),note:raw,html:cs.length===1?`Aggiungere una nota alla scheda di <b>${H((cs[0].nome||'')+' '+(cs[0].cognome||''))}</b>.`:'Seleziona il cliente a cui aggiungere la nota.'});
 }
 return false;
}

async function confirmPlan(){
 if(!plan)return;
 try{
  let id=null;
  if(plan.kind==='noop')return toast('Manca un dato necessario: completa la richiesta.',false);
  if(plan.kind==='move'){
    const b=bookingChoice(); let v=plan.dest||tripChoice(); if(!b||!v)return toast('Seleziona prenotazione e viaggio.',false);
    const c=capacity(v); if(c.total && Number(b.posti||0)>c.free)throw new Error('Posti insufficienti nel viaggio di destinazione');
    await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body:{viaggio_id:v.id,viaggio_codice:v.id_viaggio||null,updated_at:new Date().toISOString()}});
    try{await rpc('dg_sync_booking_seats',{p_booking_id:b.id,p_seats:[]})}catch(_){}
    id=b.id; await audit('SPOSTA_PRENOTAZIONE','prenotazioni',id,{da:b.viaggio_id,a:v.id});
  } else if(plan.kind==='cancel'){
    const b=bookingChoice();if(!b)return toast('Seleziona la prenotazione.',false);
    await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body:{stato:'Annullata',updated_at:new Date().toISOString()}});
    try{await api('prenotazione_posti',`prenotazione_id=eq.${b.id}`,{method:'DELETE'})}catch(_){}
    id=b.id;await audit('ANNULLA_PRENOTAZIONE','prenotazioni',id,{cliente:b.cliente});
  } else if(plan.kind==='checkin'){
    const b=bookingChoice();if(!b)return toast('Seleziona la prenotazione.',false);
    const yes=plan.esito==='PRESENTE';
    await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body:{checkin_effettuato:yes,checkin_stato:plan.esito,checked_in_at:yes?new Date().toISOString():null,checkin_operatore:currentOperator?.name||'Assistente'}});
    await api('accessi_checkin','',{method:'POST',body:{prenotazione_id:b.id,prenotazione_codice:b.codice||b.id_prenotazione||null,viaggio_id:b.viaggio_id,cliente:b.cliente,telefono:b.telefono||null,esito:plan.esito,operatore:currentOperator?.name||'Assistente'}});
    id=b.id;await audit('CHECKIN','prenotazioni',id,{esito:plan.esito});
  } else if(plan.kind==='publish'){
    const v=tripChoice();if(!v)return toast('Seleziona il viaggio.',false);
    await api('viaggi',`id=eq.${v.id}`,{method:'PATCH',body:{pubblicato:plan.pub?'SI':'NO',updated_at:new Date().toISOString()}});
    id=v.id;await audit(plan.pub?'PUBBLICA_VIAGGIO':'NASCONDI_VIAGGIO','viaggi',id,{});
  } else if(plan.kind==='assign'){
    const v=tripChoice(),f=plan.vehicle||fleetChoice();if(!v||!f)return toast('Seleziona viaggio e mezzo.',false);
    const conflicts=(state.viaggi||[]).filter(x=>x.id!==v.id&&x.autobus_id===f.id&&String(x.data_partenza||'').slice(0,10)===String(v.data_partenza||'').slice(0,10)&&!N(x.stato).includes('annull'));
    const blocks=(state.dgBlocchi||[]).filter(x=>x.flotta_id===f.id&&String(v.data_partenza||'').slice(0,10)>=x.data_inizio&&String(v.data_partenza||'').slice(0,10)<=x.data_fine);
    if(conflicts.length||blocks.length)throw new Error('Mezzo non disponibile nella data del viaggio');
    await api('viaggi',`id=eq.${v.id}`,{method:'PATCH',body:{autobus_id:f.id,autobus:f.titolo||f.modello||f.targa,updated_at:new Date().toISOString()}});
    id=v.id;await audit('ASSEGNA_MEZZO','viaggi',id,{flotta_id:f.id});
  } else if(plan.kind==='deadline'){
    for(const f of plan.targets)await api('scadenze_gestionale','',{method:'POST',body:{titolo:`${plan.type} — ${f.titolo||f.modello||f.targa}`,tipo:plan.type,stato:'aperta',priorita:'normale',data_scadenza:plan.date,riferimento_tipo:'flotta',riferimento_id:f.id,descrizione:'Inserita tramite Assistente DELGROSSO'}});
    await audit('SCADENZA_FLOTTA','flotta',null,{tipo:plan.type,data:plan.date,mezzi:plan.targets.map(x=>x.id)});
  } else if(plan.kind==='maintenance'){
    const f=fleetChoice();if(!f)return toast('Seleziona il mezzo.',false);
    await api('manutenzioni_flotta','',{method:'POST',body:{flotta_id:f.id,tipo:plan.type,descrizione:`${plan.type} registrato tramite Assistente DELGROSSO`,data_intervento:plan.date,km:plan.kms||null,stato:'completata'}});
    id=f.id;await audit('MANUTENZIONE_FLOTTA','flotta',id,{tipo:plan.type,data:plan.date,km:plan.kms});
  } else if(plan.kind==='block'){
    const f=fleetChoice();if(!f||!plan.date)return toast('Servono mezzo e data.',false);
    await api('dg_blocchi_flotta','',{method:'POST',body:{flotta_id:f.id,data_inizio:plan.date,data_fine:plan.date,motivo:'Blocco inserito tramite Assistente DELGROSSO'}});
    id=f.id;await audit('BLOCCA_MEZZO','flotta',id,{data:plan.date});
  } else if(plan.kind==='task'){
    await api('attivita_gestionale','',{method:'POST',body:{titolo:plan.title,descrizione:'Creata tramite Assistente DELGROSSO',stato:'aperta',priorita:'normale',scadenza:plan.date||null,assegnata_a:currentOperator?.name||'Nicola'}});
    await audit('CREA_ATTIVITA','attivita_gestionale',null,{titolo:plan.title});
  } else if(plan.kind==='clientnote'){
    const c=clientChoice();if(!c)return toast('Seleziona il cliente.',false);
    const old=String(c.note||'').trim(), stamp=new Date().toLocaleString('it-IT');
    await api('clienti',`id=eq.${c.id}`,{method:'PATCH',body:{note:(old?old+'\n':'')+`[${stamp}] ${plan.note}`,updated_at:new Date().toISOString()}});
    id=c.id;await audit('NOTA_CLIENTE','clienti',id,{nota:plan.note});
  }
  await loadAll();
  toast('✓ Operazione eseguita e dati ricaricati');
  clearPlan();
 }catch(e){toast('Operazione non eseguita: '+(e.message||e),false)}
}
window.dgCopilotConfirm=confirmPlan;window.dgCopilotCancel=clearPlan;

// Wrap existing assistant: existing booking/payment/read engine remains available.
const old=window.assistantUnderstand;
window.assistantUnderstand=async function(){
 const raw=document.getElementById('assistantCommand')?.value||'';
 if(!raw.trim())return old?old():null;
 const handled=await interpret(raw);
 if(handled===false){
   if(old)return old();
   setPlan({kind:'noop',html:'Richiesta non riconosciuta in sicurezza. Non ho modificato alcun dato.'});
 }
};
})();
