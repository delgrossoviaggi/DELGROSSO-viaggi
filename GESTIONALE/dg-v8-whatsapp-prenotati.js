/* DELGROSSO Business Suite V8 — Rubrica WhatsApp DIRETTA in Prenotazioni.
 * Solo i recapiti presenti in Supabase; nessuna aggiunta automatica ai gruppi WhatsApp.
 * Dati in memoria di sessione: NON inseriti in localStorage, NON inviati a terzi.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const getState=()=>typeof state!=='undefined'?state:null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=b=>b&&!b.riserva_aziendale&&!/annull|cancel|storn|rimbors/i.test(String(b.stato||''));
const trips=()=>Array.isArray(getState()?.viaggi)?getState().viaggi:[];
const bookings=()=>Array.isArray(getState()?.prenotazioni)?getState().prenotazioni:[];
const trip=id=>trips().find(v=>v.id===id);
const name=b=>String(b.cliente_nome||b.cliente||'Referente senza nome').trim();
const normalize=v=>{
 const raw=String(v||'').trim();let digits=raw.replace(/\D/g,'');
 if(!digits)return '';
 const intl=raw.startsWith('+')||digits.startsWith('00');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(!intl){
  if(/^3\d{9}$/.test(digits))digits='39'+digits; // mobile italiano
  else if(/^0\d{8,10}$/.test(digits))digits='39'+digits; // rete fissa italiana
  else if(!/^39\d{9,12}$/.test(digits))return ''; // altrimenti serve prefisso esplicito
 }
 return /^[1-9]\d{8,14}$/.test(digits)?digits:'';
};
const date=t=>{const d=String(t?.data_partenza||'').slice(0,10);return /^\d{4}-\d\d-\d\d$/.test(d)?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'Data da verificare'};
const label=t=>[t?.titolo||t?.destinazione||'Viaggio',date(t)].join(' · ');
const rootId=v=>{let x=v,seen=new Set();while(x?.bis_parent_id&&!seen.has(x.id)){seen.add(x.id);x=trip(x.bis_parent_id)||x;if(seen.has(x.id))break;}return x?.id||v?.id};
const children=id=>trips().filter(v=>rootId(v)===id&&!v.archiviato_at).sort((a,b)=>(Number(a.bis_numero||(!a.bis_parent_id?1:2))-Number(b.bis_numero||(!b.bis_parent_id?1:2))));
const busLabel=(v,group)=>'BUS '+Number(v.bis_numero||(!v.bis_parent_id?1:Math.max(2,group.indexOf(v)+1)))+(v.bis_parent_id?' · BIS':'');
const roots=()=>{
 const n=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'});
 const ids=[...new Set(trips().filter(v=>!v.archiviato_at).map(rootId))];
 return ids.map(id=>trip(id)).filter(Boolean).sort((a,b)=>{
  const sa=String(a.data_partenza||'9999-12-31'),sb=String(b.data_partenza||'9999-12-31');
  const na=sa>=n?0:1,nb=sb>=n?0:1;
  return na-nb||(na===0?sa.localeCompare(sb):sb.localeCompare(sa));
 });
};
let chosen=new Set();let latestTrip='',list=[];
const feedback=(m,error=false)=>{if($('dg8Feedback')){$('dg8Feedback').textContent=m;$('dg8Feedback').style.color=error?'#a3213b':'#175a3c';}};
function ensureOptions(){
 const select=$('dg8Trip'),bus=$('dg8Bus');if(!select||!bus)return false;
 const entries=roots(),html=entries.map(x=>'<option value="'+esc(x.id)+'">'+esc(label(x))+'</option>').join('');
 const before=select.value;
 if(select.innerHTML!==html){select.innerHTML=html;if(entries.some(x=>x.id===before))select.value=before;}
 if(!select.value&&entries.length)select.value=entries[0].id;
 const group=children(select.value);
 const options='<option value="all">Tutti i bus del viaggio</option>'+group.map(x=>'<option value="'+esc(x.id)+'">'+esc(busLabel(x,group))+'</option>').join('');
 const old=bus.value;
 if(bus.innerHTML!==options){bus.innerHTML=options;bus.value=group.some(x=>x.id===old)?old:'all';}
 if(latestTrip!==select.value){chosen.clear();latestTrip=select.value;}
 return Boolean(select.value);
}
function read(){
 if(!ensureOptions())return {items:[],missing:[],pax:0,bookingsCount:0};
 const selectedBus=$('dg8Bus').value, group=children($('dg8Trip').value).filter(x=>selectedBus==='all'||x.id===selectedBus);
 const map=new Map();const missing=[];let pax=0,bookingsCount=0;
 for(const v of group){
  for(const b of bookings().filter(x=>x.viaggio_id===v.id&&active(x))){
   bookingsCount++;pax+=Math.max(0,Number(b.posti)||0);
   const phone=normalize(b.telefono);
   if(!phone){missing.push({b,v});continue;}
   let item=map.get(phone);
   if(!item){item={phone,names:[],bus:[],stops:[],bookings:[],seats:0};map.set(phone,item);}
   if(!item.names.includes(name(b)))item.names.push(name(b));
   const bus=busLabel(v,children(rootId(v)));if(!item.bus.includes(bus))item.bus.push(bus);
   if(b.fermata_partenza&&!item.stops.includes(b.fermata_partenza))item.stops.push(b.fermata_partenza);
   item.seats+=Math.max(0,Number(b.posti)||0);item.bookings.push(b.id);
  }
 }
 return {items:[...map.values()].sort((a,b)=>a.names[0].localeCompare(b.names[0],'it')),missing,pax,bookingsCount};
}
function render(){
 if(!$('dg8PhoneList'))return;
 const ok=ensureOptions(); if(!ok){$('dg8PhoneList').innerHTML='<p class="dg8-empty">Nessun viaggio attivo disponibile. Premi Sincronizza per aggiornare i dati.</p>';$('dg8Stats').textContent='';return;}
 const res=read();list=res.items;
 const available=new Set(list.map(x=>x.phone));[...chosen].forEach(p=>{if(!available.has(p))chosen.delete(p)});
 $('dg8Stats').innerHTML='<span><strong>'+res.bookingsCount+'</strong> prenotazioni</span><span><strong>'+res.pax+'</strong> posti prenotati</span><span><strong>'+list.length+'</strong> numeri unici</span><span><strong>'+res.missing.length+'</strong> senza telefono valido</span><span><strong>'+chosen.size+'</strong> selezionati</span>';
 const items=list.map(r=>'<div class="dg8-contact"><label><input type="checkbox" data-dg8-phone="'+esc(r.phone)+'" '+(chosen.has(r.phone)?'checked':'')+' aria-label="Seleziona '+esc(r.names.join(' / '))+'"><span class="dg8-contact-main"><b>'+esc(r.names.join(' / '))+'</b><small class="dg8-number">+'+r.phone+'</small><small>'+esc(r.bus.join(', '))+' · '+r.seats+' posti · '+esc(r.stops.join(', ')||'Fermata non indicata')+'</small></span></label><div class="dg8-contact-actions"><button type="button" class="btn btn-secondary btn-sm" data-dg8-copyone="'+esc(r.phone)+'">Copia numero</button><a class="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+r.phone+'">Apri chat</a></div></div>').join('');
 const missing=res.missing.map(({b,v})=>'<div class="dg8-missing">⚠ '+esc(name(b))+' · '+esc(busLabel(v,children(rootId(v))))+' · '+Math.max(0,Number(b.posti)||0)+' posti · numero '+esc(b.telefono||'non inserito')+'</div>').join('');
 $('dg8PhoneList').innerHTML=items+missing||'<p class="dg8-empty">Nessun recapito inserito per questo viaggio.</p>';
}
function selected(){return list.filter(x=>chosen.has(x.phone))}
function copyText(text){
 if(!text){feedback('Seleziona almeno un numero prima di copiare.',true);return;}
 // First try synchronous clipboard fallback: iOS Safari may deny async clipboard in iframes/PWA.
 let done=false;
 try{
  const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(area);area.focus();area.select();
  try{done=document.execCommand('copy')}catch{}area.remove();
 }catch{}
 if(done){feedback('✅ Copiati '+text.split('\n').length+' numeri nel formato internazionale (+39).');return;}
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>feedback('✅ Copiati '+text.split('\n').length+' numeri nel formato internazionale (+39).')).catch(()=>manual(text));return;}
 manual(text);
}
function manual(text){const box=$('dg8ManualCopy'),area=$('dg8ManualText');if(!box||!area){feedback('Copia non disponibile su questo browser.',true);return;}area.value=text;box.hidden=false;area.focus();area.select();feedback('Il dispositivo non consente la copia automatica. Seleziona e copia il testo nel riquadro.',true);}
function csvName(v){return String(v||'viaggio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/gi,'_').slice(0,45);}
function vEscape(x){return String(x||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function makeVCF(){
 const current=selected(),v=trip($('dg8Trip')?.value);
 if(!current.length){feedback('Seleziona i contatti da esportare.',true);return null;}
 const vcards=current.map((x,i)=>{
  // The trip prefix helps search exactly the intended people when adding a WhatsApp group.
  const n='DG '+date(v)+' '+x.names.join(' / ');
  return ['BEGIN:VCARD','VERSION:3.0','FN:'+vEscape(n),'N:'+vEscape(n)+';;;;','TEL;TYPE=CELL:+'+x.phone,'NOTE:'+vEscape(label(v)+' | '+x.bus.join(', ')+' | '+x.seats+' posti'),'END:VCARD'].join('\r\n');
 });
 const fileName='DELGROSSO_'+csvName(v?.titolo||v?.destinazione)+'_'+csvName(date(v))+'_CONTATTI.vcf';
 return {name:fileName,content:vcards.join('\r\n')+'\r\n',count:current.length};
}
function downloadVCF(){
 const out=makeVCF();if(!out)return;
 const blob=new Blob([out.content],{type:'text/vcard;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=out.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 feedback('✅ Preparati '+out.count+' contatti. Apri il file .vcf e scegli se importarli nella rubrica; WhatsApp li renderà ricercabili se hanno un account e i permessi Contatti sono attivi.');
}
async function shareVCF(){
 const out=makeVCF();if(!out)return;
 const file=new File([out.content],out.name,{type:'text/vcard'});
 if(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})){
  try{await navigator.share({files:[file],title:'Contatti DELGROSSO - '+out.name});feedback('File VCF condiviso. Aprilo nei Contatti per importarli quando desideri.');return}
  catch(e){if(e?.name==='AbortError'){feedback('Condivisione annullata.');return}}
 }
 downloadVCF();
}
function openWA(tripId=''){
 if(typeof window.go==='function')window.go('prenotazioni');
 const pick=$('dg8Trip');
 if(tripId&&pick){
  const b=trip(tripId);const root=b?rootId(b):tripId;
  ensureOptions();
  if([...pick.options].some(o=>o.value===root))pick.value=root;
  latestTrip='';ensureOptions();
  const bus=$('dg8Bus');if(bus)bus.value=(b?.bis_parent_id&&[...bus.options].some(o=>o.value===tripId))?tripId:'all';
 }
 render();
 const target=$('dg8RosterPanel');if(target){target.scrollIntoView({behavior:'smooth',block:'start'});}
}
function attach(){
 const panel=$('dg8RosterPanel');if(!panel||panel.dataset.dg8Ready)return;
 panel.dataset.dg8Ready='true';
 $('dg8Trip')?.addEventListener('change',()=>{latestTrip='';const bus=$('dg8Bus');if(bus)bus.value='all';chosen.clear();render();});
 $('dg8Bus')?.addEventListener('change',()=>{chosen.clear();render();});
 panel.addEventListener('change',e=>{const cb=e.target.closest('input[data-dg8-phone]');if(!cb)return;cb.checked?chosen.add(cb.dataset.dg8Phone):chosen.delete(cb.dataset.dg8Phone);render()});
 panel.addEventListener('click',e=>{const b=e.target.closest('button[data-dg8-copyone]');if(b)copyText('+'+b.dataset.dg8Copyone)});
 $('dg8SelectAll')?.addEventListener('click',()=>{list.forEach(x=>chosen.add(x.phone));render()});
 $('dg8Clear')?.addEventListener('click',()=>{chosen.clear();render()});
 $('dg8CopySelected')?.addEventListener('click',()=>copyText(selected().map(x=>'+'+x.phone).join('\n')));
 $('dg8CopyAll')?.addEventListener('click',()=>copyText(list.map(x=>'+'+x.phone).join('\n')));
 $('dg8VCF')?.addEventListener('click',downloadVCF);
 $('dg8Share')?.addEventListener('click',shareVCF);
 $('dg8Reload')?.addEventListener('click',async()=>{
  feedback('Aggiornamento prenotazioni da Supabase…');try{if(typeof window.loadAll==='function')await window.loadAll(true);render();feedback('Elenco aggiornato.');}catch(e){feedback('Aggiornamento non riuscito: '+String(e?.message||e),true)}
 });
 $('dg8ManualSelect')?.addEventListener('click',()=>{$('dg8ManualText')?.select();feedback('Numeri selezionati, premi Copia sul dispositivo.')});
}
function init(){attach();render();}
window.dg8OpenWA=openWA;
window.dg8RenderWhatsApp=render;
window.dg8Test={normalize,read,makeVCF,selected,openWA};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
// Every time bookings are refreshed, refresh the list on the SAME page.
const oldRender=window.renderBookings;
if(typeof oldRender==='function'&&!oldRender.__dg8){
 const wrapped=function(){const out=oldRender.apply(this,arguments);render();return out};
 wrapped.__dg8=true;window.renderBookings=wrapped;
 try{renderBookings=wrapped}catch{}
}
})();
