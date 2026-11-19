/* DG82 · Non invia messaggi o annulla prenotazioni dal dispositivo.
   L'eventuale stato autoritativo è dg82_booking_holds in Supabase. */
(()=>{'use strict';
const $$=id=>document.getElementById(id);
const html=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const d=s=>s?new Date(s).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}):'—';
const number=s=>String(s||'').replace(/\D/g,'');
// Concilia importi di prenotazione e movimenti contabili (acconti, saldi, rimborsi).
// Il browser fornisce solo una visualizzazione: il controllo autoritativo deve stare su Supabase.
const bookingPaid=b=>{
 const direct=Math.max(Number(b.pagato||0),Number(b.acconto||0));
 const movements=(typeof state!=='undefined'&&Array.isArray(state.pagamenti)?state.pagamenti:[])
  .filter(p=>String(p.prenotazione_id)===String(b.id));
 const net=movements.reduce((sum,p)=>sum+(String(p.tipo||'').toLowerCase().includes('rimborso')?-1:1)*Math.abs(Number(p.importo||p.pagato||0)),0);
 return direct>0||net>0;
};
const canceled=b=>/annull|cancel|eliminat|rimbors/i.test(String(b.stato||''));
function reference(b){const txt=String(b.fermata_partenza||'').toLowerCase();return /nicandr/i.test(txt)?{name:'Nicola',phone:'3662127916'}:/san\s*severo/i.test(txt)?{name:'Raffaele',phone:'3205730466'}:{name:'Da assegnare',phone:'',unknown:true};}
function template(b,v,kind,hold){const ref=reference(b),seats=String(b.posti_selezionati||b.posti||'—');let msg='';
 if(kind==='reminder') msg=`Gentile ${b.cliente||'cliente'}, ti ricordiamo che la prenotazione DELGROSSO VIAGGI per ${v} (posti: ${seats}) è in attesa dell’acconto in contanti. Sono trascorse 48 ore: hai ancora 24 ore di tolleranza, fino al ${d(hold?.expires_at)}, per contattare ${ref.name} al ${ref.phone} e concordare il versamento. Senza registrazione dell’acconto, la prenotazione potrà essere annullata e i posti liberati. Grazie!`;
 else if(kind==='release')msg=`Gentile ${b.cliente||'cliente'}, non avendo ricevuto e registrato l’acconto entro il termine comunicato, la prenotazione per ${v} è stata annullata e i posti precedentemente riservati sono stati liberati. Per una nuova disponibilità contatta DELGROSSO VIAGGI: ${ref.name}, ${ref.phone}.`;
 else msg=`Gentile ${b.cliente||'cliente'}, la tua prenotazione DELGROSSO VIAGGI per ${v} (posti: ${seats}) è stata inserita in attesa di acconto. Per confermare definitivamente i posti, contatta ${ref.name} al ${ref.phone} e versa l’acconto in contanti entro ${d(hold?.remind_at)}. Hai poi ulteriori 24 ore di tolleranza, fino al ${d(hold?.expires_at)}, secondo le condizioni accettate al momento della prenotazione.`;
 return msg;
}
function whatsapp(b,v,kind,hold){const phone=number(b.telefono);if(phone.length<9)return alert('Numero cliente mancante o non valido');if(reference(b).unknown)return alert('Assegnare prima il referente per questa fermata.');const recipient=phone.startsWith('39')?phone:'39'+phone;window.open('https://wa.me/'+recipient+'?text='+encodeURIComponent(template(b,v,kind,hold)),'_blank','noopener,noreferrer');}
let holds=null,enabled=false;
async function refresh(){const el=$$('dg82Rows');if(!el||typeof state==='undefined'||!state?.prenotazioni)return;
 let err='';try{holds=await api('dg82_booking_holds','select=*&order=created_at.desc&limit=1000');enabled=true;}catch(e){enabled=false;holds=null;err=e.message;}
 const hmap=new Map((holds||[]).map(h=>[String(h.booking_id),h]));
 const rows=state.prenotazioni.filter(b=>!b.riserva_aziendale).map(b=>({b,h:hmap.get(String(b.id)),v:state.viaggi.find(v=>String(v.id)===String(b.viaggio_id))}));
 const awaiting=rows.filter(({b,h})=>!canceled(b)&&!bookingPaid(b)&&(!h||h.status==='pending'||h.status==='grace'));
 const paid=rows.filter(({b,h})=>!canceled(b)&&(bookingPaid(b)||h?.status==='confirmed'));
 const released=rows.filter(({b,h})=>h?.status==='released');
 $$('dg82Stats').innerHTML=[[awaiting.length,'In attesa acconto'],[paid.length,'Con acconto registrato'],[released.length,'Posti liberati']].map(([n,t])=>`<div class="dg82-stat"><strong>${n}</strong><small>${t}</small></div>`).join('');
 $$('dg82Setup').textContent=enabled?'Stati ufficiali letti da Supabase. L’invio automatico WhatsApp richiede un processo server dedicato.':'Modalità compatibilità: dati derivati dalle prenotazioni. Il sistema automatico di 48+24 ore NON è ancora attivo su Supabase. '+(err?'Dettaglio: '+err:'');
 const visible=rows.filter(({b,h})=>h?.status==='released'||(!canceled(b)&&(!bookingPaid(b)||h?.status==='confirmed'))).sort((a,b)=>Number(!bookingPaid(a.b))-Number(!bookingPaid(b.b)));
 el.innerHTML=visible.slice(0,250).map(({b,h,v})=>{const paid=bookingPaid(b)||h?.status==='confirmed'||h?.status==='manual_review';const ref=reference(b);const status=h?.status==='released'?'Posti liberati':paid?'Acconto registrato':h?.status==='manual_review'?'Verifica manuale':h?.status==='grace'?'24 ore bonus':h?.status==='pending'?'Riserva 48 ore':'Attesa acconto';const color=paid?'ok':h?.status==='released'?'late':h?.status==='grace'?'warn':'';const name=v?.titolo||v?.destinazione||b.viaggio_codice||'Viaggio';const msgKind=h?.status==='released'?'release':h?.status==='grace'?'reminder':'initial';return `<tr><td><b>${html(b.cliente||b.cliente_nome||'—')}</b><div class="dg82-fine">${html(name)} · ${html(b.fermata_partenza||'—')}</div></td><td>${html(b.posti_selezionati||b.posti||'—')}</td><td><span class="dg82-tag ${color}">${html(status)}</span></td><td>${html(d(h?.expires_at||b.scadenza_acconto))}</td><td>${ref.name}<div class="dg82-fine">${ref.phone}</div></td><td><div class="dg82-contact"><button type="button" class="btn btn-secondary btn-sm" data-dg82-edit="${html(b.id)}">✏️ Modifica</button><button type="button" class="btn btn-secondary btn-sm" data-dg82-wa="${html(b.id)}" data-kind="${msgKind}">WhatsApp</button>${!paid&&h?.status!=='released'?`<button type="button" class="btn btn-primary btn-sm" data-dg82-pay="${html(b.id)}">Registra acconto</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="6">Nessuna prenotazione da gestire</td></tr>';
 el.querySelectorAll('[data-dg82-wa]').forEach(btn=>btn.addEventListener('click',()=>{const x=rows.find(x=>String(x.b.id)===btn.dataset.dg82Wa);if(x)whatsapp(x.b,x.v?.titolo||'viaggio',btn.dataset.kind,x.h)}));
 el.querySelectorAll('[data-dg82-edit]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.dg82Edit;if(id&&typeof window.dg50OpenBooking==='function')window.dg50OpenBooking(id);else if(id&&typeof window.openBookingModal==='function')window.openBookingModal(id)}));
 el.querySelectorAll('[data-dg82-pay]').forEach(btn=>btn.addEventListener('click',()=>{if(typeof openPaymentModal==='function')openPaymentModal(btn.dataset.dg82Pay)}));
}
window.dg82Refresh=refresh;
window.addEventListener('DOMContentLoaded',()=>{$$('dg82Refresh')?.addEventListener('click',()=>{if(typeof loadAll==='function')loadAll(true).then(refresh);else refresh()});setTimeout(refresh,1100);});
})();
