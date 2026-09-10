
(() => {
  const ready=()=>{
    const panel=document.querySelector('.brand-panel');
    if(!panel || panel.querySelector('.dg-v54-login-brand')) return;
    const brand=document.createElement('div');
    brand.className='dg-v54-login-brand';
    brand.innerHTML='<img src="./assets/logo-delgrosso-v54.png" alt="Del Grosso Viaggi & Limousine Bus">';
    const content=panel.querySelector('.brand-content') || panel;
    content.prepend(brand);
    const kicker=document.createElement('div'); kicker.className='dg-v54-login-kicker'; kicker.textContent='Gestionale professionale · 2026';
    brand.after(kicker);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready); else ready();
})();
