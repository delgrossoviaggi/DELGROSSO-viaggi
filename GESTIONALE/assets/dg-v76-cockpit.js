import { t as tripService } from './tripService-BzTorehO.js';
import { t as bookingService } from './bookingService-CitenMQF.js';
import { t as fleetService } from './fleetService-DSMpWv9k.js';
import { t as clientService } from './clientService-CSK9V6N0.js';
import { t as quoteService } from './quoteService-sIJzU3x8.js';
import { c as paymentService } from './notificationCenterService-CaZQlods.js';

const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0);
const num = v => new Intl.NumberFormat('it-IT').format(Number(v)||0);
const isoDay = d => { const x=new Date(d); return Number.isNaN(x.getTime())?'':x.toISOString().slice(0,10); };
const today = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
const dateOf = x => String(x?.data_partenza||x?.data_servizio||'').slice(0,10);
const timeOf = x => String(x?.ora_partenza||'00:00').slice(0,5);
const peopleOf = x => Math.max(0, Number(x?.numero_persone ?? x?.passeggeri ?? x?.adulti ?? 0) || 0);
const active = x => !/annull|archiv/i.test(String(x?.stato||''));
const titleOf = x => String(x?.destinazione||x?.titolo||x?.nome||'Operazione').trim();
const busOf = x => String(x?.targa||x?.autobus||x?.mezzo||x?.modello||'Mezzo non assegnato').trim();

function inject(){
  if(document.getElementById('dgV76Cockpit')) return;
  const anchor=document.querySelector('.kpi-grid');
  if(!anchor) return;
  const section=document.createElement('section');
  section.id='dgV76Cockpit'; section.className='dg76-cockpit';
  section.innerHTML=`
    <div class="dg76-cockpit-head">
      <div><span class="eyebrow">Agenzia 2.0 · Live cockpit</span><h2>Controllo operativo</h2><p>La situazione reale dell'agenzia, aggiornata dai dati del gestionale.</p></div>
      <div class="dg76-live"><span></span><strong>LIVE</strong><small>Sincronizzato</small></div>
    </div>
    <div class="dg76-grid">
      <article class="dg76-card dg76-command"><div class="dg76-card-title"><span>⚡</span><div><strong>Azioni rapide</strong><small>Operazioni frequenti</small></div></div>
        <div class="dg76-actions">
          <a href="./prenotazione.html"><b>＋</b> Nuova prenotazione</a><a href="./viaggi.html"><b>＋</b> Nuovo viaggio</a><a href="./clienti.html"><b>＋</b> Nuovo cliente</a><a href="./noleggi-bus.html"><b>＋</b> Nuovo noleggio</a><a href="./dossier-cliente.html"><b>◉</b> Dossier cliente</a><a href="./economia.html"><b>€</b> Economia & margini</a>
        </div>
      </article>
      <article class="dg76-card dg76-occupancy"><div class="dg76-card-title"><span>🚌</span><div><strong>Carico operativo</strong><small>Partenze di oggi</small></div></div>
        <div class="dg76-meter"><div><strong id="dg76Occupancy">0%</strong><span id="dg76OccupancyMeta">0 passeggeri</span></div><div class="dg76-track"><i id="dg76OccupancyBar"></i></div></div>
        <div class="dg76-mini-stats"><span><b id="dg76Trips">0</b><small>partenze</small></span><span><b id="dg76Seats">0</b><small>passeggeri</small></span><span><b id="dg76Available">0</b><small>bus liberi</small></span></div>
      </article>
      <article class="dg76-card dg76-finance"><div class="dg76-card-title"><span>€</span><div><strong>Salute finanziaria</strong><small>Situazione prenotazioni</small></div></div>
        <div class="dg76-fin-row"><span>Incassato oggi</span><b id="dg76Collected">€ 0,00</b></div><div class="dg76-fin-row"><span>Da incassare</span><b id="dg76Due">€ 0,00</b></div><div class="dg76-fin-row"><span>Valore prenotazioni</span><b id="dg76Total">€ 0,00</b></div>
      </article>
      <article class="dg76-card dg76-timeline"><div class="dg76-card-title"><span>◷</span><div><strong>Prossime partenze</strong><small>Agenda operativa</small></div><a href="./viaggi.html">Vedi tutto →</a></div><div id="dg76Timeline" class="dg76-list"></div></article>
      <article class="dg76-card dg76-alerts"><div class="dg76-card-title"><span>◉</span><div><strong>Da tenere d'occhio</strong><small>Controlli automatici</small></div></div><div id="dg76Alerts" class="dg76-list"></div></article>
      <article class="dg76-card dg76-network"><div class="dg76-card-title"><span>✦</span><div><strong>Rete agenzia</strong><small>Panoramica commerciale</small></div></div><div class="dg76-network-grid"><div><b id="dg76Clients">0</b><span>clienti</span></div><div><b id="dg76Quotes">0</b><span>preventivi attivi</span></div><div><b id="dg76Trips7">0</b><span>viaggi · 7 giorni</span></div></div></article>
    </div>`;
  anchor.insertAdjacentElement('afterend',section);
}

function render({trips,bookings,payments,fleet,clients,quotes}){
  const now=today(), tomorrow=new Date(now); tomorrow.setDate(tomorrow.getDate()+1); const next7=new Date(now); next7.setDate(next7.getDate()+7);
  const todayTrips=trips.filter(t=>dateOf(t)===isoDay(now)&&!(/annull|archiv/i.test(String(t?.stato||''))));
  const upcoming=trips.filter(t=>{const d=dateOf(t);return d && d>=isoDay(now) && d<=isoDay(next7) && active(t)}).sort((a,b)=>`${dateOf(a)}${timeOf(a)}`.localeCompare(`${dateOf(b)}${timeOf(b)}`));
  const todayBookings=bookings.filter(b=>active(b)&&todayTrips.some(t=>String(t.id||'')===String(b.viaggio_id||b.tratta_id||'')));
  const pax=todayBookings.reduce((s,b)=>s+peopleOf(b),0);
  const capacity=todayTrips.reduce((s,t)=>s+Number(t?.posti??t?.capienza??t?.capacita??0),0);
  const occ=capacity>0?Math.min(100,Math.round(pax/capacity*100)):0;
  const total=bookings.filter(active).reduce((s,b)=>s+Number(b?.totale??b?.importo??0)||0,0);
  const paid=payments.reduce((s,p)=>s+Math.max(0,Number(p?.importo??p?.totale??0)||0),0);
  const due=Math.max(0,total-paid);
  const available=fleet.filter(f=>/dispon/i.test(String(f?.stato||''))).length;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('dg76Occupancy',`${occ}%`);set('dg76OccupancyMeta',`${num(pax)} passeggeri${capacity?` · ${num(capacity)} posti`:''}`);set('dg76OccupancyBar', '');
  const bar=document.getElementById('dg76OccupancyBar'); if(bar)bar.style.width=`${occ}%`;
  set('dg76Trips',todayTrips.length);set('dg76Seats',pax);set('dg76Available',available);set('dg76Collected',money(payments.filter(p=>String(p?.data_pagamento||p?.created_at||'').slice(0,10)===isoDay(now)).reduce((s,p)=>s+Math.max(0,Number(p?.importo||0)||0),0)));set('dg76Due',money(due));set('dg76Total',money(total));set('dg76Clients',clients.length);set('dg76Quotes',quotes.filter(q=>! /rifiut|archiv/i.test(String(q?.stato||''))).length);set('dg76Trips7',upcoming.length);
  const timeline=document.getElementById('dg76Timeline');
  if(timeline) timeline.innerHTML=upcoming.slice(0,5).map(t=>`<a class="dg76-row" href="./viaggi.html"><time>${esc(dateOf(t).split('-').reverse().slice(0,2).join('/'))}<b>${esc(timeOf(t))}</b></time><span><strong>${esc(titleOf(t))}</strong><small>${esc(busOf(t))}</small></span><em>→</em></a>`).join('')||'<div class="dg76-empty">Nessuna partenza programmata nei prossimi 7 giorni.</div>';
  const alerts=[];
  if(todayTrips.length && pax===0) alerts.push(['warning','Partenze senza passeggeri','Controlla le prenotazioni di oggi.','./prenotazioni.html']);
  if(due>0) alerts.push(['info','Incassi aperti',`${money(due)} ancora da verificare.`,`./pagamenti.html`]);
  if(fleet.length && available===0) alerts.push(['warning','Flotta impegnata','Nessun mezzo risulta disponibile.','./flotta.html']);
  if(!alerts.length) alerts.push(['success','Operatività sotto controllo','Nessun alert prioritario rilevato.','./notifiche.html']);
  const al=document.getElementById('dg76Alerts'); if(al) al.innerHTML=alerts.slice(0,4).map(a=>`<a class="dg76-alert ${a[0]}" href="${a[3]}"><i></i><span><strong>${esc(a[1])}</strong><small>${esc(a[2])}</small></span><b>→</b></a>`).join('');
}

let loadBusy=false, loadTimer=0;
async function load(){
  if(loadBusy) return;
  loadBusy=true;
  try{
    const [tr,bo,pa,fl,cl,qu]=await Promise.all([tripService.getAll(),bookingService.getAll(),paymentService.getAll(),fleetService.getAll(),clientService.getAll(),quoteService.all({tolerateMissingTable:true})]);
    const arr=x=>x?.success===false?[]:(Array.isArray(x?.data)?x.data:(Array.isArray(x)?x:[]));
    render({trips:arr(tr),bookings:arr(bo),payments:arr(pa),fleet:arr(fl),clients:arr(cl),quotes:arr(qu)});
  }catch(err){ console.warn('[DG76 cockpit]',err); }
  finally{ loadBusy=false; }
}
function init(){ inject(); load(); const refresh=()=>{clearTimeout(loadTimer);loadTimer=setTimeout(load,1500)}; [bookingService,tripService,fleetService,clientService].forEach(s=>s?.subscribe?.(refresh)); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
