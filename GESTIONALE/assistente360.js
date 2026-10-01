/* DELGROSSO Assistente 360 V6 - estensione non distruttiva */
(function(){
'use strict';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const esc360=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const activeBookings=()=> (state.prenotazioni||[]).filter(b=>!norm(b.stato).includes('annull'));
const tripName360=id=>{const v=(state.viaggi||[]).find(x=>x.id===id);return v?.titolo||v?.destinazione||v?.nome||'Viaggio'};
const tripDate360=v=>v?.data_partenza?new Date(v.data_partenza).toLocaleDateString('it-IT'):'';
const paid360=b=>Number(b.pagato??b.acconto??0)||0;
const due360=b=>Math.max(0,Number(b.saldo??(Number(b.totale||0)-paid360(b)))||0);
const seats360=b=>Number(b.posti||0)||0;
const tripBookings=id=>activeBookings().filter(b=>b.viaggio_id===id);
const tripStats=v=>{const bs=tripBookings(v.id), booked=bs.reduce((n,b)=>n+seats360(b),0), cap=Number(v.posti_totali||v.capienza||0), total=bs.reduce((n,b)=>n+Number(b.totale||0),0), paid=bs.reduce((n,b)=>n+paid360(b),0);return {bs,booked,cap,free:cap?Math.max(0,cap-booked):null,total,paid,due:Math.max(0,total-paid)}};
function findTrips(q){const n=norm(q);return (state.viaggi||[]).filter(v=>{const hay=norm([v.titolo,v.destinazione,v.luogo_partenza,v.data_partenza,v.id_viaggio].join(' '));return hay&&n.split(/\s+/).filter(x=>x.length>2).some(x=>hay.includes(x))})}
function findPeople(q){const n=norm(q);return activeBookings().filter(b=>{const hay=norm([b.cliente,b.cliente_nome,b.telefono,b.codice,b.id_prenotazione,tripName360(b.viaggio_id)].join(' '));return n.split(/\s+/).filter(x=>x.length>2).some(x=>hay.includes(x))}).slice(0,15)}
function todayISO(){return new Date().toISOString().slice(0,10)}
function tomorrowISO(){const d=new Date();d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}
function managementAudit(){
 const issues=[];
 const bs=activeBookings();
 const seen=new Map();
 bs.forEach(b=>{
   if(!b.viaggio_id) issues.push(['Prenotazione senza viaggio',b.cliente||b.id]);
   if(!String(b.fermata_partenza||'').trim()) issues.push(['Fermata mancante',b.cliente||b.id]);
   if(seats360(b)<1) issues.push(['Numero posti non valido',b.cliente||b.id]);
   if(Number(b.totale||0)<0||paid360(b)<0) issues.push(['Importo non valido',b.cliente||b.id]);
   const key=[b.viaggio_id,norm(b.posti_selezionati)].join('|');
   if(b.posti_selezionati){if(seen.has(key)) issues.push(['Possibile conflitto posti',`${b.cliente||b.id} ↔ ${seen.get(key)}`]); else seen.set(key,b.cliente||b.id)}
 });
 (state.viaggi||[]).forEach(v=>{if(!v.data_partenza)issues.push(['Viaggio senza data',v.titolo||v.id]); if(!v.autobus_id)issues.push(['Viaggio senza mezzo assegnato',v.titolo||v.id])});
 return issues.slice(0,30);
}
function summaryHTML(){
 const bs=activeBookings(), today=todayISO();
 const newToday=bs.filter(b=>String(b.created_at||b.data_prenotazione||'').slice(0,10)===today);
 const paid=(state.pagamenti||[]).filter(p=>String(p.data_pagamento||p.created_at||'').slice(0,10)===today).reduce((n,p)=>n+Number(p.importo||0),0);
 const due=bs.filter(b=>due360(b)>0);
 const overdue=(state.assistenteAcconti||[]).filter(x=>norm(x.stato_acconto||x.stato).includes('scad'));
 const upcoming=(state.viaggi||[]).filter(v=>String(v.data_partenza||'').slice(0,10)>=today).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza))).slice(0,5);
 return `<b>📍 Situazione gestionale</b><br>Nuove prenotazioni oggi: <b>${newToday.length}</b><br>Incassi registrati oggi: <b>${euro(paid)}</b><br>Prenotazioni con residuo: <b>${due.length}</b> · residuo totale <b>${euro(due.reduce((n,b)=>n+due360(b),0))}</b><br>Acconti segnalati/scaduti: <b>${overdue.length}</b><br><br><b>Prossime partenze</b><br>${upcoming.map(v=>{const s=tripStats(v);return `• ${esc360(v.titolo||v.destinazione)} — ${tripDate360(v)} — ${s.booked}${s.cap?'/'+s.cap:''} posti${s.free!==null?' · '+s.free+' liberi':''}`}).join('<br>')||'Nessuna partenza futura.'}`;
}
function prioritiesHTML(){
 const items=[];
 (state.assistenteAcconti||[]).filter(x=>norm(x.stato_acconto||x.stato).includes('scad')).slice(0,8).forEach(x=>items.push(`🔴 Acconto: ${esc360(x.cliente||'Cliente')} · ${esc360(x.titolo_viaggio||tripName360(x.viaggio_id))}`));
 managementAudit().slice(0,8).forEach(x=>items.push(`🟠 ${esc360(x[0])}: ${esc360(x[1])}`));
 const near=(state.viaggi||[]).filter(v=>{const d=String(v.data_partenza||'').slice(0,10);return d>=todayISO()&&d<=tomorrowISO()});
 near.forEach(v=>items.push(`🚌 Partenza imminente: ${esc360(v.titolo||v.destinazione)} · ${tripDate360(v)}`));
 return `<b>🎯 Cosa controllare adesso</b><br>${items.length?items.slice(0,15).map(x=>'• '+x).join('<br>'):'✅ Non vedo priorità critiche nei dati attualmente caricati.'}`;
}
function auditHTML(){
 const issues=managementAudit();
 return `<b>🔎 Controllo avanzato del gestionale</b><br>${issues.length?`Ho trovato <b>${issues.length}</b> elementi da verificare:<br><br>${issues.map(x=>`• <b>${esc360(x[0])}</b> — ${esc360(x[1])}`).join('<br>')}`:'✅ Nei controlli disponibili non risultano anomalie evidenti.'}<br><br><small>Il controllo è prudente: segnala elementi da verificare e non modifica dati automaticamente.</small>`;
}
function fleetHTML(){
 const rows=(state.flotta||[]).map(f=>`• <b>${esc360(f.titolo||f.marca||f.targa||'Mezzo')}</b> — ${esc360(f.targa||'')} · ${esc360(f.stato||'stato non indicato')}`);
 return `<b>🚌 Flotta</b><br>${rows.join('<br>')||'Nessun mezzo caricato.'}`;
}
function checkinHTML(q){
 const trips=findTrips(q); if(trips.length!==1)return trips.length>1?'Ho trovato più viaggi compatibili. Specifica destinazione/data.':'Non trovo con certezza il viaggio.';
 const v=trips[0], bs=tripBookings(v.id), checks=(state.checkin||[]).filter(x=>x.viaggio_id===v.id), ids=new Set(checks.map(x=>x.prenotazione_id).filter(Boolean));
 return `<b>✅ Check-in — ${esc360(v.titolo||v.destinazione)}</b><br>Prenotazioni: <b>${bs.length}</b> · check-in registrati: <b>${checks.length}</b><br>${bs.filter(b=>!ids.has(b.id)).slice(0,20).map(b=>`• da verificare: ${esc360(b.cliente||b.cliente_nome||'Cliente')}`).join('<br>')||'Nessuna prenotazione mancante rilevata con gli ID disponibili.'}`;
}
function tripHTML(q){
 const trips=findTrips(q); if(trips.length!==1)return trips.length>1?`Ho trovato più viaggi compatibili:<br>${trips.slice(0,8).map(v=>`• ${esc360(v.titolo||v.destinazione)} — ${tripDate360(v)}`).join('<br>')}<br><b>Indicami la data o la partenza.</b>`:'Non trovo un viaggio certo con questi dati.';
 const v=trips[0],s=tripStats(v), missing=s.bs.filter(b=>due360(b)>0), stops=(state.viaggiFermate||[]).filter(x=>x.viaggio_id===v.id).sort((a,b)=>Number(a.ordine||0)-Number(b.ordine||0));
 return `<b>🚌 ${esc360(v.titolo||v.destinazione)}</b> — ${tripDate360(v)}<br>Prenotati: <b>${s.booked}${s.cap?'/'+s.cap:''}</b>${s.free!==null?' · liberi <b>'+s.free+'</b>':''}<br>Valore prenotazioni: <b>${euro(s.total)}</b> · incassato: <b>${euro(s.paid)}</b> · residuo: <b>${euro(s.due)}</b><br>Clienti con residuo: <b>${missing.length}</b><br>Mezzo: <b>${esc360((state.flotta||[]).find(f=>f.id===v.autobus_id)?.titolo||'non assegnato')}</b><br>Fermate: ${stops.length?stops.map(x=>esc360(x.nome||x.fermata||x.luogo)).join(' → '):esc360(v.luogo_partenza||'da verificare')}`;
}
function searchHTML(q){
 const people=findPeople(q); if(!people.length)return 'Non trovo prenotazioni/clienti compatibili con la ricerca.';
 return `<b>🔍 Risultati</b><br>${people.map(b=>`• <b>${esc360(b.cliente||b.cliente_nome||'Cliente')}</b> · ${esc360(b.telefono||'')} · ${esc360(tripName360(b.viaggio_id))} · ${seats360(b)} posti · residuo ${euro(due360(b))}`).join('<br>')}`;
}
function helpHTML(){
 return `<b>🤖 Assistente DELGROSSO 360°</b><br>Puoi chiedermi:<br>• “Fammi il punto della situazione”<br>• “Cosa devo fare adesso?”<br>• “Controlla il gestionale”<br>• “Preparami Assisi” / “Riepilogo Napoli”<br>• “Check-in Assisi”<br>• “Mostrami la flotta”<br>• “Cerca Mario Rossi” o un numero di telefono<br>• “Chi deve ancora pagare?” / “Quanti posti liberi per …?”<br><br>Puoi inoltre incollare una richiesta WhatsApp. Prenotazioni e pagamenti continuano a usare <b>bozza + conferma obbligatoria</b>.`;
}
function answer360(q){
 const n=norm(q);
 if(/punto|situazione|riepilogo giornal|oggi come/.test(n))return summaryHTML();
 if(/cosa devo fare|priorit|urgente|da fare adesso/.test(n))return prioritiesHTML();
 if(/controlla.*gestionale|anomal|errori|incoeren|dati mancanti/.test(n))return auditHTML();
 if(/mostra.*flotta|riepilogo.*flotta|mezzi/.test(n)&&!(/liber|disponib/.test(n)))return fleetHTML();
 if(/check.?in|presenze/.test(n))return checkinHTML(q);
 if(/preparami|riepilogo viaggio|situazione viaggio|dossier/.test(n))return tripHTML(q);
 if(/cerca|trova|telefono|cliente/.test(n))return searchHTML(q);
 if(/cosa sai fare|aiuto|help|comandi/.test(n))return helpHTML();
 return null;
}
const oldAnswer=window.assistantAnswerQuestion;
window.assistantAnswerQuestion=function(q){return answer360(q) || (typeof oldAnswer==='function'?oldAnswer(q):helpHTML())};

function injectUI(){
 const page=document.getElementById('page-assistente'); if(!page||document.getElementById('assistant360Quick'))return;
 const command=document.getElementById('assistantCommand'); const card=command?.closest('.card'); if(!card)return;
 const panel=document.createElement('div');panel.id='assistant360Quick';panel.className='card';panel.style.marginBottom='12px';
 panel.innerHTML=`<div class="card-head"><h3>⚡ Controllo 360°</h3><span class="pill info">DATI REALI</span></div><div class="card-body"><div class="quick-actions">
 <button class="btn btn-secondary" data-q="Fammi il punto della situazione">📍 Punto situazione</button>
 <button class="btn btn-secondary" data-q="Cosa devo fare adesso?">🎯 Priorità</button>
 <button class="btn btn-secondary" data-q="Controlla il gestionale e cerca anomalie">🔎 Controlla errori</button>
 <button class="btn btn-secondary" data-q="Mostrami la flotta">🚌 Flotta</button>
 <button class="btn btn-secondary" data-q="Cosa sai fare?">❓ Funzioni</button>
 </div><p style="margin:10px 0 0;color:#607086;font-size:12px">Letture immediate. Qualsiasi scrittura resta soggetta a bozza e conferma.</p></div>`;
 card.insertAdjacentElement('afterend',panel);
 panel.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',async()=>{command.value=b.dataset.q;await window.assistantUnderstand()}));
}
const oldUnderstand=window.assistantUnderstand;
window.assistantUnderstand=async function(){
 const input=document.getElementById('assistantCommand'), raw=input?.value||'';
 if(!raw.trim())return typeof oldUnderstand==='function'?oldUnderstand():undefined;
 const special=answer360(raw);
 if(special){
   try{if(typeof loadAll==='function')await loadAll()}catch(e){}
   assistantDraft={kind:'answer',html:answer360(raw)};
   if(typeof assistantRenderDraft==='function')assistantRenderDraft();
   return;
 }
 return typeof oldUnderstand==='function'?oldUnderstand():undefined;
};
function boot(){injectUI();setTimeout(injectUI,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('hashchange',()=>{if(location.hash==='#assistente')setTimeout(injectUI,100)});
})();

/* V6.1 — Locandina + creazione guidata nuovo viaggio */
(function(){
'use strict';
let dgPosterDraft=null;
const $x=id=>document.getElementById(id);
const e=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function norm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function parseTripText(raw){
 const t=String(raw||'').trim(), low=norm(t);
 const money=t.match(/(?:€|euro|eur)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)/i);
 const date=t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);
 const iso=date?`${date[3]}-${String(date[2]).padStart(2,'0')}-${String(date[1]).padStart(2,'0')}`:'';
 const time=(t.match(/\b(?:ore\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/i)||[]);
 const min=(t.match(/minim(?:o|a)\s*(?:di\s*)?(\d+)/i)||[])[1]||'';
 const seats=(t.match(/(?:posti|capienza)\s*(?:totali\s*)?[:\-]?\s*(\d+)/i)||[])[1]||'';
 let dest='';
 const dm=t.match(/(?:per|destinazione)\s+([A-Za-zÀ-ÿ'’\s]+?)(?=,|;|\n|\b(?:il|data|partenza|costo|prezzo|€|euro|minimo|posti)\b)/i);
 if(dm)dest=dm[1].trim();
 if(!dest){const first=t.split(/[,;\n]/)[0].replace(/^(crea|nuovo|nuova|viaggio|gita|locandina)\s+/ig,'').trim();dest=first.slice(0,80)}
 const stops=[];
 const re=/(?:partenza\s+(?:da\s+)?|da\s+)([A-Za-zÀ-ÿ'’\s]+?)\s+(?:alle\s+)?(?:ore\s*)?([0-2]?\d[:.][0-5]\d)/ig;let m;
 while((m=re.exec(t)))stops.push(`${m[1].trim()} — ${m[2].replace('.',':')}`);
 return {title:dest?dest.toUpperCase():'',destination:dest,date:iso,time:time.length?`${String(time[1]).padStart(2,'0')}:${time[2]}`:'',price:money?Number(String(money[1]||money[2]).replace(',','.')):0,min:Number(min||0),seats:Number(seats||0),stops,description:t};
}
function duplicateTrips(d){
 return (state.viaggi||[]).filter(v=>{
   const sameDest=d.destination&&norm(v.destinazione||v.titolo).includes(norm(d.destination));
   const sameDate=d.date&&String(v.data_partenza||'').slice(0,10)===d.date;
   return sameDest&&sameDate;
 });
}
function injectTripCreator(){
 const page=$x('page-assistente'); if(!page||$x('assistantTripCreator'))return;
 const panel=document.createElement('div');panel.id='assistantTripCreator';panel.className='card';panel.style.marginBottom='12px';
 panel.innerHTML=`<div class="card-head"><h3>📸 Locandina → Nuovo viaggio</h3><span class="pill info">BOZZA + CONFERMA</span></div>
 <div class="card-body"><p style="margin-top:0;color:#607086">Allega la locandina e incolla/scrivi tutte le informazioni. L'Assistente prepara la scheda del viaggio e non salva nulla prima della conferma.</p>
 <div class="form-grid"><div class="field full"><label>Locandina</label><input id="assistantTripPoster" type="file" accept="image/jpeg,image/png,image/webp"><div id="assistantTripPosterPreview" style="margin-top:8px"></div></div>
 <div class="field full"><label>Informazioni viaggio</label><textarea id="assistantTripText" rows="5" placeholder="Es: Assisi, 18/10/2026, €70, partenza San Severo ore 00:00 e San Nicandro ore 00:30, minimo 40 persone..."></textarea></div></div>
 <div class="quick-actions"><button class="btn btn-primary" onclick="dgPrepareTripDraft()">🤖 Prepara nuovo viaggio</button></div><div id="assistantTripDraft" style="margin-top:12px"></div></div>`;
 const existing=$x('assistant360Quick')||page.querySelector('.card');existing.insertAdjacentElement('afterend',panel);
 const fi=$x('assistantTripPoster');fi.addEventListener('change',()=>{const f=fi.files?.[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/i.test(f.type)){fi.value='';return toast('Usa una locandina JPG, PNG o WEBP',false)}if(f.size>12*1024*1024){fi.value='';return toast('La locandina supera 12 MB',false)}const u=URL.createObjectURL(f);$x('assistantTripPosterPreview').innerHTML=`<img src="${u}" style="max-width:220px;max-height:300px;border-radius:14px;object-fit:cover"><br><small>${e(f.name)}</small>`});
}
window.dgPrepareTripDraft=function(){
 const raw=$x('assistantTripText')?.value||'';const file=$x('assistantTripPoster')?.files?.[0]||null;
 if(!raw.trim())return toast('Inserisci le informazioni del viaggio',false);
 const d=parseTripText(raw);dgPosterDraft={...d,file};renderTripDraft();
};
function renderTripDraft(){
 const d=dgPosterDraft, box=$x('assistantTripDraft');if(!d||!box)return;
 const dup=duplicateTrips(d);
 box.innerHTML=`<div class="module-card"><h3>📝 Bozza nuovo viaggio</h3>
 ${dup.length?`<div class="statusline warn">⚠️ Possibile duplicato: ${dup.map(v=>`${e(v.titolo||v.destinazione)} ${String(v.data_partenza||'').slice(0,10)}`).join(', ')}. Controlla prima di confermare.</div>`:''}
 <div class="form-grid">
 <div class="field full"><label>Titolo *</label><input id="at_title" value="${e(d.title)}"></div>
 <div class="field"><label>Destinazione *</label><input id="at_dest" value="${e(d.destination)}"></div>
 <div class="field"><label>Data *</label><input id="at_date" type="date" value="${e(d.date)}"></div>
 <div class="field"><label>Ora</label><input id="at_time" type="time" value="${e(d.time)}"></div>
 <div class="field"><label>Prezzo €</label><input id="at_price" type="number" step=".01" min="0" value="${d.price||''}"></div>
 <div class="field"><label>Posti totali *</label><input id="at_seats" type="number" min="1" value="${d.seats||''}"></div>
 <div class="field"><label>Minimo partecipanti</label><input id="at_min" type="number" min="0" value="${d.min||''}"></div>
 <div class="field full"><label>Fermate — una per riga</label><textarea id="at_stops" rows="4">${e(d.stops.join('\n'))}</textarea></div>
 <div class="field full"><label>Descrizione / informazioni</label><textarea id="at_desc" rows="5">${e(d.description)}</textarea></div>
 <div class="field"><label>Stato</label><select id="at_status"><option>Programmato</option><option>Confermato</option></select></div>
 <div class="field"><label>Pubblicato</label><select id="at_pub"><option>NO</option><option>SI</option></select></div></div>
 <div class="statusline" style="margin-top:10px">🔐 Nessun viaggio è stato ancora creato. Controlla i campi prima di confermare.</div>
 <div class="quick-actions" style="margin-top:10px"><button class="btn btn-green" onclick="dgConfirmTripDraft()">✓ CONFERMA NUOVO VIAGGIO</button><button class="btn btn-secondary" onclick="dgPosterDraft=null;document.getElementById('assistantTripDraft').innerHTML=''">Annulla</button></div></div>`;
}
window.dgConfirmTripDraft=async function(){
 const title=$x('at_title')?.value.trim(),dest=$x('at_dest')?.value.trim(),date=$x('at_date')?.value,seats=Number($x('at_seats')?.value||0);
 if(!title||!dest||!date||seats<1)return toast('Completa titolo, destinazione, data e posti totali',false);
 const d={...dgPosterDraft,title,destination:dest,date,time:$x('at_time')?.value||null,price:Number($x('at_price')?.value||0),seats,min:Number($x('at_min')?.value||0),stops:$x('at_stops')?.value.split(/\n+/).map(x=>x.trim()).filter(Boolean),description:$x('at_desc')?.value||null,status:$x('at_status')?.value,published:$x('at_pub')?.value};
 const dup=duplicateTrips(d);if(dup.length&&!confirm('Esiste un possibile viaggio duplicato per destinazione e data. Vuoi comunque continuare?'))return;
 if(!confirm(`Confermi la creazione del nuovo viaggio?\n${title}\n${date}\n${seats} posti · € ${d.price.toFixed(2)}\nPubblicato: ${d.published}`))return;
 try{
   const body={titolo:title,destinazione:dest,luogo_partenza:d.stops.join(' | '),data_partenza:date,ora_partenza:d.time,prezzo:d.price,descrizione:d.description,posti_totali:seats,posti_liberi:seats,posti_occupati:0,stato:d.status,pubblicato:d.published,costo_totale:0,id_viaggio:'AS-'+String(Date.now()).slice(-6)};
   const created=await api('viaggi','',{method:'POST',body,headers:{Prefer:'return=representation'}});
   const tripId=created?.[0]?.id;if(!tripId)throw new Error('ID del viaggio non restituito');
   if(d.file){const poster=await uploadTripPoster(d.file,tripId);await api('viaggi',`id=eq.${tripId}`,{method:'PATCH',body:{locandina:poster}})}
   for(let i=0;i<d.stops.length;i++)await api('viaggi_fermate','',{method:'POST',body:{viaggio_id:tripId,nome:d.stops[i],ordine:i+1,attiva:true}});
   dgPosterDraft=null;$x('assistantTripDraft').innerHTML='';$x('assistantTripText').value='';$x('assistantTripPoster').value='';$x('assistantTripPosterPreview').innerHTML='';
   toast('Nuovo viaggio creato con locandina e fermate');await loadAll();
 }catch(err){toast('Viaggio non creato: '+err.message,false)}
};
function bootTrip(){injectTripCreator();setTimeout(injectTripCreator,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootTrip);else bootTrip();
window.addEventListener('hashchange',()=>{if(location.hash==='#assistente')setTimeout(injectTripCreator,80)});
})();


/* V6.2 — Assistente Flotta: manutenzioni/scadenze multi-mezzo con anteprima e conferma */
(function(){
'use strict';
let dgFleetDraft=null;
const gx=id=>document.getElementById(id);
const ge=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const gn=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function fleetLabel(v){return [v.titolo,v.marca,v.modello,v.targa].filter(Boolean).join(' · ')}
function fleetMatches(raw){
 const q=gn(raw), all=(state.flotta||[]).filter(v=>v.attivo!==false);
 let chosen=[];
 if(/tutti|tutte|tutti i mezzi|tutti i bus/.test(q)) chosen=[...all];
 else chosen=all.filter(v=>{
   const hay=gn([v.titolo,v.marca,v.modello,v.targa,v.categoria,v.descrizione].join(' '));
   return q.split(/\s+/).filter(x=>x.length>2).some(x=>hay.includes(x));
 });
 if(/tranne|esclud/i.test(q)){
   const ex=q.split(/tranne|esclud(?:i|endo)?/i)[1]||'';
   const toks=gn(ex).split(/\s+/).filter(x=>x.length>2);
   chosen=chosen.filter(v=>!toks.some(x=>gn(fleetLabel(v)).includes(x)));
 }
 return [...new Map(chosen.map(v=>[v.id,v])).values()];
}
function parseDate(raw){
 let m=raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 const months={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
 const q=gn(raw);for(const [name,n] of Object.entries(months)){const z=q.match(new RegExp(name+'\\s+(20\\d{2})'));if(z)return `${z[1]}-${String(n).padStart(2,'0')}-31`}
 return '';
}
function parseFleet(raw){
 const q=gn(raw), vehicles=fleetMatches(raw), date=parseDate(raw), km=Number((raw.match(/\b(\d{3,7})\s*km\b/i)||[])[1]||0);
 const cost=Number(String((raw.match(/(?:€|euro)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)/i)||[])[1]||'0').replace(',','.'));
 let kind='MANUTENZIONE',type='Altro';
 if(/estintor/.test(q)){kind='SCADENZA';type='Estintori'}
 else if(/assicuraz/.test(q)){kind='SCADENZA';type='Assicurazione'}
 else if(/revision/.test(q)){kind='SCADENZA';type='Revisione'}
 else if(/bollo/.test(q)){kind='SCADENZA';type='Bollo'}
 else if(/tagliand/.test(q)){kind='MANUTENZIONE';type='Tagliando'}
 else if(/pneumatic|gomme/.test(q)){kind='MANUTENZIONE';type='Pneumatici'}
 return {raw,vehicles,date,km,cost,kind,type};
}
function injectFleet(){
 const page=gx('page-assistente');if(!page||gx('assistantFleet360'))return;
 const p=document.createElement('div');p.id='assistantFleet360';p.className='card';p.style.marginBottom='12px';
 p.innerHTML=`<div class="card-head"><h3>🚌 Gestione Flotta intelligente</h3><span class="pill info">PC + iPHONE</span></div><div class="card-body">
 <p style="margin-top:0;color:#607086">Scrivi una manutenzione o una scadenza in linguaggio naturale. Prima di modificare i dati vedrai sempre i mezzi interessati.</p>
 <textarea id="assistantFleetText" rows="4" placeholder="Es: A tutti i mezzi tranne il Mercedes, gli estintori scadono a luglio 2027.&#10;Es: Il bus GT PB bianco ha fatto il tagliando oggi, 245000 km."></textarea>
 <div class="quick-actions"><button class="btn btn-primary" onclick="dgPrepareFleetDraft()">🤖 Analizza flotta</button></div><div id="assistantFleetDraft" style="margin-top:12px"></div></div>`;
 const a=gx('assistantTripCreator')||gx('assistant360Quick')||page.querySelector('.card');a.insertAdjacentElement('afterend',p);
}
window.dgPrepareFleetDraft=function(){
 const raw=gx('assistantFleetText')?.value.trim();if(!raw)return toast('Scrivi cosa devo registrare sulla flotta',false);
 dgFleetDraft=parseFleet(raw);renderFleet();
};
function renderFleet(){
 const d=dgFleetDraft,b=gx('assistantFleetDraft');if(!d||!b)return;
 if(!d.vehicles.length){b.innerHTML='<div class="statusline warn">⚠️ Non riesco a identificare con sicurezza il mezzo. Specifica nome, modello, colore o targa.</div>';return}
 const today=new Date().toISOString().slice(0,10);
 b.innerHTML=`<div class="module-card"><h3>👁️ Anteprima operazione flotta</h3>
 <div class="statusline"><b>Mezzi interessati (${d.vehicles.length}):</b><br>${d.vehicles.map(v=>'• '+ge(fleetLabel(v))).join('<br>')}</div>
 <div class="form-grid" style="margin-top:10px"><div class="field"><label>Operazione</label><select id="af_kind"><option ${d.kind==='MANUTENZIONE'?'selected':''}>MANUTENZIONE</option><option ${d.kind==='SCADENZA'?'selected':''}>SCADENZA</option></select></div>
 <div class="field"><label>Tipo</label><input id="af_type" value="${ge(d.type)}"></div>
 <div class="field"><label>${d.kind==='SCADENZA'?'Data scadenza':'Data intervento'}</label><input id="af_date" type="date" value="${ge(d.date||(d.kind==='MANUTENZIONE'?today:''))}"></div>
 <div class="field"><label>Km</label><input id="af_km" type="number" min="0" value="${d.km||''}"></div>
 <div class="field"><label>Costo €</label><input id="af_cost" type="number" min="0" step=".01" value="${d.cost||''}"></div>
 <div class="field full"><label>Note</label><textarea id="af_note">${ge(d.raw)}</textarea></div></div>
 <div class="statusline" style="margin-top:10px">🔐 Verranno aggiornati storico manutenzioni/scadenziario e audit. Nessuna scrittura prima della conferma.</div>
 <div class="quick-actions" style="margin-top:10px"><button class="btn btn-green" onclick="dgConfirmFleetDraft()">✓ CONFERMA AGGIORNAMENTO</button><button class="btn btn-secondary" onclick="document.getElementById('assistantFleetDraft').innerHTML=''">Annulla</button></div></div>`;
}
async function auditFleet(v,action,data){try{await api('audit_log_gestionale','',{method:'POST',body:{azione:action,entita:'flotta',entita_id:v.id,descrizione:`Assistente DELGROSSO: ${action} - ${fleetLabel(v)}`,dati:data}})}catch(_){}}
window.dgConfirmFleetDraft=async function(){
 const d=dgFleetDraft;if(!d)return;
 const kind=gx('af_kind').value,type=gx('af_type').value.trim(),date=gx('af_date').value,km=Number(gx('af_km').value||0),cost=Number(gx('af_cost').value||0),note=gx('af_note').value||null;
 if(!type||!date)return toast('Inserisci tipo e data',false);
 if(!confirm(`Confermi ${kind.toLowerCase()} "${type}" su ${d.vehicles.length} mezzo/i?\nData: ${date}\n\n${d.vehicles.map(fleetLabel).join('\n')}`))return;
 try{
  for(const v of d.vehicles){
   if(kind==='SCADENZA'){
    await api('scadenze_gestionale','',{method:'POST',body:{titolo:`${type} — ${fleetLabel(v)}`,descrizione:note,tipo:'FLOTTA',stato:'Aperta',priorita:'Media',data_scadenza:date,riferimento_tipo:'flotta',riferimento_id:v.id,note}});
    await auditFleet(v,'SCADENZA_FLOTTA',{tipo:type,data_scadenza:date,note});
   }else{
    await api('manutenzioni_flotta','',{method:'POST',body:{flotta_id:v.id,tipo:type,descrizione:note,data_intervento:date,km:km||null,costo:cost||0,stato:'Completata',note}});
    await auditFleet(v,'MANUTENZIONE_FLOTTA',{tipo:type,data_intervento:date,km:km||null,costo:cost||0,note});
   }
  }
  toast(`Aggiornati ${d.vehicles.length} mezzi`);gx('assistantFleetDraft').innerHTML='';gx('assistantFleetText').value='';dgFleetDraft=null;await loadAll();
 }catch(err){toast('Aggiornamento non completato: '+err.message,false)}
};
function boot(){injectFleet();setTimeout(injectFleet,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('hashchange',()=>setTimeout(injectFleet,80));
})();
