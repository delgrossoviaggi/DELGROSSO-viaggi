/* HOME V19: controller compatibile con la Home senza il vecchio modulo di ricerca. */
(()=>{
 const $=s=>document.querySelector(s), reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let trips=[],failed=false,refreshing=false;
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const sync=list=>{try{trips=DGTripDiscovery.filter(list||[],{today:today()})}catch{trips=list||[]}window.__dgTrips=trips;const e=$('#journeyResults');if(e)e.textContent=failed?'Aggiornamento partenze momentaneamente non disponibile.':`${trips.length} ${trips.length===1?'partenza disponibile':'partenze disponibili'}`;strip()};
 function strip(){const s=$('#nextDepartureStrip');if(!s)return;let n;try{n=trips.filter(DGTripDiscovery.available).sort((a,b)=>String(a.data_partenza||'').localeCompare(String(b.data_partenza||'')))[0]}catch{n=trips[0]}const l=s.querySelector('.departure-mark'),h=s.querySelector('strong'),a=s.querySelector('.departure-action');if(n){s.href='viaggio.html?id='+encodeURIComponent(n.id);if(l)l.textContent='PROSSIMA PARTENZA';if(h)h.textContent=`${tripTitle(n)} · ${fmtDate(n.data_partenza)}`;if(a)a.textContent='Scopri il viaggio ↗'}else{s.href='viaggi.html';if(l)l.textContent='IN CALENDARIO';if(h)h.textContent=failed?'Chiedici le prossime partenze':'Scopri le prossime partenze';if(a)a.textContent='Vedi viaggi ↗'}}
 function carousel(){
   const hero=$('#heroMedia'); if(!hero)return;
   const imgs=[...hero.querySelectorAll('img')];
   const controls=$('#heroControls'); if(controls)controls.remove();
   if(!imgs.length)return;
   let i=0,timer;
   const show=n=>{
     i=(n+imgs.length)%imgs.length;
     imgs.forEach((img,j)=>{
       img.classList.toggle('show',j===i);
       img.style.width='100%';
       img.style.height='100%';
       img.style.objectFit='cover';
       img.style.objectPosition='center';
     });
   };
   const run=()=>{
     clearInterval(timer);
     if(imgs.length>1&&!document.hidden)timer=setInterval(()=>show(i+1),5000);
   };
   document.addEventListener('visibilitychange',run);
   show(0);run();
 } function fleet(){const r=$('#fleetGrid');if(!r)return;document.querySelectorAll('[data-rail]').forEach(b=>b.onclick=()=>r.scrollBy({left:Number(b.dataset.rail)*r.clientWidth*.8,behavior:reduced.matches?'auto':'smooth'}))}
 async function start(){try{await home();failed=Boolean(window.__dgTripsError);sync(window.__dgTrips||[]);carousel();fleet()}catch(e){console.error('Home DELGROSSO',e);failed=true;sync([])}}
 async function refresh(){if(document.hidden||refreshing)return;refreshing=true;try{const x=await getGestionaleTrips();failed=false;sync(x);const g=$('#tripGrid');if(g)g.innerHTML=trips.length?trips.map(tripCard).join(''):'<div class="empty" style="grid-column:1/-1">Nessuna partenza pubblicata al momento.</div>'}catch{failed=true;sync(trips)}finally{refreshing=false}}
 start().then(()=>{window.__dgTripRefresh=refresh;setInterval(refresh,60000)});
})();