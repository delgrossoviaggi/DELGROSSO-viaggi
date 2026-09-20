(function(){
  'use strict';
  // V73: keep the seat picker bound to the booking currently being edited.
  // This layer only improves UX; the authoritative write remains bookingService.
  const modal=document.getElementById('modal');
  const seatModal=document.getElementById('seatChangeModal');
  const seatBtn=document.getElementById('change-seat');
  const people=document.getElementById('num_persone');
  if(!seatModal||!seatBtn||!people) return;

  function currentCount(){
    const n=Number(people.value||0);
    return Number.isFinite(n)&&n>0?Math.floor(n):1;
  }
  function syncSeatButton(){
    if(seatBtn.classList.contains('hidden')) return;
    const n=currentCount();
    seatBtn.textContent=n>1?`🪑 Gestisci ${n} posti`:`🪑 Cambia posto`;
    seatBtn.setAttribute('aria-label',`Gestisci ${n} posti della prenotazione`);
  }
  people.addEventListener('input',syncSeatButton);
  people.addEventListener('change',syncSeatButton);
  const observer=new MutationObserver(syncSeatButton);
  observer.observe(seatBtn,{attributes:true,attributeFilter:['class']});
  syncSeatButton();

  // Prevent the universal responsive layer from treating the seat map as a generic
  // form/table. The map gets its own horizontal scroller on narrow phones.
  const style=document.createElement('style');
  style.id='dg-v73-seat-picker';
  style.textContent=`
    #seatChangeModal{z-index:5000!important;}
    #seatChangeModal .seat-change-content{min-width:0!important;}
    #seatChangeMap{width:100%;min-width:0;}
    #seatChangeMap .seat-map-container{width:100%;max-width:100%;box-sizing:border-box;}
    #seatChangeMap .seat-map-rows{width:100%;overflow-x:auto!important;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding-bottom:14px;}
    #seatChangeMap .seat-map-row{min-width:max-content;}
    #seatChangeMap .seat{flex:0 0 auto!important;cursor:pointer!important;touch-action:manipulation!important;user-select:none;-webkit-user-select:none;}
    #seatChangeMap .seat.available{cursor:pointer!important;}
    #seatChangeMap .seat.occupied,#seatChangeMap .seat:disabled{cursor:not-allowed!important;}
    @media(max-width:560px){
      #seatChangeModal{padding:8px!important;}
      #seatChangeModal .seat-change-content{padding:12px!important;max-height:calc(100dvh - 16px)!important;}
      #seatChangeMap .seat-map-container{padding:12px!important;border-radius:16px!important;}
      #seatChangeMap .seat-map-row{grid-template-columns:46px max-content!important;gap:8px!important;}
      #seatChangeMap .seat-map-row__cells{gap:6px!important;justify-content:flex-start!important;}
      #seatChangeMap .seat{width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;font-size:12px!important;}
    }
  `;
  document.head.appendChild(style);

  // If the user changes the passenger count, keep the edit form and seat picker
  // visually synchronized. Do not alter the booking or client fields here.
  const title=document.getElementById('seatChangeMeta');
  const refreshMeta=()=>{
    const n=currentCount();
    if(title) title.textContent=n===1?'Seleziona il nuovo posto dalla piantina ufficiale.':`Seleziona esattamente ${n} posti dalla piantina ufficiale.`;
  };
  people.addEventListener('input',refreshMeta);
  people.addEventListener('change',refreshMeta);
  refreshMeta();
})();
