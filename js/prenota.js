/* DELGROSSO Viaggi — prenotazione online in 3 passi.
   Usa le stesse funzioni sicure di sempre (js/gestionale.js): partenze, posti occupati,
   piantina ufficiale, fermate, registrazione idempotente; conferma PDF con js/ricevuta.js
   e archiviazione nel gestionale. Cambia solo l'interfaccia. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WA='https://wa.me/393208815899';
const MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GIORNI=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const dp=iso=>{const d=new Date(String(iso).slice(0,10)+'T12:00:00');return {d:d.getDate(),m:MESI[d.getMonth()],w:GIORNI[d.getDay()],y:d.getFullYear()}};
const dLong=iso=>{const p=dp(iso);return `${p.w} ${p.d} ${p.m} ${p.y}`};
const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
const hhmm=t=>t&&String(t).slice(0,5)!=='00:00'?String(t).slice(0,5):'';
const eur=v=>{const n=Number(v)||0;return '€ '+(Number.isInteger(n)?n:n.toFixed(2).replace('.',','))};
const nice=s=>{s=String(s||'').replace(/\s+/g,' ').trim().replace(/\s*\(\s*[A-Za-z]{2}\s*\)\s*$/,'').replace(/\s*[-–—]?\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\s*$/,'').replace(/\s*[—–]\s*BIS.*$/i,'');
  if(!/[a-zà-ù]/.test(s.replace(/\bG\.co\b/gi,'')))s=s.toLowerCase().replace(/(^|[\s'(&/-])([a-zà-ù])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(E|Di|De|Del|Della|In|A|Al|Alla|Da|Con|Per)\b/g,(w,_,i)=>i===0?w:w.toLowerCase()).replace(/\bG\.co\b/i,'G.co').replace(/\b(?!(?:Di|Da|De|Al|In|Lo|La|Le|Il)\b)([A-Z][a-z])\b/g,m=>m.toUpperCase());return s};
const tripName=t=>nice(t.titolo||t.destinazione||'Gita');
const runId=t=>String(t.active_viaggio_id||t.id);
const box=$('#book'),stepper=$('#stepper');

/* stesse piantine di riserva del gestionale, usate solo se la piantina ufficiale non arriva */
const REAL_LAYOUTS={
 GT53:{name:'GT53',total:53,rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'empty','empty','empty'],[33,34,'aisle',35,36],[37,38,'aisle',39,40],[41,42,'aisle',43,44],[45,46,'aisle',47,48],[49,50,51,52,53]]},
 GT63:{name:'GT63',total:63,rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'aisle',33,34],[35,36,'aisle',37,38],[39,40,'aisle',41,42],[43,44,'aisle',45,46],[47,48,'aisle',49,50],[51,52,'aisle',53,54],[55,56,'aisle',57,58],[59,60,61,62,63]]}
};
function layoutKey(bus,trip){
  const raw=String(bus?.seat_layout||bus?.bus?.seat_layout||bus?.modello||bus?.bus?.modello||bus?.targa||bus?.bus?.targa||'').toUpperCase();
  if(raw.includes('63')||raw.includes('FW125XE')||raw.includes('PB A')||raw.includes('PB B'))return 'GT63';
  if(raw.includes('53')||raw.includes('CENTURY')||raw.includes('FA013AN'))return 'GT53';
  return Number(trip?.posti_totali)>53?'GT63':'GT53';
}
/* righe della piantina: [{cells:[{type,id,label,status}]}] */
function normalize(bus,trip){
  if(bus&&Array.isArray(bus.layout)&&bus.layout.length)return bus.layout.map(r=>({cells:(Array.isArray(r.cells)?r.cells:[]).map(c=>c&&c.type==='seat'?{type:'seat',id:String(c.id??c.number??c.value??'').trim(),label:String(c.label||c.id||''),status:c.status||'available'}:{type:c&&c.type||'empty'})}));
  const tpl=REAL_LAYOUTS[layoutKey(bus,trip)];
  return tpl.rows.map(r=>({cells:r.map(c=>typeof c==='number'?{type:'seat',id:String(c),label:String(c),status:'available'}:{type:c})}));
}

const S={trips:[],trip:null,rows:[],booked:new Set(),sel:[],max:0,stops:[],step:1,form:{nome:'',cognome:'',telefono:'',email:'',note:'',fermata:''},token:0,busName:''};

function setStep(n){S.step=n;stepper.querySelectorAll('li').forEach(li=>{if(Number(li.dataset.s)<=n)li.dataset.on='';else delete li.dataset.on});window.scrollTo({top:0,behavior:'smooth'})}
function bar(html){let b=$('#bookBar');if(!html){if(b)b.remove();document.body.classList.remove('has-bar');return}if(!b){b=document.createElement('div');b.id='bookBar';b.className='bar';document.body.appendChild(b)}b.innerHTML=html;document.body.classList.add('has-bar')}
const tripHead=t=>`<div class="card" style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h2 style="font-size:1.35rem">${esc(tripName(t))}</h2><p class="muted" style="margin-top:4px">${esc(cap(dLong(t.data_partenza)))}${hhmm(t.ora_partenza)?' · ore '+hhmm(t.ora_partenza):''} · ${eur(t.prezzo)} a persona</p></div>${S.trips.length>1?'<button class="btn btn-chiaro btn-piccolo" type="button" data-a="change">Cambia gita</button>':''}</div>`;
function avail(t){return typeof gestTripAvailability==='function'?gestTripAvailability(t):{soldOut:false,known:false,free:0}}

/* ---------- passo 1a: scelta gita ---------- */
function viewPick(){
  setStep(1);bar('');
  const list=S.trips;
  box.innerHTML=`<h2 style="margin-bottom:14px">Quale gita?</h2><div class="trip-pick">${list.map(t=>{const a=avail(t),p=dp(t.data_partenza);return `<button type="button" class="ticket${a.soldOut?' sold':''}" data-trip="${esc(t.id)}" ${a.soldOut?'disabled':''} style="border:0;text-align:left;cursor:${a.soldOut?'not-allowed':'pointer'};font:inherit;width:100%">
   <div class="stub"><span class="d">${p.d}</span><span class="m">${p.m.slice(0,3)}</span><span class="w">${p.w.slice(0,3)}</span></div>
   <div class="tb"><span class="dest">${esc(tripName(t))}</span>${a.soldOut?'<span class="pill sold">Sold out</span>':a.known?`<span class="pill ${a.free<=5?'poco':'ok'}">${a.free} ${a.free===1?'posto libero':'posti liberi'}</span>`:''}<div class="row"><span class="price">${eur(t.prezzo)} <small>a persona</small></span><span class="go">${a.soldOut?'Al completo':'Scegli'}</span></div></div></button>`}).join('')||'<div class="empty">Al momento non ci sono gite prenotabili online.</div>'}</div>`;
}

/* ---------- passo 1b: posti ---------- */
async function loadTrip(t){
  const tok=++S.token;S.trip=t;S.sel=[];S.booked=new Set();S.rows=[];S.max=0;S.stops=[];
  setStep(1);bar('');
  box.innerHTML=tripHead(t)+'<div class="skeleton" style="height:420px;margin-top:16px"></div>';
  history.replaceState(null,'',`prenota.html?viaggio=${encodeURIComponent(t.id)}`);
  if(avail(t).soldOut){box.innerHTML=tripHead(t)+soldOutBox(t);return}
  try{
    const id=runId(t);
    const [stops,booked,bus]=await Promise.all([getTripStops(id).catch(()=>[]),getBookedSeats(id),getBusLayout(id)]);
    if(tok!==S.token)return;
    S.booked=new Set((booked||[]).map(String));
    S.rows=normalize(bus,t);
    const b=bus&&(bus.bus||bus);S.busName=[b&&b.marca,b&&b.modello].filter(Boolean).join(' ');
    let st=(stops||[]).map(x=>typeof x==='string'?x:String(x&&x.nome||'')).map(x=>x.trim()).filter(Boolean);
    if(!st.length)st=String(t.luogo_partenza||'').split(/\s*(?:\||;|,|\n|\/|•|\s+-\s+)\s*/).map(x=>x.trim()).filter(Boolean);
    S.stops=[...new Set(st)];
    const seats=seatList(),cap=Number(t.posti_totali||0);
    const mapFree=seats.filter(c=>usable(c,cap)&&!S.booked.has(c.id)).length;
    const inv=avail(t);S.max=Math.max(0,inv.known?Math.min(mapFree,inv.free):mapFree);
    if(S.max<=0){box.innerHTML=tripHead(t)+soldOutBox(t);return}
    viewSeats();
  }catch(e){
    console.error(e);if(tok!==S.token)return;
    box.innerHTML=tripHead(t)+`<div class="err" style="margin-top:16px">Non riesco a caricare la piantina in questo momento. <button class="btn btn-chiaro btn-piccolo" type="button" data-a="retry" style="margin-left:8px">Riprova</button></div><p class="muted" style="margin-top:12px">Puoi anche prenotare scrivendoci su <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a>.</p>`;
  }
}
const soldOutBox=t=>`<div class="card" style="margin-top:16px"><span class="pill sold">Sold out</span><h2 style="margin-top:10px">Questa gita è al completo</h2><p class="muted" style="margin-top:8px">Se si libera un posto ti avvisiamo: scrivici su WhatsApp.</p><p style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-wa" href="${WA}?text=${encodeURIComponent('Buongiorno, se si libera un posto per '+tripName(t)+' del '+dLong(t.data_partenza)+' vorrei essere avvisato.')}" target="_blank" rel="noopener">Avvisami su WhatsApp</a>${S.trips.length>1?'<button class="btn btn-chiaro" type="button" data-a="change">Scegli un’altra gita</button>':''}</p></div>`;
const seatList=()=>S.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat'&&c.id);
const usable=(c,cap)=>!['blocked','out_of_service'].includes(c.status)&&(!cap||Number(c.id)<=cap||isNaN(Number(c.id)));
function seatFree(c){return usable(c,Number(S.trip.posti_totali||0))&&!S.booked.has(c.id)}

/* scelta automatica: prima un gruppo vicino nella stessa fila, dal davanti verso il fondo */
function autoPick(n){
  const blocks=[];
  S.rows.forEach((r,ri)=>{let cur=[];r.cells.forEach(c=>{if(c.type==='seat'&&c.id){if(seatFree(c))cur.push(c.id);else{if(cur.length)blocks.push({ri,ids:cur});cur=[]}}else{if(cur.length)blocks.push({ri,ids:cur});cur=[]}});if(cur.length)blocks.push({ri,ids:cur})});
  const one=blocks.find(b=>b.ids.length>=n);if(one)return one.ids.slice(0,n);
  // due blocchi della stessa fila o file vicine
  const out=[];for(const b of blocks){for(const id of b.ids){if(out.length<n)out.push(id)}if(out.length>=n)break}
  return out;
}
function viewSeats(){
  setStep(1);
  const t=S.trip,maxCount=Math.min(S.max,8);
  const counts=Array.from({length:maxCount},(_,i)=>i+1);
  box.innerHTML=`<div class="book-grid"><div class="stack">${tripHead(t)}
   <div class="card stack">
    <div><h2 style="font-size:1.35rem">Quanti siete?</h2><p class="muted small" style="margin-top:4px">Scegliamo noi i posti vicini: puoi cambiarli toccando la piantina.${S.max>8?' Per più di 8 persone tocca i posti uno alla volta.':''}</p></div>
    <div class="count" role="group" aria-label="Numero di persone">${counts.map(n=>`<button type="button" data-n="${n}" aria-pressed="${S.sel.length===n}">${n}</button>`).join('')}</div>
   </div>
   <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><h2 style="font-size:1.35rem">Scegli i posti</h2><span class="muted small">${S.max} ${S.max===1?'posto libero':'posti liberi'}${S.busName?' · '+esc(S.busName):''}</span></div>
    <div class="legend"><span><i style="background:#E3F0E8"></i>Libero</span><span><i style="background:var(--oro)"></i>Il tuo</span><span><i style="background:#E6EAEF"></i>Occupato</span></div>
    <div class="bus" id="busMap">${busHtml()}</div>
   </div></div>
   <aside class="card summary stack" id="sumBox">${summaryHtml()}</aside></div>`;
  syncBar();
}
function busHtml(){
  const cap=Number(S.trip.posti_totali||0);
  return `<div class="bus-front"><span>Fronte del pullman</span><span style="display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M4.8 8.2 10 10.5M19.2 8.2 14 10.5M12 14v6.5"/></svg>Autista</span></div>`+
   S.rows.map(r=>`<div class="bus-row" style="grid-template-columns:repeat(${Math.max(r.cells.length,1)},1fr)">${r.cells.map(c=>{
     if(c.type!=='seat')return c.type==='door'?'<span class="door">porta</span>':'<span class="gap"></span>';
     const free=usable(c,cap)&&!S.booked.has(c.id),on=S.sel.includes(c.id);
     return `<button type="button" class="seat" data-seat="${esc(c.id)}" aria-pressed="${on}" ${free?'':'disabled'} aria-label="Posto ${esc(c.label||c.id)}${free?(on?', scelto':', libero'):', occupato'}">${esc(c.label||c.id)}</button>`}).join('')}</div>`).join('')+
   `<p class="muted small" style="text-align:center;margin-top:10px">Fondo del pullman</p>`;
}
const total=()=>Number(S.trip.prezzo||0)*S.sel.length;
function summaryHtml(){
  const n=S.sel.length;
  return `<h2 style="font-size:1.25rem">Riepilogo</h2>
   <div><div class="sum-line"><span>Posti</span><b>${n?S.sel.slice().sort((a,b)=>a-b).join(', '):'—'}</b></div><div class="sum-line"><span>Persone</span><b>${n}</b></div></div>
   <div class="sum-total">${eur(total())}</div>
   <button class="btn btn-oro btn-largo" type="button" data-a="toData" ${n?'':'disabled'}>Continua</button>
   <p class="muted small">Non paghi online: versi l’acconto in contanti entro 2 giorni.</p>`;
}
function syncBar(){
  const n=S.sel.length;
  bar(`<div class="info"><b>${n?n+(n===1?' posto':' posti')+' · '+eur(total()):'Scegli i posti'}</b><span>${n?'Posti '+S.sel.slice().sort((a,b)=>a-b).join(', '):'Tocca i posti liberi'}</span></div><button class="btn btn-oro" type="button" data-a="toData" ${n?'':'disabled'}>Continua</button>`);
}
function refreshSeats(){const m=$('#busMap');if(m)m.innerHTML=busHtml();const s=$('#sumBox');if(s)s.innerHTML=summaryHtml();document.querySelectorAll('.count [data-n]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.n)===S.sel.length)));syncBar()}
function toggleSeat(id){
  if(S.sel.includes(id))S.sel=S.sel.filter(x=>x!==id);
  else{if(S.sel.length>=S.max){toast(`Per questa gita puoi prenotare al massimo ${S.max} ${S.max===1?'posto':'posti'}.`);return}S.sel.push(id)}
  refreshSeats();
}
function toast(m){let t=$('#bookToast');if(!t){t=document.createElement('div');t.id='bookToast';t.setAttribute('role','alert');t.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:100px;z-index:60;background:var(--notte);color:#fff;padding:12px 16px;border-radius:12px;max-width:92vw;box-shadow:var(--ombra)';document.body.appendChild(t)}t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3800)}

/* ---------- passo 2: dati ---------- */
function viewData(){
  setStep(2);bar('');
  const f=S.form,t=S.trip;
  box.innerHTML=`<div class="book-grid"><div class="stack">${tripHead(t)}
   <form class="card form" id="dataForm" novalidate>
    <h2 style="font-size:1.35rem">I tuoi dati</h2>
    <div class="two"><label class="field">Nome<input name="nome" required autocomplete="given-name" value="${esc(f.nome)}"></label><label class="field">Cognome<input name="cognome" required autocomplete="family-name" value="${esc(f.cognome)}"></label></div>
    <label class="field">Telefono <small>ti chiamiamo solo per questa prenotazione</small><input name="telefono" type="tel" inputmode="tel" required autocomplete="tel" value="${esc(f.telefono)}"></label>
    <fieldset class="field" style="border:0;padding:0;margin:0"><legend style="margin-bottom:8px">Da dove sali?</legend>
     <div class="filters" style="flex-wrap:wrap;overflow:visible">${S.stops.map(s=>`<button class="chip" type="button" data-stop="${esc(s)}" aria-pressed="${f.fermata===s}">${esc(nice(s))}</button>`).join('')||'<span class="muted">Fermate da confermare con noi.</span>'}</div>
    </fieldset>
    <label class="field">E-mail <small>(facoltativa)</small><input name="email" type="email" autocomplete="email" value="${esc(f.email)}"></label>
    <label class="field">Note <small>(facoltative: esigenze, bambini, posti vicini…)</small><textarea name="note" rows="3">${esc(f.note)}</textarea></label>
    <p class="err" id="dataErr" hidden></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-chiaro" type="button" data-a="back1">Indietro</button><button class="btn btn-oro" type="submit" style="flex:1">Rivedi e conferma</button></div>
    <p class="muted small">I dati servono solo per gestire la prenotazione.</p>
   </form></div>
   <aside class="card summary stack">${miniSum()}</aside></div>`;
}
const miniSum=()=>`<h2 style="font-size:1.25rem">Riepilogo</h2><div><div class="sum-line"><span>Posti</span><b>${S.sel.slice().sort((a,b)=>a-b).join(', ')}</b></div><div class="sum-line"><span>Persone</span><b>${S.sel.length}</b></div>${S.form.fermata?`<div class="sum-line"><span>Fermata</span><b>${esc(nice(S.form.fermata))}</b></div>`:''}</div><div class="sum-total">${eur(total())}</div>`;
function readForm(){const fm=$('#dataForm');if(!fm)return;const d=new FormData(fm);['nome','cognome','telefono','email','note'].forEach(k=>S.form[k]=String(d.get(k)||'').trim())}
function checkData(){
  readForm();const f=S.form,err=$('#dataErr');
  const bad=!f.nome?'Scrivi il nome.':!f.cognome?'Scrivi il cognome.':String(f.telefono).replace(/\D/g,'').length<9?'Scrivi un numero di telefono valido.':!f.fermata&&S.stops.length?'Scegli la fermata da cui sali.':f.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)?'L’e-mail non sembra corretta (puoi anche lasciarla vuota).':'';
  if(bad){err.textContent=bad;err.hidden=false;err.scrollIntoView({block:'center',behavior:'smooth'});return false}
  if(!f.fermata)f.fermata='Da confermare';return true;
}

/* ---------- passo 3: conferma ---------- */
function contacts(){return window.DGReceipt&&DGReceipt.stopContacts?DGReceipt.stopContacts(S.form.fermata):[{nome:'Raffaele DELGROSSO',tel:'320 573 0466'},{nome:'Nicola',tel:'366 212 7916'}]}
function viewConfirm(){
  setStep(3);bar('');
  const t=S.trip,f=S.form;
  box.innerHTML=`<div class="card stack" style="max-width:720px">
   <h2>Controlla e conferma</h2>
   <div>
    <div class="sum-line"><span>Gita</span><b>${esc(tripName(t))}</b></div>
    <div class="sum-line"><span>Data</span><b>${esc(cap(dLong(t.data_partenza)))}${hhmm(t.ora_partenza)?' · ore '+hhmm(t.ora_partenza):''}</b></div>
    <div class="sum-line"><span>Fermata</span><b>${esc(nice(f.fermata))}</b></div>
    <div class="sum-line"><span>Posti</span><b>${S.sel.slice().sort((a,b)=>a-b).join(', ')}</b></div>
    <div class="sum-line"><span>Nome</span><b>${esc(f.nome+' '+f.cognome)}</b></div>
    <div class="sum-line"><span>Telefono</span><b>${esc(f.telefono)}</b></div>
   </div>
   <div class="sum-total">${eur(total())} <small class="muted" style="font:500 .95rem var(--f-ui)">totale</small></div>
   <div class="note-box"><b>Acconto entro 2 giorni.</b> Trascorsi 2 giorni dalla prenotazione, se i posti non sono stati bloccati con un acconto, verranno svincolati immediatamente. L’acconto si versa in contanti a ${contacts().map(c=>`<b>${esc(c.nome)}</b> (${esc(c.tel)})`).join(' o ')}.</div>
   <p class="err" id="sendErr" hidden></p>
   <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-chiaro" type="button" data-a="back2">Modifica</button><button class="btn btn-oro" type="button" data-a="send" id="sendBtn" style="flex:1">Conferma la prenotazione</button></div>
  </div>`;
}
let sending=false;
async function send(){
  if(sending)return;sending=true;
  const btn=$('#sendBtn'),err=$('#sendErr'),t=S.trip,f=S.form,seats=S.sel.slice(),id=runId(t);
  btn.disabled=true;btn.textContent='Verifico i posti…';err.hidden=true;
  let requested=false;
  try{
    const latest=new Set((await getBookedSeats(id)).map(String));
    const taken=seats.filter(s=>latest.has(String(s)));
    if(taken.length){S.booked=latest;S.sel=S.sel.filter(s=>!latest.has(s));sending=false;
      viewSeats();toast(`${taken.length===1?'Il posto '+taken[0]+' è stato appena preso':'I posti '+taken.join(', ')+' sono stati appena presi'} da un’altra persona: scegline un altro.`);return}
    btn.textContent='Registro la prenotazione…';requested=true;
    const result=await createGestionaleBooking({viaggioId:id,nome:f.nome,cognome:f.cognome,telefono:f.telefono,email:f.email||null,note:f.note,posti:seats,fermataPartenza:f.fermata});
    if(!result||!result.success){requested=false;throw new Error((result&&result.error)||'Prenotazione non accettata')}
    done(result,t,seats);
  }catch(e){
    console.error(e);sending=false;
    if(requested&&/fetch|network|rete|tempo|collegamento/i.test(String(e&&e.message||''))){
      err.innerHTML=`Il collegamento si è interrotto e non sappiamo se la prenotazione è arrivata. <b>Non riprovare</b>: scrivici su <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a> con nome e posti, controlliamo subito.`;
      btn.textContent='Esito da verificare';
    }else{err.textContent=(e&&e.message)||'Non è stato possibile completare la prenotazione. Riprova.';btn.disabled=false;btn.textContent='Conferma la prenotazione'}
    err.hidden=false;
  }
}

/* ---------- fatto: codice, PDF, acconto ---------- */
async function done(result,t,seats){
  bar('');setStep(3);
  const posti=(result.posti||seats).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  const tot=Number.isFinite(Number(result.totale))&&Number(result.totale)>=0?Number(result.totale):Number(t.prezzo||0)*posti.length;
  const code=String(result.numero||result.confirmationNumber||result.id_prenotazione||result.codice||'');
  const data={riferimento:code,viaggio:t.titolo||t.destinazione||'Viaggio',data:typeof gestFmtDate==='function'?gestFmtDate(t.data_partenza):dLong(t.data_partenza),ora:hhmm(t.ora_partenza),nome:S.form.nome,cognome:S.form.cognome,telefono:S.form.telefono,fermataPartenza:S.form.fermata,numeroPosti:posti.length,posti,prezzo:posti.length?tot/posti.length:0,totale:tot};
  box.innerHTML=`<div class="card stack" style="max-width:720px">
   <div class="ok-box"><b>Prenotazione registrata.</b> I posti ${esc(posti.join(', '))} sono riservati per te.</div>
   <div><span class="muted small">Codice prenotazione</span><div class="done-code">${esc(code||'—')}</div></div>
   <a class="btn btn-oro" id="pdfBtn" aria-disabled="true">Preparo la conferma in PDF…</a>
   <p class="muted small" id="pdfStatus" role="status"></p>
   <div class="note-box"><b>Ora manca solo l’acconto.</b> Versalo in contanti entro 2 giorni dalla prenotazione. Trascorsi 2 giorni, se i posti non sono stati bloccati con un acconto, verranno svincolati immediatamente.</div>
   <div class="people">${contacts().map(c=>`<a class="person" style="background:var(--notte)" href="tel:+39${esc(c.tel.replace(/\s+/g,''))}"><b>${esc(c.nome)}</b><span class="tel">${esc(c.tel)}</span><span>Tocca per chiamare</span></a>`).join('')}</div>
   <p style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-chiaro" href="viaggi.html">Torna alle partenze</a><a class="btn btn-wa" href="${WA}?text=${encodeURIComponent('Buongiorno, ho prenotato online. Codice '+code+', posti '+posti.join(', ')+'.')}" target="_blank" rel="noopener">Scrivici su WhatsApp</a></p>
  </div>`;
  const pdfBtn=$('#pdfBtn'),st=$('#pdfStatus');
  let blob=null;
  try{blob=await DGReceipt.generate(data);const url=URL.createObjectURL(blob);pdfBtn.href=url;pdfBtn.download='conferma-'+(code||'prenotazione')+'.pdf';pdfBtn.removeAttribute('aria-disabled');pdfBtn.textContent='Scarica la conferma in PDF';st.textContent='Salva il PDF: è la tua conferma di prenotazione.'}
  catch(e){console.error(e);pdfBtn.textContent='PDF non disponibile';st.textContent='La prenotazione è salvata. Per il PDF contattaci indicando il codice.'}
  if(blob)archive(result,blob,st);
}
async function archive(result,blob,st){
  const bookingId=String(result.id||'').trim(),token=String(result.token||'').trim();
  if(!bookingId||!token)return;
  const raw=new Uint8Array(await blob.arrayBuffer());let enc='';for(let i=0;i<raw.length;i+=8192)enc+=String.fromCharCode(...raw.subarray(i,i+8192));
  const tryOnce=async()=>{
    try{const r=await gestBridge('archive-booking',{bookingId,token,pdfBase64:btoa(enc)});if(r&&r.success)return true;throw new Error(r&&r.error||'')}
    catch(e){try{const ex=await gestBridge('booking-pdf-url',{bookingId,token});if(ex&&ex.success&&ex.signedUrl)return true}catch{}throw e}
  };
  try{await tryOnce()}catch(e){
    console.warn('Archiviazione conferma',e);
    const b=document.createElement('button');b.type='button';b.className='btn btn-chiaro btn-piccolo';b.textContent='Riprova a salvare la conferma';
    st.after(b);st.textContent='La prenotazione è registrata; il salvataggio della copia online non è riuscito.';
    b.onclick=async()=>{b.disabled=true;try{await tryOnce();b.remove();st.textContent='Copia della conferma salvata.'}catch{b.disabled=false}};
  }
}

/* ---------- eventi ---------- */
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-a],[data-trip],[data-n],[data-seat],[data-stop]');if(!a||a.disabled)return;
  if(a.dataset.trip){const t=S.trips.find(x=>String(x.id)===a.dataset.trip);if(t)loadTrip(t);return}
  if(a.dataset.n){S.sel=autoPick(Number(a.dataset.n));refreshSeats();return}
  if(a.dataset.seat){toggleSeat(a.dataset.seat);return}
  if(a.dataset.stop){readForm();S.form.fermata=a.dataset.stop;document.querySelectorAll('[data-stop]').forEach(b=>b.setAttribute('aria-pressed',String(b===a)));const s=document.querySelector('aside.summary');if(s)s.innerHTML=miniSum();return}
  switch(a.dataset.a){
    case 'change':S.token++;viewPick();break;
    case 'retry':loadTrip(S.trip);break;
    case 'toData':if(S.sel.length)viewData();break;
    case 'back1':readForm();viewSeats();break;
    case 'back2':viewData();break;
    case 'send':send();break;
  }
});
document.addEventListener('input',e=>{if(e.target.closest('#dataForm')){const er=$('#dataErr');if(er)er.hidden=true}});
document.addEventListener('submit',e=>{if(e.target.id==='dataForm'){e.preventDefault();if(checkData())viewConfirm()}});

(async()=>{
  try{
    const all=await getGestionaleTrips();
    S.trips=all.slice().sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));
    if(window.__dgOfflineCatalog){box.innerHTML=`<div class="card"><h2>Prenotazione online momentaneamente non disponibile</h2><p class="muted" style="margin-top:8px">Stiamo aggiornando il collegamento con le partenze. Prenota scrivendoci su <a href="${WA}" target="_blank" rel="noopener">WhatsApp al 320 881 5899</a>.</p></div>`;return}
    const q=new URLSearchParams(location.search).get('viaggio'),t=q&&S.trips.find(x=>String(x.id)===q);
    if(t)loadTrip(t);else viewPick();
  }catch(e){console.error(e);box.innerHTML=`<div class="err">Non riesco a caricare le partenze. Riprova tra poco oppure prenota su <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a>.</div>`}
})();
})();
