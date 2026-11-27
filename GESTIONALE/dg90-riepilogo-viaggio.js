/* DELGROSSO DG90 — Riepilogo viaggio nella versione completa (27/11/2026)
 * Stessa pagina del gestionale semplice: scegli il viaggio, vedi chi ha saldato, chi ha l'acconto e chi
 * non ha pagato, quanto hanno raccolto Nicola e Raffaele, crei i PDF e registri i pagamenti in due tocchi.
 * Usa i dati già caricati (state) e le funzioni ufficiali: dg_register_payment, dg_delete_payment,
 * dg67-booking-pdf (azione "payments") e professional-receipts. Nessun messaggio automatico ai clienti.
 */
(function(){
'use strict';
const ROUTE='riepilogo-viaggio';
const $=id=>document.getElementById(id);
const E=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const r2=n=>Math.round(num(n)*100)/100;
const eur=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(r2(n));
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(iso,d)=>{const t=new Date(iso+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+d);return t.toISOString().slice(0,10)};
const GG=['dom','lun','mar','mer','gio','ven','sab'],MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const dShort=iso=>{if(!/^\d{4}-\d{2}-\d{2}/.test(String(iso||'')))return '—';const d=new Date(String(iso).slice(0,10)+'T12:00:00Z');return GG[d.getUTCDay()]+' '+String(iso).slice(8,10)+'/'+String(iso).slice(5,7)+'/'+String(iso).slice(2,4)};
const dLong=iso=>{const d=new Date(String(iso).slice(0,10)+'T12:00:00Z');if(isNaN(d))return '';const w=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][d.getUTCDay()];return w+' '+d.getUTCDate()+' '+MESI[d.getUTCMonth()]+' '+d.getUTCFullYear()};
const titleCase=s=>String(s||'').toLowerCase().replace(/(^|[\s'(-])([a-zà-ù])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(E|Di|De|Del|Della|In|A|Al|Alla|Da|Con|Per)\b/g,(w,_,i)=>i===0?w:w.toLowerCase());
const tripLabel=t=>String(t&&(t.titolo||t.destinazione)||'Viaggio').replace(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/g,' ').replace(/[—–]\s*BIS.*$/i,' ').replace(/\s{2,}/g,' ').replace(/[\s\-–—·]+$/,'').trim();
const tripName=t=>titleCase(tripLabel(t))+(t&&t.bis_parent_id?' · bus '+(t.bis_numero||2):'');
const active=b=>!/annull|cancel|eliminat/i.test(String(b&&b.stato||''));
const residuo=b=>Math.max(0,r2(num(b.totale)-num(b.pagato)));
const nameOf=b=>String(b.cliente_nome||b.cliente||'Cliente').trim();
const digits=p=>String(p||'').replace(/[^\d]/g,'');
const waNumber=p=>{let d=digits(p);if(!d)return '';if(d.startsWith('00'))d=d.slice(2);if(d.length===10&&d.startsWith('3'))d='39'+d;return d};
const isRefund=p=>/rimbors/i.test(String(p&&p.tipo||''));
const isCash=m=>/contant/i.test(String(m||''));
const ST=()=>typeof state!=='undefined'?state:{};
const arr=k=>Array.isArray(ST()[k])?ST()[k]:[];
const payState=b=>residuo(b)<=0?'ok':num(b.pagato)>0?'acc':'none';
const RP={none:{t:'Senza acconto',d:'Devono pagare tutto'},acc:{t:'Con acconto',d:'Devono saldare'},ok:{t:'Saldati',d:'Hanno pagato tutto'}};
const ICO={coins:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>'};
const SVG=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
let sel=null,filter='',P=null,busy=false;

/* ---------- dati (già caricati dal gestionale) ---------- */
function trips(){
  const t0=today(),all=arr('viaggi').filter(t=>!/annullat/i.test(String(t.stato||''))&&t.data_partenza);
  const up=all.filter(t=>t.data_partenza>=t0).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))||num(a.bis_numero)-num(b.bis_numero)||String(a.titolo).localeCompare(String(b.titolo)));
  const past=all.filter(t=>t.data_partenza<t0).sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza))||num(a.bis_numero)-num(b.bis_numero));
  return {up,past,all};
}
const tripById=id=>arr('viaggi').find(t=>t.id===id);
const bookingsAll=t=>arr('prenotazioni').filter(b=>b.viaggio_id===t.id);
const seatsOf=b=>{const xs=arr('prenotazionePosti').filter(s=>s.prenotazione_id===b.id).map(s=>num(s.posto)).filter(n=>n>0);
  return (xs.length?xs:String(b.posti_selezionati||'').split(/[,;\s]+/).map(Number).filter(n=>n>0)).sort((a,c)=>a-c)};
const operators=()=>arr('operatori');

/* soldi raccolti: acconti + saldi − rimborsi per chi li ha incassati; "Senza nome" = pagati senza ricevuta */
function collectors(pays,activeList){
  const M=new Map(),cap=x=>x?x.charAt(0).toUpperCase()+x.slice(1):x,add=n=>{if(!M.has(n))M.set(n,{name:n,net:0,acc:0,sal:0,rim:0,other:0});return M.get(n)};
  for(const o of operators().filter(o=>/nicola|raffaele/i.test(String(o.username||'')+' '+String(o.nome||''))))add(cap(String(o.nome||o.username)));
  const byB={},act=new Set(activeList.map(b=>b.id));let annullate=0;
  for(const p of pays){
    if(/annull|storn/i.test(String(p.stato||'')))continue;
    const o=operators().find(x=>x.user_id&&x.user_id===p.incassato_da_user_id);
    const c=add(cap(String(o?(o.nome||o.username):(p.incassato_da||'')).trim().toLowerCase())||'Non indicato');
    const v=isRefund(p)?-Math.abs(num(p.importo)):Math.abs(num(p.importo));
    c.net+=v;if(isRefund(p))c.rim+=v;else if(/acconto/i.test(String(p.tipo||'')))c.acc+=v;else c.sal+=v;
    if(!isCash(p.metodo_pagamento||p.metodo))c.other+=v;
    byB[p.prenotazione_id]=(byB[p.prenotazione_id]||0)+v;if(!act.has(p.prenotazione_id))annullate+=v;
  }
  let ignoto=0,ignotoN=0;for(const b of activeList){const d=r2(num(b.pagato)-(byB[b.id]||0));if(d>=.01){ignoto+=d;ignotoN++}}
  const ord=n=>/nicola/i.test(n)?0:/raffaele/i.test(n)?1:2;
  const out=[...M.values()].filter(c=>ord(c.name)<2||Math.abs(c.net)>=.01).sort((a,b)=>ord(a.name)-ord(b.name)||a.name.localeCompare(b.name,'it'))
    .concat(ignoto>=.01?[{name:'Senza nome',net:r2(ignoto),acc:0,sal:0,rim:0,other:0,ignoto:ignotoN}]:[]);
  out.annullate=r2(annullate);return out;
}

/* ---------- pagina ---------- */
function render(){
  const page=$('page-'+ROUTE);if(!page)return;
  const {up,past,all}=trips();
  if(!sel||!all.some(t=>t.id===sel))sel=(up[0]||past[0]||{}).id||null;
  const t=tripById(sel);
  const opt=x=>`<option value="${E(x.id)}" ${x.id===sel?'selected':''}>${E(dShort(x.data_partenza))} · ${E(tripName(x))}</option>`;
  let h=`<div class="dg90">
  <div class="dg90-top"><label class="dg90-pick">Scegli il viaggio<select id="dg90Trip" aria-label="Viaggio">
   ${up.length?`<optgroup label="Prossimi viaggi">${up.map(opt).join('')}</optgroup>`:''}${past.length?`<optgroup label="Viaggi passati">${past.map(opt).join('')}</optgroup>`:''}
  </select></label><button type="button" class="dg90-btn light" data-dg90="reload">↻ Aggiorna</button></div>`;
  if(!t){page.innerHTML=h+'<div class="dg90-empty">Nessun viaggio da mostrare.</div></div>';return}
  const allB=bookingsAll(t),bs=allB.filter(b=>active(b)&&!b.riserva_aziendale),ris=allB.filter(b=>active(b)&&b.riserva_aziendale).reduce((a,b)=>a+num(b.posti),0);
  const sum=(xs,f)=>r2(xs.reduce((a,b)=>a+f(b),0));
  const G={none:[],acc:[],ok:[]};for(const b of bs.slice().sort((a,c)=>nameOf(a).localeCompare(nameOf(c),'it')))G[payState(b)].push(b);
  const tot=sum(bs,b=>num(b.totale)),paid=sum(bs,b=>num(b.pagato)),due=sum(bs,residuo),pax=bs.reduce((a,b)=>a+num(b.posti),0);
  const future=t.data_partenza>=today();
  const ids=new Set(allB.map(b=>b.id)),pays=arr('pagamenti').filter(p=>ids.has(p.prenotazione_id)),cs=collectors(pays,bs);
  h+=`<div class="dg90-hero"><div><b>${E(tripName(t))}</b><span>${E(dLong(t.data_partenza))} · ${bs.length} prenotazioni, ${pax} persone</span><span>Incassati <strong>${eur(paid)}</strong> su ${eur(tot)}</span></div>
   <div class="dg90-due"><strong>${eur(due)}</strong><span>ancora da incassare</span></div></div>
  <div class="dg90-stati" role="group" aria-label="Mostra solo">${['ok','acc','none'].map(k=>`<button type="button" class="dg90-st ${k}" data-dg90="filter" data-v="${k}" aria-pressed="${filter===k}"><span class="n">${G[k].length}</span><span class="l">${RP[k].t}</span><span class="a">${k==='ok'?eur(sum(G.ok,b=>num(b.pagato)))+' incassati':'devono '+eur(sum(G[k],residuo))}</span></button>`).join('')}</div>
  <div class="dg90-row2">
   <section class="dg90-card dg90-soldi"><h3>Soldi raccolti su questo viaggio</h3><div class="ops">${cs.map(c=>`<div class="op${c.ignoto?' ign':''}"><span class="l">${E(c.name)}</span><b class="v">${eur(c.net)}</b>
    <span class="d">${c.ignoto?`segnati come pagati senza ricevuta, quindi senza chi li ha incassati (${c.ignoto} ${c.ignoto===1?'prenotazione':'prenotazioni'})`:[c.acc?'acconti '+eur(c.acc):'',c.sal?'saldi '+eur(c.sal):'',c.rim?'rimborsi '+eur(c.rim):''].filter(Boolean).join(' · ')||'nessun incasso'}</span>
    ${Math.abs(c.other)>=.01?`<span class="d">di cui ${eur(c.other)} con POS o bonifico</span>`:''}</div>`).join('')}</div>
    ${Math.abs(cs.annullate)>=.01?`<p class="dg90-note">Nei totali di Nicola e Raffaele ci sono anche ${eur(cs.annullate)} di prenotazioni annullate, che non sono compresi negli incassati qui sopra.</p>`:''}</section>
   <div class="dg90-pdfs"><button type="button" class="dg90-btn gold" data-dg90="pdf" data-v="due">${SVG('doc')}PDF di chi deve ancora pagare</button><button type="button" class="dg90-btn light" data-dg90="pdf" data-v="all">${SVG('doc')}PDF riepilogo completo</button>
   ${ris?`<p class="dg90-note">Non conteggiati: ${ris} posti riservati DELGROSSO.</p>`:''}</div>
  </div>
  ${filter?`<button type="button" class="dg90-link" data-dg90="filter" data-v="${filter}">Mostra tutte le prenotazioni</button>`:''}`;
  if(!bs.length)h+='<div class="dg90-empty">Nessuna prenotazione su questo viaggio.</div>';
  for(const k of ['none','acc','ok']){
    if(!bs.length)break;
    if(filter&&filter!==k)continue;
    const list=G[k];if(!list.length&&!filter)continue;
    h+=`<div class="dg90-h ${k}"><h3>${RP[k].t} <span>(${list.length})</span></h3><small>${RP[k].d}${k==='ok'?'':': '+eur(sum(list,residuo))}</small></div><div class="dg90-list">`;
    h+=list.map(b=>{
      const r=residuo(b),wa=waNumber(b.telefono),seats=seatsOf(b),created=String(b.created_at||'').slice(0,10);
      const late=k==='none'&&future&&created&&created<=addDays(today(),-num(b.giorni_acconto||2));
      const tag=k==='ok'?'<span class="dg90-tag ok">Saldato</span>':k==='acc'?`<span class="dg90-tag warn">Resta ${eur(r)}</span>`:`<span class="dg90-tag bad">Deve ${eur(r)}</span>`;
      return `<div class="dg90-pax"><div class="top"><div class="who"><button type="button" class="nm" data-dg90="open" data-id="${E(b.id)}">${E(nameOf(b))} ›</button>
       <span>${num(b.posti)} ${num(b.posti)===1?'posto':'posti'}${seats.length?' (n. '+E(seats.join(', '))+')':''}${b.fermata_partenza?' · '+E(titleCase(b.fermata_partenza)):''}</span>
       <span>Totale ${eur(b.totale)} · versato ${eur(b.pagato)}${created?' · prenotato il '+E(created.slice(8,10)+'/'+created.slice(5,7)):''}</span>
       ${late?'<span class="late">Oltre i 2 giorni senza acconto</span>':''}</div>${tag}</div>
       ${k!=='ok'?`<div class="act"><button type="button" class="dg90-pay" data-dg90="pay" data-id="${E(b.id)}">${SVG('coins')}Incassa ${eur(r)}</button>${b.telefono?`<span class="contacts"><a href="tel:${E(digits(b.telefono))}">Chiama ${E(b.telefono)}</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}</span>`:''}</div>`:''}</div>`;
    }).join('')||'<div class="dg90-empty">Nessuno.</div>';
    h+='</div>';
  }
  page.innerHTML=h+'</div>';
}

/* ---------- comunicazione con il server ---------- */
async function fn(name,payload){
  if(typeof authSession==='undefined'||!authSession||!authSession.access_token)throw new Error('Accedi di nuovo al gestionale.');
  const run=()=>fetch(`${SUPA_URL}/functions/v1/${name}`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+authSession.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let res=await run();
  if(res.status===401&&authSession.refresh_token&&typeof refreshAuth==='function'){if(await refreshAuth())res=await run()}
  let out={};try{out=await res.json()}catch{out={}}
  if(!res.ok||out.success===false)throw new Error(out.error||('Errore '+res.status));
  return out;
}
const friendly=m=>{const s=String(m||'');if(/IMPORTO_SUPERIORE_AL_RESIDUO/.test(s))return 'L’importo supera quanto resta da pagare.';if(/IMPORTO_NON_VALIDO/.test(s))return 'Importo non valido.';if(/PRENOTAZIONE_NON_TROVATA/.test(s))return 'Prenotazione non trovata: aggiorna.';if(/non autorizzat/i.test(s))return 'Operazione non autorizzata per questo account.';return s.slice(0,240)};
function say(msg,ok=true){if(typeof toast==='function')toast(msg,ok);else alert(msg)}
/* apre subito una scheda (per non essere bloccati dal browser) e poi ci carica il PDF */
async function openPdf(get){
  const w=window.open('','_blank');
  if(w)w.document.write('<p style="font-family:sans-serif;padding:20px">Preparo il documento…</p>');
  try{const url=await get();if(w)w.location.href=url;else location.href=url}
  catch(e){if(w)w.close();say(friendly(e.message),false)}
}
const pdf=scope=>openPdf(async()=>(await fn('dg67-booking-pdf',{action:'payments',tripId:sel,scope})).signedUrl);
const receiptPdf=pid=>openPdf(async()=>{const r=typeof window.callReceipt74==='function'?await window.callReceipt74({action:'generate',kind:'trip',id:pid}):await fn('professional-receipts',{action:'generate',kind:'trip',id:pid});if(!r.signedUrl)throw new Error('Ricevuta non disponibile.');return r.signedUrl});
async function reload(){if(typeof loadAll==='function')await loadAll(true);render()}

/* ---------- finestra «Incassa» ---------- */
const METODI=['Contanti','POS','Bonifico'];
function modal(html){
  let m=$('dg90Modal');
  if(!m){m=document.createElement('div');m.id='dg90Modal';m.className='dg90-modal';m.addEventListener('click',e=>{if(e.target===m&&!busy)close()});document.body.appendChild(m)}
  m.innerHTML=`<div class="dg90-box" role="dialog" aria-modal="true" aria-labelledby="dg90MT">${html}</div>`;m.hidden=false;
  const f=m.querySelector('input,button.dg90-btn.gold');if(f)setTimeout(()=>f.focus(),40);
}
function close(){const m=$('dg90Modal');if(m){m.hidden=true;m.innerHTML=''}P=null}
const amount=b=>{const r=residuo(b);return P.amt==='tutto'?r:P.amt==='meta'?Math.min(r,r2(num(b.totale)/2)):Math.min(r,r2(num(P.altro)))};
const label=b=>{const a=amount(b);return a>0?'Registra '+eur(a)+(P.met==='Contanti'?' in contanti':' con '+P.met):'Scrivi l’importo'};
function me(){const o=operators().find(x=>authSession&&authSession.user&&x.user_id===authSession.user.id);return o?(o.nome||o.username):(typeof currentOperator!=='undefined'&&currentOperator?currentOperator.name:'te')}
function paySheet(id){
  const b=arr('prenotazioni').find(x=>x.id===id);if(!b)return say('Prenotazione non trovata: aggiorna.',false);
  const r=residuo(b),t=tripById(b.viaggio_id),half=r2(num(b.totale)/2);
  if(r<=0)return say(nameOf(b)+' ha già pagato tutto.');
  if(!P||P.id!==id)P={id,amt:'tutto',altro:'',met:'Contanti'};
  const opts=[['tutto',(num(b.pagato)>0?'Saldo · ':'Tutto · ')+eur(r)]].concat(num(b.pagato)<=0&&half>0&&half<r?[['meta','Acconto metà · '+eur(half)]]:[]).concat([['altro','Altra cifra']]);
  modal(`<h3 id="dg90MT">Incassa da ${E(nameOf(b))}</h3>
  <p class="dg90-muted">${t?E(tripName(t))+', '+E(dShort(t.data_partenza))+' · ':''}totale ${eur(b.totale)} · versato ${eur(b.pagato)} · <b>deve ${eur(r)}</b></p>
  <div class="dg90-opts">${opts.map(([k,l])=>`<button type="button" class="${P.amt===k?'on':''}" data-amt="${k}" aria-pressed="${P.amt===k}">${E(l)}</button>`).join('')}</div>
  ${P.amt==='altro'?`<label class="dg90-field">Importo ricevuto (€)<input id="dg90Altro" type="number" inputmode="decimal" min="0.01" max="${r}" step="0.01" value="${E(P.altro)}"></label>`:''}
  <div class="dg90-met" role="group" aria-label="Come ha pagato">${METODI.map(x=>`<button type="button" class="${P.met===x?'on':''}" data-met="${x}" aria-pressed="${P.met===x}">${x}</button>`).join('')}</div>
  <button type="button" class="dg90-btn gold big" id="dg90Ok">${E(label(b))}</button>
  <p class="dg90-muted small">Viene registrato come incassato da ${E(me())}. Nessun messaggio al cliente.</p>
  <button type="button" class="dg90-btn light" id="dg90No">Annulla</button>`);
  const box=$('dg90Modal');
  box.querySelectorAll('[data-amt]').forEach(x=>x.onclick=()=>{P.amt=x.dataset.amt;paySheet(id)});
  box.querySelectorAll('[data-met]').forEach(x=>x.onclick=()=>{P.met=x.dataset.met;paySheet(id)});
  const inp=$('dg90Altro');if(inp)inp.oninput=()=>{P.altro=inp.value;$('dg90Ok').textContent=label(b)};
  $('dg90No').onclick=close;
  $('dg90Ok').onclick=async e=>{
    if(busy)return;const btn=e.currentTarget,amt=amount(b),met=P.met;
    if(!(amt>0))return say('Scrivi l’importo ricevuto.',false);
    if(amt>r+0.005)return say('L’importo supera quanto resta da pagare ('+eur(r)+').',false);
    busy=true;btn.disabled=true;btn.textContent='Attendi…';
    try{
      const tipo=num(b.pagato)<=0&&amt<r?'Acconto':'Saldo';
      const res=await rpc('dg_register_payment',{p_booking_id:b.id,p_tipo:tipo,p_importo:amt,p_metodo:met,p_data:today(),p_note:'Registrato dal Riepilogo viaggio (versione completa)'});
      const d={pid:res&&res.payment_id,num:res&&res.receipt_number,name:nameOf(b),tel:b.telefono,amt,met,tipo,rest:r2(r-amt)};
      P=null;busy=false;doneSheet(d);reload().catch(()=>{});
    }catch(err){busy=false;btn.disabled=false;btn.textContent=label(b);say('Pagamento non registrato: '+friendly(err.message),false)}
  };
}
function doneSheet(d){
  const wa=waNumber(d.tel);
  modal(`<h3 id="dg90MT">Incasso registrato</h3>
  <p class="dg90-big"><b>${E(d.name)}</b>: ${E(d.tipo.toLowerCase())} di <b>${eur(d.amt)}</b> ${d.met==='Contanti'?'in contanti':'con '+E(d.met)}.${d.rest>0?' Resta da pagare '+eur(d.rest)+'.':' Ha pagato tutto.'}</p>
  ${d.num?`<p class="dg90-muted small">Ricevuta ${E(d.num)}</p>`:''}
  ${d.pid?`<button type="button" class="dg90-btn gold" id="dg90Rcpt">${SVG('doc')}Apri la ricevuta PDF</button>`:''}
  ${wa?`<a class="dg90-btn light" href="https://wa.me/${wa}?text=${encodeURIComponent('Buongiorno '+d.name+', le inviamo la ricevuta del pagamento. Grazie, DELGROSSO Viaggi')}" target="_blank" rel="noopener">Scrivi al cliente su WhatsApp</a><p class="dg90-muted small">Da computer: apri la ricevuta, scaricala e allegala nella chat.</p>`:''}
  <button type="button" class="dg90-btn" id="dg90Done">Fatto</button>
  ${d.pid?'<button type="button" class="dg90-link" id="dg90Undo">Ho sbagliato: annulla questo incasso</button>':''}`);
  $('dg90Done').onclick=close;
  if(d.pid){
    $('dg90Rcpt').onclick=()=>receiptPdf(d.pid);
    $('dg90Undo').onclick=()=>{
      modal(`<h3 id="dg90MT">Annullare l’incasso?</h3><p class="dg90-big">${E(d.name)} · ${eur(d.amt)}. Il pagamento viene tolto e il residuo torna come prima.</p>
      <button type="button" class="dg90-btn danger" id="dg90UOk">Sì, annulla l’incasso</button><button type="button" class="dg90-btn light" id="dg90UNo">No</button>`);
      $('dg90UNo').onclick=()=>doneSheet(d);
      $('dg90UOk').onclick=async e=>{if(busy)return;busy=true;e.currentTarget.disabled=true;
        try{await rpc('dg_delete_payment',{p_payment_id:d.pid,p_reason:'Annullato subito dopo la registrazione (Riepilogo viaggio)'});busy=false;close();say('Incasso annullato');await reload()}
        catch(err){busy=false;say('Non annullato: '+friendly(err.message),false);doneSheet(d)}};
    };
  }
}

/* ---------- voce di menu, pagina e collegamenti ---------- */
function addMenu(){
  const nav=$('dg44-sidebar-menu');if(!nav)return false;
  if(nav.querySelector(`[data-dg44-target="${ROUTE}"]`))return true;
  const b=document.createElement('button');b.type='button';b.className='dg44-nav-button';b.dataset.dg44Target=ROUTE;b.setAttribute('onclick',`window.dg44Go('${ROUTE}')`);
  b.innerHTML=`<span class="dg44-nav-icon">${SVG('coins')}</span><span>Riepilogo viaggio · incassi</span>`;
  const after=nav.querySelector('[data-dg44-target="viaggi"]');if(after&&after.parentNode)after.parentNode.insertBefore(b,after.nextSibling);else nav.appendChild(b);
  return true;
}
function init(){
  const host=document.querySelector('main.main > .content')||document.querySelector('main .content')||document.querySelector('main');if(!host)return;
  if(!$('page-'+ROUTE)){const s=document.createElement('section');s.className='page dg90-page';s.id='page-'+ROUTE;host.appendChild(s)}
  if(typeof PAGE_META!=='undefined')PAGE_META[ROUTE]=['Riepilogo viaggio','Chi ha saldato, chi ha l’acconto, chi deve pagare · incassi e PDF'];
  const oldRender=window.renderPage;
  if(typeof oldRender==='function')window.renderPage=function(p){const out=oldRender.apply(this,arguments);if(p===ROUTE)render();return out};
  window.dg90Open=function(tripId){if(tripId)sel=tripId;filter='';if(typeof window.dg44Go==='function')window.dg44Go(ROUTE);else if(typeof go==='function')go(ROUTE)};
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-dg90]');if(!a)return;
    const k=a.dataset.dg90,id=a.dataset.id;
    if(k==='filter'){filter=filter===a.dataset.v?'':a.dataset.v;render()}
    else if(k==='pdf')pdf(a.dataset.v);
    else if(k==='pay')paySheet(id);
    else if(k==='reload')reload().catch(err=>say(err.message,false));
    else if(k==='open'){if(typeof window.dg50OpenBooking==='function')window.dg50OpenBooking(id);else if(typeof window.openBookingModal==='function')window.openBookingModal(id)}
  });
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='dg90Trip'){sel=e.target.value;filter='';render()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dg90Modal')&&!$('dg90Modal').hidden&&!busy)close()});
  let tries=0;const t=setInterval(()=>{if(addMenu()||++tries>60)clearInterval(t)},1000);addMenu();
  if(location.hash==='#'+ROUTE&&document.body.classList.contains('dg44-authenticated')&&typeof go==='function')go(ROUTE);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
