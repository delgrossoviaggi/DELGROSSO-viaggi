/* DELGROSSO Business Suite V10 — Scheda cliente
 * Customer records/booking summaries are read after login from RLS-protected Supabase.
 * No personal information is stored in localStorage, sessionStorage, or URLs.
 * PDFs are opened via short-lived signed links from private Storage buckets.
 */
(function(){'use strict';
const $=id=>document.getElementById(id);
const todayRome=()=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`};
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>{const v=Number(x);return Number.isFinite(v)?v:0};
const eur=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n(x));
const fmtDate=s=>{const v=String(s||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'—'};
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const nameKey=x=>norm(x).split(' ').filter(Boolean).sort().join(' ');
function phoneKey(x){let v=String(x??'').replace(/\D/g,'');if(v.startsWith('0039')&&v.length===14)v=v.slice(4);else if(v.startsWith('39')&&v.length===12)v=v.slice(2);return v;}
const cancelled=x=>/annull|cancell|storn|rimbors/i.test(String(x?.stato||''));
const refunded=x=>/rimbor|storn/i.test(String(x?.tipo||''));
const paymentCancelled=x=>/annull|cancell|rifiut|fallit|storn/i.test(String(x?.stato||''));
const bookingName=b=>String(b?.cliente||b?.cliente_nome||'').trim();
const clientName=c=>[c?.nome,c?.cognome].filter(Boolean).join(' ').trim();
const auth=()=>typeof authSession!=='undefined'&&Boolean(authSession?.access_token);
const dataset={clients:[],bookings:[],payments:[],trips:[],versions:[],documents:[]};
let loadedAt=0,loading=false,failedOptional=[],groups=[],selected=-1,pendingClientId='',query='',docs=[];
const PAGE_SIZE=450;
function status(s,isErr=false){const el=$('dg10Status');if(el){el.textContent=s;el.classList.toggle('dg10-error',Boolean(isErr));}}
function recordsSafe(){return auth()&&loadedAt>0;}
function clearSensitive(){for(const key of Object.keys(dataset))dataset[key]=[];loadedAt=0;groups=[];selected=-1;pendingClientId='';docs=[];query='';if($('dg10Search'))$('dg10Search').value='';if($('dg10Results'))$('dg10Results').innerHTML='<p class="dg10-muted">Accedi per consultare la scheda cliente.</p>';if($('dg10Detail'))$('dg10Detail').innerHTML='';status('Accesso richiesto.');}
async function fetchAll(table){
 const arr=[];
 for(let step=0;step<150;step++){
  if(!auth())throw Error('Sessione non disponibile');
  const offset=step*PAGE_SIZE;
  const batch=await api(table,'select=*&order=id.asc&limit='+PAGE_SIZE+'&offset='+offset,{noCache:true});
  if(!Array.isArray(batch))throw Error('Risposta non valida per '+table);
  arr.push(...batch);
  if(batch.length<PAGE_SIZE)return arr;
 }
 throw Error('Troppe righe nella tabella '+table+': dati non completi.');
}
// A phone + the person's name form one identity; shared family phones do not merge people.
// If a booking has no phone, link it to an identified person only when that name is unique.
function makeGroups(clients,bookings){
 const m=new Map();
 const add=(name,phone,email,client,booking)=>{
  const nk=nameKey(name),pk=phoneKey(phone);
  if(!nk)return;
  const key=pk?'p:'+pk+'|'+nk:'n:'+nk;
  if(!m.has(key))m.set(key,{key,name,phone:phone||'',email:email||'',nameKey:nk,phoneKey:pk,clientIds:new Set(),bookings:[],clients:[]});
  const g=m.get(key);
  if(client){g.clientIds.add(client.id);g.clients.push(client);if(!g.phone)g.phone=client.telefono||'';if(!g.email)g.email=client.email||'';}
  if(booking){g.bookings.push(booking);if(!g.phone)g.phone=booking.telefono||'';if(!g.email)g.email=booking.email||'';}
 };
 (clients||[]).forEach(c=>add(clientName(c),c.telefono,c.email,c,null));
 (bookings||[]).filter(b=>!b.riserva_aziendale).forEach(b=>add(bookingName(b),b.telefono,b.email,null,b));
 // Unambiguous, phone-less names may be attached to one phone-identified customer.
 for(const [key,g] of [...m.entries()]){
  if(!key.startsWith('n:'))continue;
  const possibilities=[...m.values()].filter(x=>x!==g&&x.phoneKey&&x.nameKey===g.nameKey);
  if(possibilities.length===1){const p=possibilities[0];g.clients.forEach(c=>{p.clients.push(c);p.clientIds.add(c.id)});p.bookings.push(...g.bookings);m.delete(key);}
 }
 return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
}
function groupMatches(g,search){const s=norm(search),digits=phoneKey(search);
 if(!s&&!digits)return false;
 return norm([g.name,g.email,...g.clients.map(c=>c.codice_cliente||'')].join(' ')).includes(s) || Boolean(digits&&digits.length>=3&&g.phoneKey.includes(digits)) || g.bookings.some(b=>norm(b.codice||'').includes(s));
}
function assignPayments(g,payments){
 const groupBookIds=new Set(g.bookings.map(b=>b.id));const byTrip=new Map();g.bookings.forEach(b=>byTrip.set(b.viaggio_id,[...(byTrip.get(b.viaggio_id)||[]),b]));
 const linked=new Map(g.bookings.map(b=>[b.id,[]])),unlinked=[];
 (payments||[]).forEach(p=>{
  if(p.prenotazione_id){if(groupBookIds.has(p.prenotazione_id))linked.get(p.prenotazione_id).push(p);return;}
  // Previous, unlinked records can only be assigned when the client UUID and trip match uniquely.
  if(p.cliente_id&&g.clientIds.has(p.cliente_id)&&p.viaggio_id&&byTrip.get(p.viaggio_id)?.length===1){linked.get(byTrip.get(p.viaggio_id)[0].id).push(p);return;}
  if(p.cliente_id&&g.clientIds.has(p.cliente_id))unlinked.push(p);
 });
 return {linked,unlinked};
}
function paymentTotal(book,rows){const valid=rows.filter(p=>!paymentCancelled(p));
 if(valid.length){return {amount:Math.max(0,valid.reduce((v,p)=>v+(refunded(p)?-Math.abs(n(p.importo)):n(p.importo)),0)),source:'Movimenti registrati',count:valid.length};}
 return {amount:Math.max(0,n(book.pagato)),source:'Totale riportato nella prenotazione',count:0};
}
function report(g,allPayments,trips){const idx=new Map(trips.map(t=>[t.id,t]));const {linked,unlinked}=assignPayments(g,allPayments);const rows=g.bookings.map(b=>{
 const payments=(linked.get(b.id)||[]).slice().sort((a,z)=>String(a.data_pagamento||a.created_at||'').localeCompare(String(z.data_pagamento||z.created_at||'')));
 const p=paymentTotal(b,payments),total=Math.max(0,n(b.totale)),balance=Math.max(0,total-p.amount);
 const t=idx.get(b.viaggio_id)||null;
 return {b,trip:t,payments,total,paid:p.amount,balance,paidSource:p.source,movements:p.count,canceled:cancelled(b),date:String(t?.data_partenza||'').slice(0,10)};
 }).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const active=rows.filter(r=>!r.canceled);
 return {rows,unlinked,total:active.reduce((s,r)=>s+r.total,0),paid:active.reduce((s,r)=>s+r.paid,0),balance:active.reduce((s,r)=>s+r.balance,0),future:active.filter(r=>r.date&&r.date>=todayRome()),past:rows.filter(r=>r.canceled||!r.date||r.date<todayRome())};
}
async function refresh(){if(loading)return;if(!auth()){clearSensitive();return;}
 loading=true;const b=$('dg10Refresh');if(b)b.disabled=true;status('Sincronizzazione schede clienti, prenotazioni, pagamenti e ricevute da Supabase…');
 const previousKey=groups[selected]?.key||'';
 const spec=[['clients','clienti',true],['bookings','prenotazioni',true],['payments','pagamenti',true],['trips','viaggi',true],['versions','ricevute_versioni',false],['documents','documenti_gestionali',false]];
 const results=await Promise.allSettled(spec.map(s=>fetchAll(s[1])));
 try{
  const errors=[];failedOptional=[];
  results.forEach((r,i)=>{if(r.status==='rejected'){if(spec[i][2])errors.push(spec[i][1]+': '+String(r.reason?.message||r.reason));else failedOptional.push(spec[i][1]);}});
  if(errors.length)throw Error('Lettura dati incompleta. Non è possibile calcolare saldi attendibili. '+errors.join(' | '));
  results.forEach((r,i)=>{dataset[spec[i][0]]=r.status==='fulfilled'?r.value:[]});
  loadedAt=Date.now();groups=makeGroups(dataset.clients,dataset.bookings);
  status('Dati aggiornati: '+groups.length+' schede, '+dataset.bookings.length+' prenotazioni, '+dataset.payments.length+' movimenti.'+(failedOptional.length?' Attenzione: archivio '+failedOptional.join(', ')+' non leggibile.':''));
  drawResults();
  if(pendingClientId){const idx=groups.findIndex(g=>g.clientIds.has(pendingClientId));selected=idx;if(idx>=0&&$('dg10Search')){$('dg10Search').value=groups[idx].name;query=groups[idx].name;}pendingClientId='';}
  else selected=previousKey?groups.findIndex(g=>g.key===previousKey):-1;
  drawDetail();
 }catch(e){loadedAt=0;groups=[];selected=-1;drawResults();drawDetail();status('⚠ '+String(e.message||e),true);}
 finally{loading=false;if(b)b.disabled=false;}
}
function drawResults(){const target=$('dg10Results');if(!target)return;
 if(!recordsSafe()){target.innerHTML='<p class="dg10-muted">'+(loading?'Caricamento in corso…':'Non ci sono dati completi. Premi Aggiorna dati.')+'</p>';return;}
 const q=String($('dg10Search')?.value||query).trim();query=q;
 const list=q.length>=2?groups.map((g,i)=>({...g,i})).filter(g=>groupMatches(g,q)):[];
 $('dg10Count').textContent=q.length<2?'—':list.length+' nominativi';
 if(q.length<2){target.innerHTML='<p class="dg10-muted">Scrivi almeno due caratteri per cercare. I recapiti non vengono mostrati finché non scegli di cercare un cliente.</p>';return;}
 if(!list.length){target.innerHTML='<p class="dg10-muted">Nessun cliente trovato con questa ricerca. Controlla il nominativo o il numero.</p>';return;}
 target.innerHTML=list.slice(0,90).map(g=>`<button type="button" class="dg10-person ${g.i===selected?'selected':''}" onclick="dg10Select(${g.i})" aria-pressed="${g.i===selected}"><strong>${h(g.name)}</strong><small>${h(g.phone||'Senza telefono')} ${g.email?'· '+h(g.email):''}</small><span>${g.bookings.length} prenotazion${g.bookings.length===1?'e':'i'} · ${g.clients.length?'anagrafica collegata':'da prenotazioni'}</span></button>`).join('')+(list.length>90?'<p class="dg10-muted">Affina la ricerca per visualizzare gli altri risultati.</p>':'');
}
function docButton(title,bucket,path,icon='📄'){
 if(!path)return '';
 const id=docs.push({title,bucket,path})-1;
 return `<div class="dg10-doc"><span>${icon} ${h(title)}</span><div><button type="button" class="btn btn-secondary btn-sm" onclick="dg10OpenDoc(${id})">Apri PDF</button> <button type="button" class="btn btn-secondary btn-sm" onclick="dg10ShareDoc(${id})">Condividi / Salva</button></div></div>`;
}
function versionsForPayment(p){const list=dataset.versions.filter(v=>v.payment_id===p.id&&!v.invalidated_at).slice().sort((a,b)=>String(b.generated_at||b.created_at||'').localeCompare(String(a.generated_at||a.created_at||'')));
 const current=new Set([p.receipt_professional_path,p.receipt_storage_path].filter(Boolean));
 return list.filter(v=>v.storage_path&&!current.has(v.storage_path)).slice(0,10);
}
function statusTag(r){if(r.canceled)return '<span class="dg10-pill danger">Annullata</span>';
 if(r.total<=.01)return '<span class="dg10-pill">Da verificare</span>';
 if(r.balance<=.01)return '<span class="dg10-pill ok">Saldo pagato</span>';
 if(r.paid>.01)return '<span class="dg10-pill warn">Acconto versato · Saldo da pagare</span>';
 return '<span class="dg10-pill danger">Nessun pagamento registrato</span>';
}
function makeBooking(r){const t=r.trip,b=r.b;let attachments='';
 if(b.confirmation_storage_path)attachments+=docButton('Conferma prenotazione · '+(b.confirmation_number||b.codice||'PDF'),'ricevute-prenotazioni',b.confirmation_storage_path,'📋');
 for(const p of r.payments){const kind=refunded(p)?'Rimborso':/saldo/i.test(String(p.tipo||''))?'Saldo':/accont/i.test(String(p.tipo||''))?'Acconto':'Pagamento';
  const main=p.receipt_professional_path||p.receipt_storage_path;
  if(main)attachments+=docButton('Ricevuta '+kind+' · '+fmtDate(p.data_pagamento||p.created_at)+' · '+eur(Math.abs(n(p.importo))),'ricevute-prenotazioni',main,'🧾');
  versionsForPayment(p).forEach((v,i)=>{attachments+=docButton('Versione precedente '+(i+1)+' · '+fmtDate(v.generated_at||v.created_at),'ricevute-prenotazioni',v.storage_path,'📁')});
 }
 const movements=r.payments.length?`<div class="dg10-movements"><b>Movimenti di pagamento</b>${r.payments.map(p=>`<div class="dg10-movement"><span>${h(fmtDate(p.data_pagamento||p.created_at))} · ${h(p.tipo||'Pagamento')}${paymentCancelled(p)?' · ANNULLATO (non conteggiato)':''} · ${h(p.incassato_da||'Operatore non indicato')}${p.metodo_pagamento||p.metodo?' · '+h(p.metodo_pagamento||p.metodo):''}</span><b>${refunded(p)?'−':''}${eur(Math.abs(n(p.importo)))}</b></div>`).join('')}</div>`:'';
 const date=t?.data_partenza||'';
 const when=r.canceled?'Prenotazione annullata':String(date).slice(0,10)>=todayRome()?'Da effettuare':'Passato / storico';
 return `<article class="dg10-trip"><div class="dg10-trip-head"><div><small>${h(fmtDate(date))} · ${h(t?.ora_partenza||'')} · ${h(when)}</small><h4>${h(t?.titolo||t?.destinazione||'Viaggio non presente')}</h4><span class="dg10-sub">${h(t?.destinazione||'')} ${t?.archiviato_at?' · Viaggio archiviato':''}</span></div>${statusTag(r)}</div>
 <div class="dg10-meta"><span>Codice <strong>${h(b.codice||b.id?.slice(0,8))}</strong></span><span>Persone <strong>${Math.max(0,n(b.posti))}</strong></span><span>Posti <strong>${h(b.posti_selezionati||'—')}</strong></span><span>Fermata <strong>${h(b.fermata_partenza||'—')}</strong></span></div>
 <div class="dg10-totals"><div><small>Totale prenotazione</small><b>${eur(r.total)}</b></div><div><small>Versato</small><b>${eur(r.paid)}</b></div><div><small>Saldo residuo</small><b class="${r.balance>.01?'dg10-red':''}">${eur(r.balance)}</b></div></div><p class="dg10-note">Fonte del versato: ${h(r.paidSource)}${r.payments.some(p=>paymentCancelled(p))?' · Presente almeno un movimento annullato':''}.</p>
 ${movements}<div class="dg10-docs"><b>Documenti e ricevute</b>${attachments||'<p class="dg10-muted">Nessun PDF archiviato per questa prenotazione. Per generarne uno, apri Prenotazioni o Centro Ricevute.</p>'}</div></article>`;
}
function drawDetail(){const out=$('dg10Detail');if(!out)return;docs=[];
 if(!recordsSafe()||selected<0||!groups[selected]){out.innerHTML='<div class="card"><div class="card-body dg10-muted">Seleziona un cliente nei risultati per vedere tutti i suoi viaggi e le ricevute.</div></div>';return;}
 const g=groups[selected],r=report(g,dataset.payments,dataset.trips);
 const sums=`<div class="dg10-totals dg10-grand"><div><small>Totale viaggi</small><b>${eur(r.total)}</b></div><div><small>Totale versato</small><b>${eur(r.paid)}</b></div><div><small>Ancora da saldare</small><b class="${r.balance>.01?'dg10-red':''}">${eur(r.balance)}</b></div></div>`;
 const upcoming=r.future.slice().sort((a,b)=>a.date.localeCompare(b.date));
 const past=r.past.slice().sort((a,b)=>b.date.localeCompare(a.date));
 let standalone='';for(const p of r.unlinked){const path=p.receipt_professional_path||p.receipt_storage_path;if(path)standalone+=docButton('Movimento senza prenotazione · '+eur(Math.abs(n(p.importo))),'ricevute-prenotazioni',path,'🧾');}
 const relatedDocs=dataset.documents.filter(d=>g.clientIds.has(d.cliente_id)&&d.storage_path&&['gestionale-documenti','ricevute-prenotazioni'].includes(d.storage_bucket)).map(d=>docButton(d.titolo||'Documento cliente',d.storage_bucket,d.storage_path,'📎')).join('');
 const extra=standalone||relatedDocs?`<div class="card"><div class="card-head"><h3>Altri allegati del cliente</h3></div><div class="card-body">${standalone}${relatedDocs}</div></div>`:'';
 out.innerHTML=`<div class="card dg10-ident"><div class="card-body"><div class="dg10-ident-head"><div><small>SCHEDA CLIENTE · DELGROSSO VIAGGI</small><h3>${h(g.name)}</h3><p>${h(g.phone||'Telefono non registrato')} ${g.email?' · '+h(g.email):''}</p></div><span class="dg10-pill">${r.rows.length} prenotazioni</span></div><p class="dg10-note">I movimenti vengono collegati tramite ID prenotazione; per vecchi pagamenti senza ID è richiesto l’abbinamento univoco di cliente e viaggio. Omonimi con telefoni diversi restano separati.</p></div></div>
 ${sums}${r.unlinked.length?`<div class="dg10-warning">⚠ ${r.unlinked.length} movimento/i attribuiti all'anagrafica ma non associabili con certezza a una prenotazione: non sono inclusi nei totali qui sopra. Verifica in Pagamenti/Cassa.</div>`:''}
 <section class="dg10-section"><h3>🚌 Prossimi viaggi (${upcoming.length})</h3>${upcoming.length?upcoming.map(makeBooking).join(''):'<div class="card"><div class="card-body dg10-muted">Nessun viaggio futuro registrato per questo cliente.</div></div>'}</section>
 <section class="dg10-section"><h3>📂 Storico viaggi e prenotazioni (${past.length})</h3>${past.length?past.map(makeBooking).join(''):'<div class="card"><div class="card-body dg10-muted">Nessun viaggio precedente registrato.</div></div>'}</section>${extra}
 ${failedOptional.length?'<p class="dg10-warning">Alcune versioni storiche dei PDF o documenti aggiuntivi non sono consultabili con i permessi attuali. I PDF disponibili direttamente nelle prenotazioni e nei pagamenti sono elencati sopra.</p>':''}`;
 drawResults();
}
async function signedUrl(doc){if(!auth())throw Error('Effettua il login.');if(!doc||!['ricevute-prenotazioni','gestionale-documenti'].includes(doc.bucket))throw Error('Archivio non autorizzato');
 const path=String(doc.path||'');if(!path||path.startsWith('/')||path.split('/').some(x=>x==='..'||!x))throw Error('Percorso documento non valido.');
 const href=SUPA_URL+'/storage/v1/object/sign/'+encodeURIComponent(doc.bucket)+'/'+path.split('/').map(encodeURIComponent).join('/');
 async function send(){const r=await fetch(href,{method:'POST',cache:'no-store',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+authSession.access_token,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});return r;}
 let response=await send();if(response.status===401&&typeof refreshAuth==='function'&&await refreshAuth())response=await send();
 const body=await response.json().catch(()=>({}));if(!response.ok)throw Error('Documento non accessibile ('+response.status+'): '+String(body.message||body.error||'verifica i permessi Storage'));
 const url=body.signedURL||body.signedUrl||body.url;
 if(!url)throw Error('Link protetto non restituito dall’archivio.');
 return /^https:\/\//i.test(url)?url:(String(url).startsWith('/storage/v1/')?SUPA_URL+url:SUPA_URL+'/storage/v1'+(String(url).startsWith('/')?'':'/')+url);
}
async function openDoc(id){const d=docs[id];if(!d){status('Documento non disponibile.',true);return;}
 const desktop=!(window.matchMedia?.('(max-width:820px)').matches);const win=desktop?window.open('about:blank','_blank'):null;
 try{status('Apertura documento protetto: '+d.title+'…');const url=await signedUrl(d);
  if(win&&!win.closed){win.location.replace(url);}else if(typeof window.dgOpenDocumentURL==='function'){await window.dgOpenDocumentURL(url,d.title);}else window.open(url,'_blank','noopener');
  status('PDF pronto. Su iPhone usa Condividi o Salva su File.');
 }catch(e){try{win?.close()}catch{}status('⚠ '+e.message,true);}
}
async function shareDoc(id){const d=docs[id];if(!d){status('Documento non disponibile.',true);return;}
 try{status('Preparazione del documento per iPhone/Android…');const url=await signedUrl(d);const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Impossibile scaricare PDF ('+r.status+')');const blob=await r.blob();
  const file=new File([blob],'DELGROSSO_'+String(d.title||'ricevuta').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,64)+'.pdf',{type:blob.type||'application/pdf'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Documento DELGROSSO'});status('Documento condiviso o salvato dal dispositivo.');return;}catch(e){if(e.name==='AbortError'){status('Condivisione annullata.');return;}}}
  // On desktop, download; on iOS Safari, viewer has Open External and Share > Save to Files.
  if(window.matchMedia?.('(max-width:820px)').matches&&typeof window.dgOpenDocumentURL==='function'){await window.dgOpenDocumentURL(url,d.title);status('PDF aperto: usa Condividi → Salva su File.');return;}
  const objectUrl=URL.createObjectURL(file),a=document.createElement('a');a.href=objectUrl;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);status('Download PDF avviato.');
 }catch(e){status('⚠ '+String(e.message||e),true);}
}
function select(i){if(!recordsSafe()||!groups[i])return;selected=i;drawDetail();$('dg10Detail')?.scrollIntoView({behavior:'smooth',block:'start'});}
function openForClient(id){if(!id)return;pendingClientId=id;if(typeof window.go==='function')window.go('scheda-cliente');if(recordsSafe()){const ix=groups.findIndex(g=>g.clientIds.has(id));if(ix>=0){selected=ix;const g=groups[ix];const input=$('dg10Search');if(input){input.value=g.name;query=g.name;}drawDetail();}}}
function render(){if(!$('dg10Detail'))return;if(!auth()){clearSensitive();return;}if(!recordsSafe()){if(!loading)refresh();return;}drawResults();drawDetail();}
function init(){const input=$('dg10Search');if(!input)return;
 input.addEventListener('input',()=>{selected=-1;query=input.value;drawResults();drawDetail();});
 const app=$('app');if(app){new MutationObserver(()=>{if(!app.classList.contains('on'))clearSensitive()}).observe(app,{attributes:true,attributeFilter:['class']});}
 // Page can be the initial hash after reloading in an authenticated tab.
 if(location.hash==='#scheda-cliente'&&auth())render();
}
window.dg10Render=render;window.dg10Refresh=refresh;window.dg10Select=select;window.dg10OpenForClient=openForClient;window.dg10OpenDoc=openDoc;window.dg10ShareDoc=shareDoc;
window.DG10Test={makeGroups,groupMatches,assignPayments,paymentTotal,report,phoneKey};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
