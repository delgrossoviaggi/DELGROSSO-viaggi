/* DELGROSSO DG91 — «Modifica incassatore» nella pagina Pagamenti (27/11/2026)
 * Accanto a ogni pagamento (viaggi e noleggi) mostra chi l'ha incassato e, solo agli amministratori,
 * il pulsante per cambiarlo. Il cambio passa da dg_change_payment_collector (controllo ruolo admin sul server,
 * cassa operatori ed economia aggiornate, ricevuta rifatta, registro in audit_log_gestionale).
 * Nessun messaggio ai clienti.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const eur=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Math.abs(num(n)));
const ST=()=>typeof state!=='undefined'?state:{};
const arr=k=>Array.isArray(ST()[k])?ST()[k]:[];
const ops=()=>arr('operatori').filter(o=>o.attivo!==false);
const myId=()=>typeof authSession!=='undefined'&&authSession&&authSession.user?authSession.user.id:null;
const isAdmin=()=>{const o=arr('operatori').find(x=>x.user_id===myId());return !!o&&o.attivo!==false&&o.ruolo==='admin'};
const opName=uid=>{const o=arr('operatori').find(x=>x.user_id===uid);return o?(o.nome||o.username):''};
const who=p=>opName(p.incassato_da_user_id)||String(p.incassato_da||'').trim()||'non indicato';
const isRefund=p=>/rimbors/i.test(String(p.tipo||''))||num(p.importo)<0;
const isCash=m=>/contant/i.test(String(m||''));
const dIT=iso=>{const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:''};
const find=(kind,id)=>(kind==='rental'?arr('noleggiPagamenti'):arr('pagamenti')).find(x=>x.id===id);
let busy=false;

/* ---------- riga della tabella Pagamenti ---------- */
function idOf(tr){
  for(const b of tr.querySelectorAll('button[onclick]')){
    const s=b.getAttribute('onclick')||'';
    let m=s.match(/deleteWrongPayment\(\s*['"](trip|rental)['"]\s*,\s*['"]([^'"]+)['"]/);if(m)return {kind:m[1],id:m[2]};
    m=s.match(/openEditPaymentModal\(\s*['"]([^'"]+)['"]/);if(m)return {kind:'trip',id:m[1]};
  }
  return null;
}
function decorate(){
  const tb=$('paymentsTable');if(!tb)return;
  const admin=isAdmin();
  for(const tr of tb.querySelectorAll('tr')){
    const ref=idOf(tr);if(!ref)continue;
    const p=find(ref.kind,ref.id);if(!p)continue;
    const key=ref.kind+':'+p.id+':'+(p.incassato_da_user_id||'')+':'+admin;
    if(tr.dataset.dg91===key)continue;tr.dataset.dg91=key;
    const cell=tr.lastElementChild;if(!cell)continue;
    let tag=[...cell.querySelectorAll('small')].find(s=>/👤/.test(s.textContent));
    if(!tag){tag=document.createElement('small');cell.appendChild(document.createElement('br'));cell.appendChild(tag)}
    tag.textContent='👤 '+(isRefund(p)?'Dato da ':'Incassato da ')+who(p);tag.className='dg91-who';
    cell.querySelectorAll('.dg91-btn').forEach(x=>x.remove());
    if(admin&&!/annull|storn/i.test(String(p.stato||''))){
      const b=document.createElement('button');b.type='button';b.className='btn btn-secondary btn-sm dg91-btn';b.textContent='👤 Modifica incassatore';
      b.title='Cambia chi ha incassato questo pagamento (solo amministratori)';
      b.addEventListener('click',()=>sheet(ref.kind,p.id));
      tag.insertAdjacentElement('afterend',b);
    }
  }
}

/* ---------- finestra ---------- */
function modal(html){
  let m=$('dg91Modal');
  if(!m){m=document.createElement('div');m.id='dg91Modal';m.className='dg90-modal';m.addEventListener('click',e=>{if(e.target===m&&!busy)close()});document.body.appendChild(m)}
  m.innerHTML=`<div class="dg90-box" role="dialog" aria-modal="true" aria-labelledby="dg91T">${html}</div>`;m.hidden=false;
}
function close(){const m=$('dg91Modal');if(m){m.hidden=true;m.innerHTML=''}}
function say(msg,ok=true){if(typeof toast==='function')toast(msg,ok);else alert(msg)}
function clientOf(kind,p){
  if(kind==='rental'){const r=arr('noleggi').find(x=>x.id===p.noleggio_id);return r?(r.referente||r.azienda||'Noleggio'):'Noleggio'}
  const b=arr('prenotazioni').find(x=>x.id===p.prenotazione_id);return p.cliente||(b&&(b.cliente_nome||b.cliente))||'Cliente';
}
function sheet(kind,id,pick,why){
  const p=find(kind,id);if(!p)return say('Pagamento non trovato: aggiorna.',false);
  if(!isAdmin())return say('Solo gli amministratori possono cambiare chi ha incassato.',false);
  const refund=isRefund(p),amt=Math.abs(num(p.importo)),method=p.metodo_pagamento||p.metodo||'',cash=isCash(method),from=who(p);
  const others=ops().filter(x=>x.user_id!==p.incassato_da_user_id);
  if(!others.length)return say('Non ci sono altri operatori a cui assegnarlo.',false);
  if(!pick&&others.length===1)pick=others[0].user_id;
  const to=pick&&ops().find(x=>x.user_id===pick),toName=to?(to.nome||to.username):'';
  modal(`<h3 id="dg91T">Modifica incassatore</h3>
  <p class="dg90-muted">${E(clientOf(kind,p))} · ${E(p.tipo||'Pagamento')} di ${eur(amt)} del ${E(dIT(p.data_pagamento||p.created_at))}${method?' · '+E(method):''}${kind==='rental'?' · noleggio':''}</p>
  <p class="dg90-big">Ora risulta ${refund?'dato':'incassato'} da <b>${E(from)}</b></p>
  <div class="dg90-opts">${others.map(x=>`<button type="button" class="${x.user_id===pick?'on':''}" data-u="${E(x.user_id)}" aria-pressed="${x.user_id===pick}">${refund?'Dato':'Incassato'} da ${E(x.nome||x.username)}</button>`).join('')}</div>
  <label class="dg90-field">Motivo (facoltativo)<input id="dg91Why" value="${E(why||'')}" placeholder="es. registrato per sbaglio a nome mio"></label>
  ${to?`<p class="dg91-note">${cash?`La cassa di ${E(from)} ${refund?'sale':'scende'} di ${eur(amt)}, quella di ${E(toName)} ${refund?'scende':'sale'} di ${eur(amt)}.`:`Pagato con ${E(method)}: i contanti non cambiano, cambia solo a chi è attribuito.`} La ricevuta verrà rifatta con il nome giusto. Nessun messaggio al cliente.</p>`:''}
  <button type="button" class="dg90-btn ${to?'':'light'}" id="dg91Ok" ${to?'':'disabled'}>${to?'Conferma: '+(refund?'dato':'incassato')+' da '+E(toName):'Scegli chi ha '+(refund?'dato il rimborso':'incassato')}</button>
  <button type="button" class="dg90-btn light" id="dg91No">Annulla</button>`);
  const m=$('dg91Modal');
  m.querySelectorAll('[data-u]').forEach(x=>x.onclick=()=>sheet(kind,id,x.dataset.u,$('dg91Why').value));
  $('dg91No').onclick=close;
  $('dg91Ok').onclick=async e=>{
    if(busy||!to)return;busy=true;const btn=e.currentTarget;btn.disabled=true;btn.textContent='Attendi…';
    try{
      const r=await rpc('dg_change_payment_collector',{p_kind:kind,p_payment_id:p.id,p_user_id:to.user_id,p_reason:$('dg91Why').value.trim()||null});
      busy=false;close();say(r&&r.changed===false?'Era già a nome di '+toName:'Ora risulta '+(refund?'dato':'incassato')+' da '+toName);
      if(typeof loadAll==='function')await loadAll(true);decorate();
    }catch(err){
      busy=false;btn.disabled=false;btn.textContent='Conferma: '+(refund?'dato':'incassato')+' da '+toName;
      const s=String(err&&err.message||'');
      say(/SOLO_AMMINISTRATORI/.test(s)?'Solo gli amministratori possono cambiare chi ha incassato.':/PAGAMENTO_ANNULLATO/.test(s)?'Questo pagamento è stato annullato.':/PAGAMENTO_NON_TROVATO/.test(s)?'Pagamento non trovato: aggiorna.':/OPERATORE_NON_VALIDO/.test(s)?'Operatore non attivo.':'Non modificato: '+s.slice(0,200),false);
    }
  };
}
window.dg91ChangeCollector=sheet;

/* ---------- aggancio ---------- */
function init(){
  const old=window.renderPayments;
  if(typeof old==='function')window.renderPayments=function(){const r=old.apply(this,arguments);decorate();setTimeout(decorate,60);return r};
  const tb=$('paymentsTable');if(tb)new MutationObserver(()=>decorate()).observe(tb,{childList:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dg91Modal')&&!$('dg91Modal').hidden&&!busy)close()});
  decorate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
