/* DELGROSSO V65 - Cruscotto coda invii; nessun messaggio parte dal browser. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mount(){
 const anchor=$('dg61WaInbox')||$('dg63WhatsAppPanel');if(!anchor)return;
 if($('dg65CommsPanel'))return;
 const el=document.createElement('section');el.id='dg65CommsPanel';
 el.style.cssText='margin:16px 0;padding:16px;border:1px solid #dce5ef;border-radius:15px;background:#f5f9ff;color:#122a40';
 el.innerHTML='<h3 style="margin:0 0 7px">📨 Email automatiche · WhatsApp manuale</h3>'+
 '<p style="font-size:13px;margin:4px 0 12px">Email: la coda registra nuove prenotazioni e pagamenti; il servizio SMTP invierà automaticamente dopo attivazione e collaudo. WhatsApp: prepara il messaggio, apri la chat e invia tu manualmente; nessuna API Meta e nessun costo per messaggio API.</p>'+
 '<div id="dg65CommsStats" aria-live="polite" style="font-size:13px;line-height:1.8">Premi Aggiorna per controllare lo stato.</div>'+
 '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"><button class="btn btn-secondary" type="button" onclick="dg65RefreshComms()">↻ Aggiorna invii</button>'+
 '<button class="btn btn-secondary" type="button" onclick="dg65GroupConsent()">✓ Consenso gruppo viaggio</button><button class="btn btn-secondary" type="button" onclick="dg65RevokeGroupConsent()">Revoca consenso gruppo</button></div>'+
 '<p style="font-size:12px;color:#617187;margin-top:12px">Invito gruppo solo se il partecipante ha accettato esplicitamente e il link del viaggio è disponibile. L’adesione al gruppo resta volontaria.</p>';
 anchor.parentElement?.appendChild(el);
}
window.dg65RefreshComms=async()=>{
 mount();const target=$('dg65CommsStats');if(!target)return;
 if(typeof api!=='function'){target.textContent='Collegamento Supabase non pronto.';return;}
 target.textContent='Caricamento…';
 try{
  const data=await api('dg_comms_queue_v65','select=event_kind,channel,status,created_at,last_error&order=created_at.desc&limit=200');
  const rows=(Array.isArray(data)?data:[]).filter(x=>x.channel==='customer_email'||x.channel==='operator_email');
  const tally=(k)=>rows.filter(x=>x.status===k).length;
  const stateLabel={pending:'In attesa',processing:'In corso',submitted:'Inoltrati al fornitore',waiting_consent:'Attesa consenso',failed:'Da controllare',skipped:'Saltati'};
  const counts=Object.entries(stateLabel).map(([k,label])=>'<span style="display:inline-block;margin:0 12px 4px 0"><strong>'+label+':</strong> '+tally(k)+'</span>').join('');
  const errors=rows.filter(x=>x.status==='failed').slice(0,3).map(x=>'<div style="font-size:12px">⚠ '+esc(x.channel)+' / '+esc(x.event_kind)+': '+esc((x.last_error||'Errore fornitore').slice(0,110))+'</div>').join('');
  target.innerHTML='<div>'+counts+'</div>'+(rows.length===200?'<small>Visualizzati gli ultimi 200 eventi.</small>':'')+errors;
 }catch(e){target.textContent='Impossibile leggere la coda: '+(e.message||'verifica i permessi operatore');}
};
window.dg65GroupConsent=async()=>{
 const id=$('dg61WaBooking')?.value;
 const booking=(typeof state!=='undefined'&&state.prenotazioni||[]).find(b=>b.id===id);
 if(!booking)return alert('Seleziona prima una prenotazione nel Centro WhatsApp.');
 const trip=(state.viaggi||[]).find(v=>v.id===booking.viaggio_id);
 if(!confirm('Il cliente '+String(booking.cliente||'')+' ha espresso CONSENSO SPECIFICO all’invito nel gruppo del viaggio '+String(trip?.titolo||'')+'? Gli altri membri del gruppo potranno vedere il suo numero. Registrare solo se hai realmente ricevuto il consenso.'))return;
 try{
  const by=typeof uid==='function'?uid():null;
  await api('dg_trip_group_consents_v65','on_conflict=booking_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{booking_id:booking.id,trip_id:booking.viaggio_id,consent_source:'consenso esplicito registrato da operatore',accepted_at:new Date().toISOString(),revoked_at:null,...(by?{recorded_by:by}:{})}});
  alert('Consenso gruppo registrato. Copia il link d’invito del gruppo e invialo manualmente tramite WhatsApp Business al cliente consenziente.');
  dg65RefreshComms();
 }catch(e){alert('Consenso non registrato: '+(e.message||e))}
};
window.dg65RevokeGroupConsent=async()=>{
 const id=$('dg61WaBooking')?.value;const b=(typeof state!=='undefined'&&state.prenotazioni||[]).find(x=>x.id===id);
 if(!b)return alert('Seleziona prima una prenotazione nel Centro WhatsApp.');
 if(!confirm('Revocare il consenso al gruppo per '+String(b.cliente||'')+'? Gli inviti in attesa non saranno inviati.'))return;
 try{await api('dg_trip_group_consents_v65','booking_id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{revoked_at:new Date().toISOString()}});alert('Consenso al gruppo revocato.');dg65RefreshComms()}catch(e){alert('Revoca fallita: '+(e.message||e))}
};
const prior=window.dg61RenderWhatsApp;
if(typeof prior==='function'){window.dg61RenderWhatsApp=function(){prior.apply(this,arguments);mount()}};
let ticks=0;const timer=setInterval(()=>{mount();if(++ticks>14)clearInterval(timer)},700);
})();
