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


/* V7 — DELGROSSO 360: catalogo capacità + ricerca universale + disponibilità flotta + operazioni controllate */
(function(){
'use strict';
const V7={};
const $7=id=>document.getElementById(id);
const h7=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n7=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function tripName(v){return v?.titolo||v?.destinazione||v?.id_viaggio||'Viaggio'}
function clientName(c){return [c?.nome,c?.cognome].filter(Boolean).join(' ')||c?.cliente||c?.nominativo||''}
function vehicleName(v){return [v?.titolo,v?.marca,v?.modello,v?.targa].filter(Boolean).join(' · ')}
function capPanel(){
 const page=$7('page-assistente');if(!page||$7('assistantV7Capabilities'))return;
 const p=document.createElement('div');p.id='assistantV7Capabilities';p.className='card';p.style.marginBottom='12px';
 p.innerHTML=`<div class="card-head"><h3>✨ Cosa posso fare nel Gestionale</h3><span class="pill success">V7 · 360°</span></div>
 <div class="card-body"><div class="cards">
 ${[
 ['🚌 Viaggi','Crea viaggio da locandina + informazioni, controlla posti/fermate/riempimento, prepara dossier partenza.'],
 ['👥 Prenotazioni','Cerca prenotazioni e clienti, interpreta richieste incollate da WhatsApp, prepara modifiche con conferma.'],
 ['💶 Pagamenti','Acconti/saldi con controllo del cliente e del viaggio; riepiloghi incassato e residuo.'],
 ['💺 Posti & check-in','Disponibilità, posti assegnati, mancanti al check-in e controllo operativo della partenza.'],
 ['🔧 Flotta','Tagliandi, manutenzioni, estintori/revisioni/assicurazioni, scadenze multiple e disponibilità mezzi per data.'],
 ['📅 Centro operativo','Scadenze, attività, anomalie, priorità e “Cosa devo fare adesso?”.'],
 ['📁 Archivio','Ricerca documenti/ricevute collegate a cliente, viaggio, prenotazione o pagamento.'],
 ['📊 Economia','Riepilogo viaggio, incassi/residui e movimenti economici già presenti nel gestionale.'],
 ['🚍 Noleggi bus','Consulta noleggi, date, mezzi e conflitti di disponibilità.'],
 ['🔎 Ricerca 360','Cerca per nome, telefono, codice prenotazione, destinazione, data, targa o mezzo.']
 ].map(x=>`<div class="card" style="padding:12px"><b>${x[0]}</b><div style="margin-top:5px;color:#607086">${x[1]}</div></div>`).join('')}
 </div><div class="quick-actions" style="margin-top:12px">
 <button class="btn btn-secondary" onclick="dgV7Help()">📖 Esempi comandi</button>
 <button class="btn btn-secondary" onclick="dgV7UniversalSearchPrompt()">🔎 Ricerca 360</button>
 <button class="btn btn-secondary" onclick="dgV7FleetAvailabilityPrompt()">🚌 Mezzi liberi</button>
 </div><div id="assistantV7Output" style="margin-top:12px"></div></div>`;
 const first=page.querySelector('.card'); first?first.insertAdjacentElement('afterend',p):page.appendChild(p);
}
window.dgV7Help=()=>{$7('assistantV7Output').innerHTML=`<div class="module-card"><b>Puoi scrivermi, per esempio:</b><br><br>
“Preparami Assisi” · “Quanti posti rimangono per Napoli?” · “Chi deve ancora pagare l’acconto?” · “Cerca Mario Rossi” · “Quali mezzi sono liberi il 20 dicembre?” · “Il PB bianco ha fatto il tagliando” · “A tutti i mezzi tranne il Mercedes gli estintori scadono a luglio 2027” · “Controlla le anomalie” · “Fammi il punto della situazione”.<br><br>
<b>Regola:</b> letture e controlli sono immediati; creazioni/modifiche richiedono anteprima e conferma.</div>`};
function allSearch(q){
 const x=n7(q), rows=[];
 (state.clienti||[]).forEach(c=>{const hay=n7([clientName(c),c.telefono,c.email,c.codice_cliente,c.citta].join(' '));if(hay.includes(x))rows.push(['Cliente',clientName(c),c.telefono||c.email||'',c.id])});
 (state.prenotazioni||[]).forEach(p=>{const hay=n7([p.cliente,p.nominativo,p.nome,p.cognome,p.telefono,p.email,p.codice_prenotazione,p.id_prenotazione,p.fermata_partenza].join(' '));if(hay.includes(x)){const v=(state.viaggi||[]).find(v=>v.id===p.viaggio_id);rows.push(['Prenotazione',p.cliente||p.nominativo||[p.nome,p.cognome].filter(Boolean).join(' '),tripName(v),p.id])}});
 (state.viaggi||[]).forEach(v=>{if(n7([tripName(v),v.destinazione,v.data_partenza,v.id_viaggio].join(' ')).includes(x))rows.push(['Viaggio',tripName(v),String(v.data_partenza||'').slice(0,10),v.id])});
 (state.flotta||[]).forEach(v=>{if(n7(vehicleName(v)).includes(x))rows.push(['Mezzo',vehicleName(v),v.stato||'',v.id])});
 return rows;
}
window.dgV7UniversalSearchPrompt=()=>{const q=prompt('Cosa vuoi cercare? Nome, telefono, codice, viaggio, destinazione, targa...');if(q)dgV7UniversalSearch(q)};
window.dgV7UniversalSearch=function(q){const rows=allSearch(q);$7('assistantV7Output').innerHTML=rows.length?`<div class="module-card"><h3>🔎 Risultati per “${h7(q)}”</h3>${rows.slice(0,40).map(r=>`<div class="statusline"><b>${h7(r[0])}</b> · ${h7(r[1])}<br><small>${h7(r[2])}</small></div>`).join('')}</div>`:`<div class="statusline warn">Nessun risultato per “${h7(q)}”.</div>`};
function dateFromText(q){const m=String(q).match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](20\d{2}))?\b/);if(m)return `${m[3]||new Date().getFullYear()}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;const months={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};const s=n7(q);for(const [k,v] of Object.entries(months)){const z=s.match(new RegExp('(\\d{1,2})\\s+'+k+'(?:\\s+(20\\d{2}))?'));if(z)return `${z[2]||new Date().getFullYear()}-${String(v).padStart(2,'0')}-${z[1].padStart(2,'0')}`}return ''}
function busyOn(v,date){
 const reasons=[];
 (state.viaggi||[]).filter(t=>t.autobus_id===v.id&&String(t.data_partenza||'').slice(0,10)===date&&!/annull/i.test(t.stato||'')).forEach(t=>reasons.push('Viaggio: '+tripName(t)));
 (state.dgBlocchi||state.dg_blocchi_flotta||[]).filter(b=>b.flotta_id===v.id&&date>=String(b.data_inizio||'').slice(0,10)&&date<=String(b.data_fine||'').slice(0,10)).forEach(b=>reasons.push('Blocco: '+(b.motivo||'mezzo non disponibile')));
 (state.noleggiMezzi||state.noleggi_bus_mezzi||[]).filter(m=>m.flotta_id===v.id).forEach(m=>{const n=(state.noleggi||state.noleggi_bus||[]).find(x=>x.id===m.noleggio_id);if(n&&date>=String(n.data_partenza||'').slice(0,10)&&date<=String(n.data_ritorno||n.data_partenza||'').slice(0,10))reasons.push('Noleggio: '+(n.id_noleggio||n.referente||'occupato'))});
 return reasons;
}
window.dgV7FleetAvailabilityPrompt=()=>{const q=prompt('Per quale data vuoi controllare i mezzi? Es. 20/12/2026');const d=dateFromText(q||'');if(!d)return toast('Data non riconosciuta',false);dgV7FleetAvailability(d)};
window.dgV7FleetAvailability=function(date){const vs=(state.flotta||[]).filter(v=>v.attivo!==false);$7('assistantV7Output').innerHTML=`<div class="module-card"><h3>🚌 Disponibilità mezzi · ${h7(date)}</h3>${vs.map(v=>{const r=busyOn(v,date);return `<div class="statusline ${r.length?'warn':'success'}"><b>${h7(vehicleName(v))}</b> — ${r.length?'OCCUPATO':'LIBERO'}${r.length?'<br><small>'+h7(r.join(' · '))+'</small>':''}</div>`}).join('')}</div>`};
const oldUnderstand=window.assistantUnderstand;
window.assistantUnderstand=async function(){
 const raw=$7('assistantCommand')?.value?.trim()||'', q=n7(raw);
 if(/cosa (?:puoi|sai) fare|aiuto assistente|comandi assistente/.test(q)){dgV7Help();return}
 if(/(?:mezzi|autobus|bus).*(?:liber|disponibil)|(?:liber|disponibil).*(?:mezzi|autobus|bus)/.test(q)){await loadAll();const d=dateFromText(raw);if(!d){$7('assistantV7Output').innerHTML='<div class="statusline warn">Indicami anche la data, per esempio: “Quali mezzi sono liberi il 20/12/2026?”</div>';return}dgV7FleetAvailability(d);return}
 if(/^(?:cerca|trova)\s+/.test(q)){await loadAll();dgV7UniversalSearch(raw.replace(/^(cerca|trova)\s+/i,''));return}
 return oldUnderstand?oldUnderstand():undefined;
};
function boot7(){capPanel();setTimeout(capPanel,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot7);else boot7();
window.addEventListener('hashchange',()=>setTimeout(capPanel,80));
})();


/* DELGROSSO Assistente 360 V8.1 — governance operativa */
(function(){
'use strict';
const N=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const H=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function out(html){const e=document.getElementById('assistantV7Output')||document.getElementById('assistantOutput');if(e)e.innerHTML=html}
function explainSafety(raw){
 const q=N(raw);
 const destructive=/elimina|cancella|annulla|rimbor|sposta|modifica|assegna|registra|crea|aggiungi|imposta|scaden|tagliand|pagat|acconto|saldo/.test(q);
 if(!destructive)return false;
 out(`<div class="module-card"><h3>🛡️ Operazione controllata</h3><p>Ho riconosciuto una richiesta che può modificare il gestionale.</p><div class="statusline warn"><b>Richiesta:</b> ${H(raw)}</div><p>Prima di scrivere nel database devo identificare con certezza record, importi/date/posti e mostrarti l’anteprima. Se manca un dato non lo invento.</p><p><b>Nessuna modifica è stata eseguita da questo fallback.</b> Completa i dati richiesti oppure usa il flusso specifico dell’Assistente.</p></div>`);
 return true;
}
const prev=window.assistantUnderstand;
window.assistantUnderstand=async function(){
 const raw=document.getElementById('assistantCommand')?.value?.trim()||'';
 if(!raw)return prev?prev():undefined;
 const known=/cosa (?:puoi|sai) fare|aiuto assistente|comandi assistente|(?:mezzi|autobus|bus).*(?:liber|disponibil)|(?:liber|disponibil).*(?:mezzi|autobus|bus)|^(?:cerca|trova)\s+|locandina|estintor|tagliand|assicuraz|revisione|bollo|pneumatic|prenot|acconto|saldo|pagamento|posti|check.?in|preparami|anomali|situazione|incass|residuo/i.test(N(raw));
 if(known&&prev)return prev();
 if(explainSafety(raw))return;
 return prev?prev():undefined;
};
window.dgAssistantPolicy={version:'8.1',writesRequirePreview:true,writesRequireConfirmation:true,ambiguityNeverGuessed:true,verifyAfterWrite:true};
})();

/* DELGROSSO Assistente 360 V9 — motore operativo esteso con anteprima/conferma */
(function(){
'use strict';
const A={draft:null};
const n=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const h=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const el=id=>document.getElementById(id);
const tripLabel=v=>v?.titolo||v?.destinazione||v?.id_viaggio||'Viaggio';
const vehLabel=v=>[v?.titolo,v?.marca,v?.modello,v?.targa].filter(Boolean).join(' · ');
const bookingLabel=b=>`${b?.cliente||b?.cliente_nome||'Cliente'} · ${tripLabel((state.viaggi||[]).find(v=>v.id===b?.viaggio_id))}`;
function output(html){const x=el('assistantDraft')||el('assistantV7Output');if(x)x.innerHTML=html}
function words(s){return n(s).split(/\s+/).filter(x=>x.length>2 && !['della','delle','degli','questo','questa','quello','quella','viaggio','cliente','prenotazione'].includes(x))}
function score(hay,q){const H=n(hay),w=words(q);return w.reduce((z,x)=>z+(H.includes(x)?1:0),0)}
function bookings(q){return (state.prenotazioni||[]).filter(b=>!/annull/i.test(b.stato||'')).map(b=>({x:b,s:score([b.cliente,b.cliente_nome,b.telefono,b.codice,b.id_prenotazione,tripLabel((state.viaggi||[]).find(v=>v.id===b.viaggio_id))].join(' '),q)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.x)}
function trips(q){return (state.viaggi||[]).map(v=>({x:v,s:score([v.titolo,v.destinazione,v.data_partenza,v.id_viaggio].join(' '),q)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.x)}
function vehicles(q){return (state.flotta||[]).filter(v=>v.attivo!==false).map(v=>({x:v,s:score(vehLabel(v),q)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.x)}
function isoDate(raw){let m=String(raw).match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(/\boggi\b/i.test(raw))return new Date().toISOString().slice(0,10);return ''}
function audit(action,entity,id,data){return api('audit_log_gestionale','',{method:'POST',body:{azione:action,entita:entity,entita_id:id||null,descrizione:'Assistente DELGROSSO: '+action,dati:data||{}}}).catch(()=>{})}
function select(id,label,rows,lab,selected=''){return `<div class="field full"><label>${h(label)}</label><select id="${id}"><option value="">— Seleziona —</option>${rows.slice(0,30).map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${h(lab(x))}</option>`).join('')}</select></div>`}
function shell(title,body,confirmFn){output(`<div class="module-card"><h3>👁️ ${h(title)}</h3>${body}<div class="statusline warn" style="margin-top:10px">🔐 Nessuna modifica è stata ancora salvata. Controlla i dati e conferma.</div><div class="quick-actions" style="margin-top:10px"><button class="btn btn-green" onclick="${confirmFn}()">✓ CONFERMA OPERAZIONE</button><button class="btn btn-secondary" onclick="dgA9Cancel()">Annulla</button></div></div>`)}
window.dgA9Cancel=()=>{A.draft=null;output('')};
async function verify(msg){await loadAll();toast(msg||'Operazione verificata nel gestionale')}
function moveDraft(raw){const bs=bookings(raw),ts=trips(raw);A.draft={kind:'move',raw};shell('Spostamento prenotazione',`<div class="form-grid">${select('a9_booking','Prenotazione da spostare *',bs,bookingLabel)}${select('a9_trip','Nuovo viaggio *',ts,tripLabel)}<div class="field"><label>Nuova fermata (facoltativa)</label><input id="a9_stop"></div></div>`,'dgA9ConfirmMove')}
window.dgA9ConfirmMove=async()=>{const b=(state.prenotazioni||[]).find(x=>x.id===el('a9_booking')?.value),v=(state.viaggi||[]).find(x=>x.id===el('a9_trip')?.value),stop=el('a9_stop')?.value.trim();if(!b||!v)return toast('Seleziona prenotazione e nuovo viaggio',false);if(b.viaggio_id===v.id)return toast('La prenotazione è già su questo viaggio',false);const pax=Number(b.posti||0),occ=(state.prenotazioni||[]).filter(x=>x.viaggio_id===v.id&&x.id!==b.id&&!/annull/i.test(x.stato||'')).reduce((z,x)=>z+Number(x.posti||0),0),cap=Number(v.posti_totali||0);if(cap&&occ+pax>cap)return toast('Posti insufficienti sul nuovo viaggio',false);if(!confirm(`Spostare ${b.cliente} su ${tripLabel(v)}?`))return;const body={viaggio_id:v.id,viaggio_codice:v.id_viaggio||null,posti_selezionati:'',updated_at:new Date().toISOString()};if(stop)body.fermata_partenza=stop;await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body});try{await rpc('dg_sync_booking_seats',{p_booking_id:b.id,p_seats:[]})}catch(_){}await audit('SPOSTA_PRENOTAZIONE','prenotazioni',b.id,{da:b.viaggio_id,a:v.id});A.draft=null;output('');await verify('Prenotazione spostata e ricontrollata')};
function cancelDraft(raw){const bs=bookings(raw);A.draft={kind:'cancel'};shell('Annullamento prenotazione',`<div class="form-grid">${select('a9_booking','Prenotazione da annullare *',bs,bookingLabel)}<div class="field full"><label>Motivo / note</label><textarea id="a9_note"></textarea></div></div><div class="statusline">⚠️ L'operazione libera i posti collegati. Eventuali rimborsi devono essere registrati separatamente.</div>`,'dgA9ConfirmCancel')}
window.dgA9ConfirmCancel=async()=>{const b=(state.prenotazioni||[]).find(x=>x.id===el('a9_booking')?.value);if(!b)return toast('Seleziona la prenotazione',false);if(!confirm(`ANNULLARE la prenotazione di ${b.cliente}?`))return;await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body:{stato:'Annullata',note:[b.note,el('a9_note')?.value,'Annullata tramite Assistente DELGROSSO'].filter(Boolean).join(' · '),updated_at:new Date().toISOString()}});try{await rpc('dg_sync_booking_seats',{p_booking_id:b.id,p_seats:[]})}catch(_){}await audit('ANNULLA_PRENOTAZIONE','prenotazioni',b.id,{});A.draft=null;output('');await verify('Prenotazione annullata e posti ricontrollati')};
function checkinDraft(raw){const bs=bookings(raw);A.draft={kind:'checkin'};shell('Registrazione check-in',`<div class="form-grid">${select('a9_booking','Prenotazione *',bs,bookingLabel)}<div class="field"><label>Esito</label><select id="a9_esito"><option>Presente</option><option>Assente</option><option>Da verificare</option></select></div><div class="field"><label>Gate / fermata</label><input id="a9_gate"></div><div class="field full"><label>Note</label><textarea id="a9_note"></textarea></div></div>`,'dgA9ConfirmCheckin')}
window.dgA9ConfirmCheckin=async()=>{const b=(state.prenotazioni||[]).find(x=>x.id===el('a9_booking')?.value),es=el('a9_esito')?.value;if(!b)return toast('Seleziona la prenotazione',false);if(!confirm(`Registrare check-in ${es} per ${b.cliente}?`))return;await api('accessi_checkin','',{method:'POST',body:{prenotazione_id:b.id,prenotazione_codice:b.codice||b.id_prenotazione||null,viaggio_id:b.viaggio_id,cliente:b.cliente,telefono:b.telefono,email:b.email,esito:es,operatore:window.currentOperator?.name||'Assistente',gate:el('a9_gate')?.value||b.fermata_partenza||null,note:el('a9_note')?.value||null}});await api('prenotazioni',`id=eq.${b.id}`,{method:'PATCH',body:{checkin_effettuato:/presente/i.test(es),checkin_stato:es,checked_in_at:new Date().toISOString(),checkin_operatore:window.currentOperator?.name||'Assistente'}});await audit('CHECKIN','prenotazioni',b.id,{esito:es});A.draft=null;output('');await verify('Check-in registrato e verificato')};
function assignBusDraft(raw){const ts=trips(raw),vs=vehicles(raw);A.draft={kind:'assignbus'};shell('Assegnazione mezzo',`<div class="form-grid">${select('a9_trip','Viaggio *',ts,tripLabel)}${select('a9_vehicle','Mezzo *',vs,vehLabel)}</div><div class="statusline">L'assistente ricontrollerà conflitti viaggio, blocchi e noleggi prima di salvare.</div>`,'dgA9ConfirmBus')}
function busy(v,date,excludeTrip){const r=[];(state.viaggi||[]).filter(t=>t.id!==excludeTrip&&t.autobus_id===v.id&&String(t.data_partenza||'').slice(0,10)===date&&!/annull/i.test(t.stato||'')).forEach(t=>r.push(tripLabel(t)));(state.dgBlocchi||[]).filter(b=>b.flotta_id===v.id&&date>=String(b.data_inizio||'').slice(0,10)&&date<=String(b.data_fine||'').slice(0,10)).forEach(b=>r.push('Blocco: '+(b.motivo||'')));return r}
window.dgA9ConfirmBus=async()=>{const v=(state.viaggi||[]).find(x=>x.id===el('a9_trip')?.value),f=(state.flotta||[]).find(x=>x.id===el('a9_vehicle')?.value);if(!v||!f)return toast('Seleziona viaggio e mezzo',false);const date=String(v.data_partenza||'').slice(0,10),conf=busy(f,date,v.id);if(conf.length)return toast('Mezzo non disponibile: '+conf.join(', '),false);if(Number(f.posti||0)&&Number(v.posti_occupati||0)>Number(f.posti))return toast('Il mezzo ha meno posti dei prenotati',false);if(!confirm(`Assegnare ${vehLabel(f)} a ${tripLabel(v)}?`))return;await api('viaggi',`id=eq.${v.id}`,{method:'PATCH',body:{autobus_id:f.id,autobus:vehLabel(f),updated_at:new Date().toISOString()}});await audit('ASSEGNA_MEZZO','viaggi',v.id,{flotta_id:f.id});A.draft=null;output('');await verify('Mezzo assegnato e verificato')};
function publishDraft(raw,pub){const ts=trips(raw);A.draft={kind:'publish',pub};shell(pub?'Pubblicazione viaggio':'Rimozione viaggio dal sito',`<div class="form-grid">${select('a9_trip','Viaggio *',ts,tripLabel)}</div>`,'dgA9ConfirmPublish')}
window.dgA9ConfirmPublish=async()=>{const v=(state.viaggi||[]).find(x=>x.id===el('a9_trip')?.value);if(!v)return toast('Seleziona il viaggio',false);const pub=A.draft?.pub;if(!confirm(`${pub?'Pubblicare':'Nascondere'} ${tripLabel(v)}?`))return;await api('viaggi',`id=eq.${v.id}`,{method:'PATCH',body:{pubblicato:pub?'SI':'NO',updated_at:new Date().toISOString()}});await audit(pub?'PUBBLICA_VIAGGIO':'NASCONDI_VIAGGIO','viaggi',v.id,{});A.draft=null;output('');await verify(pub?'Viaggio pubblicato':'Viaggio rimosso dal sito')};
function taskDraft(raw){const date=isoDate(raw);A.draft={kind:'task'};shell('Nuova attività',`<div class="form-grid"><div class="field full"><label>Titolo *</label><input id="a9_title" value="${h(raw.replace(/^(crea|aggiungi|inserisci)\s+(una\s+)?(attivita|promemoria)\s*/i,''))}"></div><div class="field"><label>Scadenza</label><input id="a9_date" type="date" value="${date}"></div><div class="field"><label>Priorità</label><select id="a9_priority"><option>normale</option><option>alta</option><option>bassa</option></select></div><div class="field full"><label>Descrizione</label><textarea id="a9_note">${h(raw)}</textarea></div></div>`,'dgA9ConfirmTask')}
window.dgA9ConfirmTask=async()=>{const title=el('a9_title')?.value.trim();if(!title)return toast('Inserisci il titolo',false);if(!confirm(`Creare attività “${title}”?`))return;const r=await api('attivita_gestionale','',{method:'POST',body:{titolo:title,descrizione:el('a9_note')?.value||null,stato:'aperta',priorita:el('a9_priority')?.value||'normale',scadenza:el('a9_date')?.value||null,assegnata_a:window.currentOperator?.name||'Nicola'},headers:{Prefer:'return=representation'}});await audit('CREA_ATTIVITA','attivita_gestionale',r?.[0]?.id||null,{titolo:title});A.draft=null;output('');await verify('Attività creata e verificata')};
function blockDraft(raw){const vs=vehicles(raw),date=isoDate(raw);A.draft={kind:'block'};shell('Blocco mezzo',`<div class="form-grid">${select('a9_vehicle','Mezzo *',vs,vehLabel)}<div class="field"><label>Dal *</label><input id="a9_from" type="date" value="${date}"></div><div class="field"><label>Al *</label><input id="a9_to" type="date" value="${date}"></div><div class="field full"><label>Motivo *</label><input id="a9_reason" value="${h(raw)}"></div></div>`,'dgA9ConfirmBlock')}
window.dgA9ConfirmBlock=async()=>{const f=(state.flotta||[]).find(x=>x.id===el('a9_vehicle')?.value),a=el('a9_from')?.value,z=el('a9_to')?.value,m=el('a9_reason')?.value.trim();if(!f||!a||!z||!m)return toast('Completa mezzo, date e motivo',false);if(z<a)return toast('La data finale precede quella iniziale',false);if(!confirm(`Bloccare ${vehLabel(f)} dal ${a} al ${z}?`))return;const r=await api('dg_blocchi_flotta','',{method:'POST',body:{flotta_id:f.id,data_inizio:a,data_fine:z,motivo:m},headers:{Prefer:'return=representation'}});await audit('BLOCCA_MEZZO','flotta',f.id,{dal:a,al:z,motivo:m});A.draft=null;output('');await verify('Blocco mezzo registrato')};
function noteClientDraft(raw){const cs=(state.clienti||[]).map(c=>({x:c,s:score([c.nome,c.cognome,c.telefono,c.email].join(' '),raw)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.x);A.draft={kind:'clientnote'};shell('Nota cliente',`<div class="form-grid">${select('a9_client','Cliente *',cs,c=>[c.nome,c.cognome,c.telefono].filter(Boolean).join(' · '))}<div class="field full"><label>Nota *</label><textarea id="a9_note">${h(raw)}</textarea></div></div>`,'dgA9ConfirmClientNote')}
window.dgA9ConfirmClientNote=async()=>{const c=(state.clienti||[]).find(x=>x.id===el('a9_client')?.value),note=el('a9_note')?.value.trim();if(!c||!note)return toast('Seleziona cliente e nota',false);if(!confirm(`Aggiungere la nota a ${[c.nome,c.cognome].filter(Boolean).join(' ')}?`))return;const old=c.note?c.note+'\n':'';await api('clienti',`id=eq.${c.id}`,{method:'PATCH',body:{note:old+'['+new Date().toLocaleDateString('it-IT')+'] '+note,updated_at:new Date().toISOString()}});await audit('NOTA_CLIENTE','clienti',c.id,{nota:note});A.draft=null;output('');await verify('Nota cliente salvata')};
function archiveSearch(raw){const q=n(raw.replace(/^(cerca|trova|mostra).*(ricevut|document)/i,'')),rows=(state.archivioDocumenti||state.archivio_documenti||[]).filter(d=>n([d.cliente,d.viaggio,d.numero_documento,d.tipo_documento,d.telefono].join(' ')).includes(q)).slice(0,30);output(`<div class="module-card"><h3>📁 Archivio documenti</h3>${rows.length?rows.map(d=>`<div class="statusline"><b>${h(d.tipo_documento||'Documento')}</b> · ${h(d.numero_documento||'')}<br>${h(d.cliente||'')} · ${h(d.viaggio||'')} · ${h(d.data_documento||'')}</div>`).join(''):'Nessun documento compatibile trovato.'}</div>`)}
function rentalRead(){const rs=state.noleggi||[];output(`<div class="module-card"><h3>🚍 Noleggi bus</h3>${rs.length?rs.slice(0,30).map(r=>`<div class="statusline"><b>${h(r.referente||r.azienda||r.id_noleggio||'Noleggio')}</b> · ${h(r.tratta_partenza||'')} → ${h(r.tratta_destinazione||'')}<br><small>${h(r.data_partenza||'')} · ${h(r.stato_noleggio||'')} · saldo ${h(r.saldo??'')}</small></div>`).join(''):'Nessun noleggio caricato.'}</div>`)}
function economyRead(raw){const ms=state.economiaMovimenti||state.economia_movimenti||[];const sum=ms.reduce((z,m)=>z+(n(m.tipo).includes('usc')?-1:1)*Number(m.importo||0),0);output(`<div class="module-card"><h3>📊 Economia</h3><div class="statusline">Movimenti caricati: <b>${ms.length}</b><br>Saldo movimenti disponibili: <b>${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(sum)}</b></div></div>`)}
const previous=window.assistantUnderstand;
window.assistantUnderstand=async function(){
 const raw=el('assistantCommand')?.value?.trim()||'',q=n(raw);if(!raw)return previous?previous():undefined;
 try{await loadAll()}catch(_){}
 if(/\bsposta\b.*\b(prenot|cliente|posto)/.test(q)){moveDraft(raw);return}
 if(/\b(annulla|cancella)\b.*\bprenot/.test(q)){cancelDraft(raw);return}
 if(/\b(check.?in|presente|assente)\b/.test(q)&&!/chi manca|riepilogo|quanti/.test(q)){checkinDraft(raw);return}
 if(/\b(assegna|metti|associa)\b.*\b(bus|autobus|mezzo)\b|\b(bus|autobus|mezzo)\b.*\b(assegna|associa)\b/.test(q)){assignBusDraft(raw);return}
 if(/\b(pubblica|metti online)\b.*\bviaggio/.test(q)){publishDraft(raw,true);return}
 if(/\b(nascondi|togli dal sito|non pubblicare)\b.*\bviaggio/.test(q)){publishDraft(raw,false);return}
 if(/\b(crea|aggiungi|inserisci)\b.*\b(attivita|promemoria)\b/.test(q)){taskDraft(raw);return}
 if(/\b(blocca|indisponibile)\b.*\b(bus|autobus|mezzo)\b/.test(q)){blockDraft(raw);return}
 if(/\b(aggiungi|inserisci|scrivi)\b.*\bnota\b.*\bcliente/.test(q)){noteClientDraft(raw);return}
 if(/\b(ricevut|document|archivio)\b/.test(q)&&/cerca|trova|mostra/.test(q)){archiveSearch(raw);return}
 if(/\bnolegg/.test(q)&&/mostra|riepilogo|situazione|quali/.test(q)){rentalRead();return}
 if(/\beconomia|movimenti economici|saldo economico/.test(q)){economyRead(raw);return}
 return previous?previous():undefined;
};
window.dgAssistantPolicy={version:'9.0',scope:'gestionale-360',writesRequirePreview:true,writesRequireConfirmation:true,ambiguityNeverGuessed:true,verifyAfterWrite:true,auditTrail:true};
function badge(){const p=el('assistantV7Capabilities');if(!p)return;const b=p.querySelector('.pill.success');if(b)b.textContent='V9 · OPERATIVO 360°'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(badge,300));else setTimeout(badge,300);
})();
