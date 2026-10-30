/* Navigazione pubblica disponibile anche se i servizi esterni non rispondono. */
(()=>{const b=document.querySelector('.mobile-toggle'),n=document.querySelector('.navlinks');
function close(){n?.classList.remove('mobile-open');b?.setAttribute('aria-expanded','false');if(b)b.textContent='☰';}
if(b&&n){n.id='main-navigation';b.setAttribute('aria-controls',n.id);b.onclick=()=>{const open=n.classList.toggle('mobile-open');b.setAttribute('aria-expanded',String(open));b.textContent=open?'✕':'☰';};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&n.classList.contains('mobile-open')){close();b.focus();}});n.addEventListener('click',e=>{if(e.target.closest('a'))close();});}
setTimeout(()=>document.querySelector('.page-loader')?.classList.add('hide'),2500);
document.querySelectorAll('[data-current-year]').forEach(e=>e.textContent=new Date().getFullYear());
})();
