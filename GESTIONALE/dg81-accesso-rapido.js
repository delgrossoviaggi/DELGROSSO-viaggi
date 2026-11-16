/* DELGROSSO V81 - Accesso unificato a contanti viaggi V80 e PDF partenza V79.
   Non registra, non trasferisce, non modifica alcun pagamento. */
(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const enabled=()=>typeof can==='function' ? !!can('cassa','read') : false;
const iso=d=>/^\d{4}-\d{2}-\d{2}/.test(String(d||''))?`${String(d).slice(8,10)}/${String(d).slice(5,7)}/${String(d).slice(0,4)}`:'Data non disponibile';
function root(){
 if($('dg81Tools'))return $('dg81Tools');
 const el=document.createElement('section');el.id='dg81Tools';el.className='dg81-tools';
 el.innerHTML='<div class="dg81-head"><div><strong>💶 Contanti Nicola / Raffaele</strong><small>Incassi e nominativi per singolo viaggio · PDF di partenza</small></div><button type="button" id="dg81Close" aria-label="Chiudi">×</button></div>'+
 '<p class="dg81-note">I dati sono letti dai moduli del gestionale. Gli eventuali incassi non attribuiti richiedono una verifica prima della chiusura.</p>'+
 '<label for="dg81Trip">Seleziona viaggio</label><select id="dg81Trip" aria-label="Seleziona viaggio"><option value="">Caricamento viaggi…</option></select>'+
 '<div class="dg81-actions"><button type="button" id="dg81Cash">Apri cassa per viaggio</button><button type="button" id="dg81Pdf">Scarica PDF riepilogativo</button><button type="button" id="dg81Refresh">Aggiorna elenco</button></div>'+
 '<p id="dg81Status" role="status" aria-live="polite"></p>';
 document.body.appendChild(el);
 $('dg81Close').addEventListener('click',()=>el.classList.remove('dg81-open'));
 $('dg81Refresh').addEventListener('click',()=>{populate();if(typeof window.dg80RefreshCashTrips==='function')window.dg80RefreshCashTrips()});
 $('dg81Cash').addEventListener('click',()=>{
  if(!enabled())return status('Permesso di lettura Cassa non disponibile.');
  if(typeof go!=='function')return status('Navigazione gestionale non caricata.');
  go('contantiviaggi');
  if(typeof window.dg80RenderCashTrips==='function')window.dg80RenderCashTrips();
  el.classList.remove('dg81-open');
 });
 $('dg81Pdf').addEventListener('click',()=>{
  if(!enabled())return status('Permesso di lettura Cassa non disponibile.');
  const id=$('dg81Trip')?.value;
  if(!id)return status('Seleziona prima un viaggio.');
  if(typeof window.dg79DownloadTripReport!=='function')return status('Modulo PDF V79 non presente o non caricato.');
  window.dg79DownloadTripReport(id);
 });
 return el;
}
function status(message){const el=$('dg81Status');if(el)el.textContent=message;}
function populate(){
 const sel=$('dg81Trip');if(!sel)return;
 const prior=sel.value;
 const data=(typeof state!=='undefined'&&Array.isArray(state?.viaggi))?state.viaggi:[];
 const trips=data.filter(t=>!t.bis_parent_id&&!t.archiviato_at&&!/annull|cancel/i.test(String(t.stato||'')))
 .slice().sort((a,b)=>String(b.data_partenza||'').localeCompare(String(a.data_partenza||'')));
 sel.innerHTML='<option value="">Scegli un viaggio…</option>'+trips.map(t=>`<option value="${esc(t.id)}">${esc(iso(t.data_partenza))} · ${esc(t.titolo||t.destinazione||'Viaggio')}</option>`).join('');
 if(trips.some(t=>String(t.id)===prior))sel.value=prior;
 status(trips.length?`${trips.length} viaggi disponibili. Riepilogo PDF calcolato su dati aggiornati.`:'Nessun viaggio disponibile. Verifica il caricamento dei dati.');
}
function mount(){
 if($('dg81Toggle'))return;
 const btn=document.createElement('button');btn.type='button';btn.id='dg81Toggle';btn.className='dg81-toggle';btn.textContent='💶 Cassa viaggi';
 btn.addEventListener('click',()=>{
  if(!enabled())return typeof toast==='function'?toast('Accesso riservato alla Cassa.',false):alert('Accesso riservato alla Cassa.');
  const panel=root();populate();panel.classList.toggle('dg81-open');
 });
 document.body.appendChild(btn);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
