/* V38 — readable booking table enhancement. Does not change stored data. */
(() => {
  'use strict';
  const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
  const KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
  const headers={apikey:KEY,Authorization:`Bearer ${KEY}`};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const shortId=id=>{const s=String(id||''); return s.length>12?`ID-${s.slice(0,8).toUpperCase()}`:s;};
  const dateIt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('it-IT');};
  let trips=new Map();
  async function loadTrips(){
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/viaggi?select=id,titolo,destinazione,codice,data_partenza&limit=2000`,{headers});
      if(!r.ok)return;
      const data=await r.json(); (Array.isArray(data)?data:[]).forEach(t=>trips.set(String(t.id),t));
    }catch(e){console.warn('[V38] Impossibile caricare nomi viaggi',e);}
  }
  function enhance(){
    const body=document.querySelector('#bookingTable tbody'); if(!body)return;
    body.querySelectorAll('tr[data-id]').forEach(row=>{
      const id=row.dataset.id||'';
      const cells=row.children; if(cells.length<4)return;
      const code=(cells[0].textContent||'').trim();
      if(!code || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(code)){cells[0].innerHTML=`<span class="dg-booking-code" title="${esc(id)}">${esc(shortId(id))}</span>`;}
      const link=cells[2]?.querySelector('a');
      const tripId=link?.getAttribute('href')?.match(/[?&]trip=([^&]+)/)?.[1] || '';
      const t=trips.get(decodeURIComponent(tripId));
      if(link&&t){
        const name=t.titolo||t.destinazione||t.codice||shortId(tripId);
        link.textContent=name;
        link.title=`${t.titolo||''}${t.destinazione?` · ${t.destinazione}`:''}`;
      }else if(link){
        const txt=(link.textContent||'').trim();
        if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(txt))link.textContent=shortId(txt);
      }
      if(cells[3]) cells[3].textContent=dateIt(cells[3].textContent.trim());
    });
  }
  function init(){
    loadTrips().finally(()=>{enhance();const target=document.querySelector('#bookingTable tbody');if(target)new MutationObserver(enhance).observe(target,{childList:true,subtree:true});});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
