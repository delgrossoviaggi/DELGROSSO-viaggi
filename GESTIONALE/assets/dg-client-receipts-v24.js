/* V24: ricevute archiviate nel fascicolo cliente */
(() => {
  const URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
  const KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
  async function get(path){ const r=await fetch(`${URL}/rest/v1/${path}`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}}); if(!r.ok) throw Error(await r.text()); return r.json(); }
  async function render(){
    const modal=document.querySelector('.client-modal'); if(!modal || getComputedStyle(modal).display==='none') return;
    const id=modal.querySelector('#cli_id')?.value; if(!id || modal.querySelector('.dg-client-receipts-v24')) return;
    const name=`${modal.querySelector('#cli_nome')?.value||''} ${modal.querySelector('#cli_cognome')?.value||''}`.trim();
    const phone=modal.querySelector('#cli_telefono')?.value||''; const email=modal.querySelector('#cli_email')?.value||'';
    const pren=await get(`prenotazioni?select=id,cliente,telefono,email,viaggio_id&order=created_at.desc`);
    const norm=s=>String(s||'').trim().toLowerCase();
    const ids=pren.filter(p=> (phone&&norm(p.telefono)===norm(phone)) || (email&&norm(p.email)===norm(email)) || (name&&norm(p.cliente)===norm(name))).map(p=>p.id);
    let payments=[]; for(const pid of ids){ const rows=await get(`pagamenti?select=id,prenotazione_id,tipo,importo,data_pagamento,receipt_number,receipt_storage_path,receipt_email_sent&prenotazione_id=eq.${encodeURIComponent(pid)}&order=data_pagamento.desc`); payments.push(...rows); }
    const box=document.createElement('section'); box.className='history-box dg-client-receipts-v24'; box.innerHTML=`<h3>Ricevute Acconto / Saldo</h3><div class="dg-receipts-list">${payments.length?payments.map(p=>`<div class="dg-receipt-row"><div><strong>${esc(p.receipt_number||'Ricevuta')}</strong><span>${esc(p.tipo||'Pagamento')} · ${esc(p.data_pagamento||'')} · ${money(p.importo)}</span></div>${p.receipt_storage_path?`<button type="button" class="btn-secondary" data-dg-receipt-path="${esc(p.receipt_storage_path)}">Apri PDF</button>`:`<small>PDF non ancora archiviato</small>`}</div>`).join(''):'<p>Nessuna ricevuta archiviata per questo cliente.</p>'}</div>`;
    const history=modal.querySelector('.history-box'); history?.appendChild(box);
  }
  const mo=new MutationObserver(()=>setTimeout(()=>render().catch(()=>{}),80));
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  window.addEventListener('dg:client-open',()=>render().catch(()=>{}));
})();
