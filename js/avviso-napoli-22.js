/* DELGROSSO — avviso sospensione Napoli 22/11/2026. Rimuovere a riorganizzazione conclusa.
   Questo avviso non agisce sul database: controllo prenotabilità già effettuato in Supabase. */
(()=>{
 const ids=new Set(['ed6881e1-e693-4f5e-b068-6ac976e7a813','2b3b83b1-0f4b-4f04-aae9-d29ea5d7800f']);
 const notice=document.createElement('aside');notice.setAttribute('role','status');notice.id='dg-napoli-22-stop';
 notice.style.cssText='max-width:1200px;margin:14px auto 22px;padding:19px 22px;background:#fff6df;color:#513817;border-left:5px solid #cc941a;border-radius:13px;box-shadow:0 6px 22px #2221';
 notice.innerHTML='<strong style="display:block;font-size:17px;color:#59370a">NAPOLI – SPACCANAPOLI · 22 NOVEMBRE 2026</strong><b style="display:block;margin:7px 0;color:#9a6210">BUS 1 + BUS BIS · TEMPORANEAMENTE NON DISPONIBILE</b><small style="font-size:13px">Prenotazioni online temporaneamente sospese per riorganizzazione dei posti. Le prenotazioni esistenti restano valide. Per informazioni contattare DELGROSSO VIAGGI.</small>';
 function show(){if(!document.getElementById(notice.id)){
  const anchor=document.querySelector('#homeTrips')||document.querySelector('.listing-section')||document.querySelector('#allTripGrid');
  if(anchor){anchor.before(notice)}else document.querySelector('main')?.prepend(notice);
 }}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
})();
