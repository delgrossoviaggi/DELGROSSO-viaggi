/* DG85 · Modifica rapida sicura nella pagina Prenotazioni.
 * Non interviene nei pagamenti, non elimina prenotazioni, non modifica le piantine.
 * L'editor ufficiale DG50 salva con RPC dg_save_booking_v13, che controlla capienza e posti. */
(()=>{'use strict';
 const el=id=>document.getElementById(id);
 const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const label=b=>{
  const v=(typeof state!=='undefined'&&Array.isArray(state.viaggi)?state.viaggi:[]).find(x=>String(x.id)===String(b.viaggio_id));
  const date=String(v?.data_partenza||'').slice(0,10);
  const trip=String(v?.titolo||v?.destinazione||b.viaggio_codice||'Viaggio');
  return `${b.cliente||b.cliente_nome||'Senza nome'} · ${trip}${date?' ('+date+')':''} · ${b.posti||0} posti · ${b.codice||String(b.id).slice(0,8)}`;
 };
 function feedback(message,error=false){const x=el('dg85BookingFeedback');if(x){x.textContent=message;x.classList.toggle('error',error);}}
 function bookings(){return typeof state!=='undefined'&&Array.isArray(state.prenotazioni)?state.prenotazioni:[];}
 function refresh(){const select=el('dg85BookingSelect'),search=el('dg85BookingQuery'),button=el('dg85OpenEditor');if(!select)return;
  const prev=select.value;
  const q=normal(search?.value.trim()||'');
  const found=bookings().filter(b=>{
   if(!q)return true;
   const v=(typeof state!=='undefined'&&Array.isArray(state.viaggi)?state.viaggi:[]).find(x=>String(x.id)===String(b.viaggio_id));
   return normal([b.cliente,b.cliente_nome,b.telefono,b.codice,b.id,b.fermata_partenza,v?.titolo,v?.destinazione,v?.data_partenza].join(' ')).includes(q);
  }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const top=found.slice(0,160);
  select.replaceChildren();
  const placeholder=new Option(found.length?`Seleziona una prenotazione (${found.length}${found.length>160?', prime 160':''})`:'Nessuna prenotazione corrispondente','');
  select.add(placeholder);
  for(const b of top) select.add(new Option(label(b),String(b.id)));
  if(top.some(b=>String(b.id)===prev))select.value=prev;
  if(button)button.disabled=!select.value;
  if(found.length===0)feedback(q?'Nessuna prenotazione trovata. Verifica il nome o il codice.':'Nessuna prenotazione caricata. Effettua il login e aggiorna i dati.',!!q);
  else feedback(`${found.length} prenotazioni trovate. Seleziona il cliente e premi “Apri modifica”. Pagamenti e acconti esistenti non vengono cancellati.`);
 }
 function open(){const select=el('dg85BookingSelect'),id=String(select?.value||'');if(!id){feedback('Seleziona prima una prenotazione da modificare.',true);return}
  if(!bookings().some(b=>String(b.id)===id)){feedback('Prenotazione non più presente in elenco. Aggiorna e riprova.',true);return}
  if(typeof window.dg50OpenBooking==='function')window.dg50OpenBooking(id);
  else if(typeof window.openBookingModal==='function')window.openBookingModal(id);
  else feedback('Editor non disponibile: verifica il caricamento della pagina.',true);
 }
 window.dg85RefreshBookingPicker=refresh;
 window.dg85FocusEditor=function(){if(typeof go==='function')go('prenotazioni');const p=el('dg85BookingEditor');p?.scrollIntoView({behavior:'smooth',block:'start'});el('dg85BookingQuery')?.focus();refresh();};
 window.dg85OpenBookingEdit=id=>{if(id&&typeof window.dg50OpenBooking==='function')window.dg50OpenBooking(id);else if(id&&typeof window.openBookingModal==='function')window.openBookingModal(id);};
 document.addEventListener('DOMContentLoaded',()=>{
  el('dg85BookingQuery')?.addEventListener('input',refresh);
  el('dg85BookingSelect')?.addEventListener('change',()=>{const btn=el('dg85OpenEditor');if(btn)btn.disabled=!el('dg85BookingSelect')?.value;});
  el('dg85OpenEditor')?.addEventListener('click',open);
  el('dg85Reload')?.addEventListener('click',async()=>{try{if(typeof loadAll==='function')await loadAll(true);refresh();}catch(e){feedback('Aggiornamento non riuscito: '+(e?.message||e),true)}});
  refresh();
 });
})();
