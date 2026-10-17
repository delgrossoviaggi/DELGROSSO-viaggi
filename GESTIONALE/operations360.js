
(function(){
'use strict';
const $d=id=>document.getElementById(id);
const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const safeDate=s=>{try{return new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short'})}catch{return '—'}};
// Only show image saved on the matched vehicle record; never infer from list position.
function busImage(f){const val=f?.foto_url||f?.foto_principale||f?.immagine_url||f?.immagine||f?.foto||f?.image_url||f?.photo_url||'';return typeof val==='string'&&/^(data:image\/|https?:\/\/|assets\/|\.\/)/i.test(val)?val:''}
function fleetMatch(trip){
 const s=getState(),fleet=s?.flotta||[],trips=s?.viaggi||[];
 if(!trip)return[];
 const rootId=trip.bis_parent_id||trip.id;
 const grouped=trips.filter(v=>String(v.id)===String(rootId)||String(v.bis_parent_id||'')===String(rootId)).sort((a,b)=>Number(a.bis_numero||1)-Number(b.bis_numero||1));
 return grouped.map(t=>({trip:t,bus:fleet.find(f=>String(f.id)===String(t.autobus_id))||null}));
}
function vehiclePhoto(f){const src=busImage(f);return src?`<img src="${clean(src)}" alt="Fotografia del mezzo ${clean(f.targa||'')}" loading="lazy">`:'<div class="dg360-photo-missing">Foto da associare in Flotta</div>'}

const photo='assets/dashboard-hero-static.jpg';
function poster(trip){const s=String(trip?.locandina||'');return /^(https?:\/\/|data:image\/|assets\/|\.\/)/i.test(s)?s:''}
let selectedTrip=null, selectedDate=null;
function getState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
function goSafe(page){try{if(typeof go==='function')go(page)}catch(e){console.warn('DG360 navigation',e)}}
function getTrips(){const s=getState();return (s?.viaggi||[]).filter(v=>v.data_partenza&&!/annull|cancel/i.test(String(v.stato||''))).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)))}
function getPax(trip){const s=getState();return (s?.prenotazioni||[]).filter(b=>String(b.viaggio_id)===String(trip.id)&&!/annull|cancel/i.test(String(b.stato||''))&&!b.riserva_aziendale).reduce((n,b)=>n+Number(b.posti||0),0)}
function getBuses(trip){return fleetMatch(trip)}
function seatsVisual(){let html='';for(let r=0;r<12;r++)for(let c=0;c<5;c++){html+=c===2?'<span class="dg360-seat aisle"></span>':'<span class="dg360-seat unknown"></span>'}return html}
function render(){
const page=$d('page-dashboard');if(!page||!$d('app')?.classList.contains('on'))return;
let root=$d('dg360-screen');if(!root){root=document.createElement('div');root.id='dg360-screen';page.prepend(root)}
page.classList.add('dg360-ready');
const trips=getTrips(),today=new Date(),localDay=new Date(today.toLocaleString('en-US',{timeZone:'Europe/Rome'}));
const todayKey=localDay.getFullYear()+'-'+String(localDay.getMonth()+1).padStart(2,'0')+'-'+String(localDay.getDate()).padStart(2,'0');const active=trips.filter(v=>String(v.data_partenza).slice(0,10)>=todayKey);
if(!selectedTrip||!trips.some(v=>String(v.id)===String(selectedTrip)))selectedTrip=(active[0]||trips[0])?.id||null;
const trip=trips.find(v=>String(v.id)===String(selectedTrip));
const count=(getState()?.prenotazioni||[]).filter(b=>!b.riserva_aziendale&&!/annull|cancel/i.test(String(b.stato||''))).reduce((n,b)=>n+Number(b.posti||0),0);
const group=trip?fleetMatch(trip):[];const total=group.reduce((n,x)=>n+Number(x.trip.posti_totali||0),0),booked=group.reduce((n,x)=>n+getPax(x.trip),0);
let days='';for(let i=0;i<7;i++){let d=new Date(localDay);d.setDate(localDay.getDate()+i);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const n=trips.filter(t=>String(t.data_partenza).slice(0,10)===key).length;days+=`<button class="dg360-day ${selectedDate===key?'active':''}" data-dgdate="${key}"><small>${i===0?'OGGI':d.toLocaleDateString('it-IT',{weekday:'short'}).toUpperCase()}</small><strong>${d.getDate()}</strong><small>${d.toLocaleDateString('it-IT',{month:'short'}).toUpperCase()}</small><em>${n} partenze</em></button>`}
const shown=selectedDate?trips.filter(t=>String(t.data_partenza).slice(0,10)===selectedDate):active.slice(0,7);
const cardTrips=shown.map(t=>{const pax=getPax(t),cap=Number(t.posti_totali||0);return `<button class="dg360-trip ${String(t.id)===String(selectedTrip)?'active':''}" data-dgtrip="${clean(t.id)}">${poster(t)?`<img src="${clean(poster(t))}" alt="Locandina del viaggio">`:`<span class="dg360-trip-no-poster">Locandina non caricata</span>`}<span class="detail"><b>${clean(t.titolo||t.destinazione||'Viaggio')}</b><small>${safeDate(t.data_partenza)} · ${pax} passeggeri${cap?' / '+cap+' posti':''}</small><span class="dg360-progress"><i style="width:${cap?Math.min(100,pax/cap*100):0}%"></i></span></span><span>›</span></button>`}).join('')||'<div class="dg360-empty">Nessuna partenza in questa data.</div>';
const vehicles=getBuses(trip);
const fleet=(getState()?.flotta||[]).slice(0,5).map((b,i)=>`<div class="dg360-fleet-item">${vehiclePhoto(b)}<span><b>${clean(b.nome||b.modello||b.targa||'Mezzo flotta')}</b><small>${clean(b.targa||'Targa da inserire')}</small></span></div>`).join('')||'<div class="dg360-empty">Nessun mezzo caricato.</div>';
const busCards=trip?vehicles.map(({trip:t,bus},i)=>`<div class="dg360-bus">${bus?vehiclePhoto(bus):'<div class="dg360-photo-missing">Mezzo non associato</div>'}<h4>${clean(t.bis_numero?'BUS '+t.bis_numero:'BUS 1')} · ${clean(bus?.nome||bus?.modello||'')}</h4><span class="dg360-plate">${clean(bus?.targa||'Targa non assegnata')}</span><div class="dg360-real-count"><strong>${getPax(t)}</strong> passeggeri registrati${Number(t.posti_totali||0)?' / '+Number(t.posti_totali)+' posti':''}</div><p class="dg360-caption">Piantina e posti effettivi: apri Gestione Posti BUS/BIS.</p><button class="dg360-action primary" data-dgpage="posti">Apri piantina reale ↗</button></div>`).join(''):'<div class="dg360-empty">Seleziona un viaggio.</div>';
const stopRows=trip?(getState()?.viaggiFermate||[]).filter(f=>String(f.viaggio_id)===String(trip.id)).map(f=>`<div class="dg360-stop"><span>📍 ${clean(f.nome||f.fermata||f.localita||'Fermata')}</span><span>${clean(f.ora_partenza||f.orario||'')}</span></div>`).join(''):'';
root.innerHTML=`<div class="dg360-strip"><div class="dg360-days">${days}</div><div class="dg360-summary"><h3>PROSSIME PARTENZE · DATI DEL GESTIONALE</h3><div class="dg360-metrics"><div><b>${active.length}</b><span>Viaggi futuri</span></div><div><b>${count}</b><span>Posti prenotati</span></div><div><b>${(getState()?.flotta||[]).length}</b><span>Mezzi in flotta</span></div></div></div></div>
<div class="dg360-layout"><aside><h3 class="dg360-heading">PARTENZE ${selectedDate?'DEL '+safeDate(selectedDate):'IN PROGRAMMA'}</h3>${cardTrips}<div class="dg360-box"><h3>SITUAZIONE AUTOBUS</h3><div class="inner dg360-fleet">${fleet}</div></div></aside>
<section><div class="dg360-hero">${poster(trip)?`<img src="${clean(poster(trip))}" alt="Locandina del viaggio selezionato">`:`<div class="dg360-hero-no-poster">Locandina non caricata per questo viaggio</div>`}<div class="overlay"><h1>${clean(trip?.titolo||'Centro operativo')}</h1><p>${trip?'📅 '+safeDate(trip.data_partenza)+' · '+booked+' passeggeri registrati':'Seleziona una partenza dal calendario'}</p></div></div>
<div class="dg360-tabs"><button class="active" data-dgpage="dashboard">PANORAMICA</button><button data-dgpage="controlroom">AUTOBUS E POSTI</button><button data-dgpage="prenotazioni">PASSEGGERI</button><button data-dgpage="pagamenti">PAGAMENTI</button><button data-dgpage="documenti">DOCUMENTI</button></div><div class="dg360-buses">${busCards||'<div class="dg360-empty">Nessun autobus associato al viaggio con ID o targa verificabili. Controlla le assegnazioni nella sezione Viaggi/Flotta.</div>'}</div><p class="dg360-note">I dati passeggeri sono letti dalle prenotazioni; per occupazione posto-per-posto, disponibilità e scambi apri Gestione Posti BUS/BIS.</p></section>
<aside class="dg360-right"><div class="dg360-box"><h3>TOTALE VIAGGIO</h3><div class="inner"><div class="dg360-figure"><b>${booked}${total?' / '+total:''}</b><small>Passeggeri / capienza</small></div><div class="dg360-progress"><i style="width:${total?Math.min(100,booked/total*100):0}%"></i></div><div class="dg360-figure" style="margin-top:12px"><b>${total?Math.max(0,total-booked):'—'}</b><small>Disponibili da verificare</small></div></div></div>
<div class="dg360-box"><h3>FERMATE DI SALITA</h3><div class="inner">${stopRows||'<p class="dg360-caption">Apri la Control Room per il dettaglio delle fermate e dei passeggeri.</p>'}</div></div>
<div class="dg360-box"><h3>OPERAZIONI RAPIDE</h3><div class="inner"><button class="dg360-action" data-dgpage="posti">⇄ Sposta su altro autobus</button><button class="dg360-action" data-dgpage="prenotazioni">👥 Gestisci prenotazioni</button><button class="dg360-action" data-dgpage="pagamenti">€ Registra pagamento</button><button class="dg360-action primary" data-dgpage="controlroom">✓ Check-in e Control Room</button></div></div></aside></div>`;
root.querySelectorAll('[data-dgdate]').forEach(b=>b.addEventListener('click',()=>{selectedDate=selectedDate===b.dataset.dgdate?null:b.dataset.dgdate;const matching=trips.find(t=>String(t.data_partenza).slice(0,10)===selectedDate);if(matching)selectedTrip=matching.id;render()}));
root.querySelectorAll('[data-dgtrip]').forEach(b=>b.addEventListener('click',()=>{selectedTrip=b.dataset.dgtrip;render()}));
root.querySelectorAll('[data-dgpage]').forEach(b=>b.addEventListener('click',()=>goSafe(b.dataset.dgpage)));
}
let pending=false;function schedule(){if(pending)return;pending=true;setTimeout(()=>{pending=false;try{if($d('app')?.offsetParent!==null)render()}catch(e){console.warn('DG360 visual',e)}},100)}
document.addEventListener('click',e=>{if(e.target.closest('#sideNav button[data-page="dashboard"]'))schedule()},true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
setInterval(()=>{try{if(getState()?.page==='dashboard'&&$d('app')?.offsetParent!==null){const signature=JSON.stringify([(getState()?.viaggi||[]).map(v=>[v.id,v.autobus_id,v.posti_occupati,v.locandina]).join('|'),(getState()?.prenotazioni||[]).map(v=>[v.id,v.viaggio_id,v.posti,v.stato]).join('|'),(getState()?.flotta||[]).map(v=>[v.id,v.targa,v.foto_url]).join('|')]);if(signature!==window.__dg360sig){window.__dg360sig=signature;schedule()}}}catch(e){}},4000);
schedule();
})();
