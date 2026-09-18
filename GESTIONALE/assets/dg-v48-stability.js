/* DELGROSSO GESTIONALE V48 — stability / navigation / deployment guard */
(()=>{
  'use strict';
  if(window.__DG_V48_STABILITY__) return;
  window.__DG_V48_STABILITY__=true;
  const isLogin=/\/(?:login|index)\.html$/i.test(location.pathname);
  const safe=(fn)=>{try{return fn()}catch(_){return null}};
  const toast=(msg,kind='warn')=>{
    let el=document.getElementById('dgV48StabilityToast');
    if(!el){el=document.createElement('div');el.id='dgV48StabilityToast';el.className='dg-v48-stability-toast';document.body?.appendChild(el)}
    el.dataset.kind=kind;el.textContent=msg;el.classList.add('show');
    clearTimeout(window.__dgV48ToastTimer);window.__dgV48ToastTimer=setTimeout(()=>el.classList.remove('show'),6500);
  };
  const pageKey=()=>location.pathname.split('/').pop()||'dashboard.html';
  const report=(type,error)=>{
    const msg=String(error?.message||error||'Errore imprevisto');
    console.error('[DG V48]',type,error);
    if(/ResizeObserver loop|Script error\.?$/i.test(msg)) return;
    if(document.body) toast(`Componente: ${type}. ${msg.slice(0,180)}`,'error');
  };
  window.addEventListener('error',e=>report(e.filename?`JS ${e.filename.split('/').pop()}`:'Pagina',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>{report('operazione',e.reason);});
  // Keep the deployed app from being trapped by an old service-worker cache.
  if('serviceWorker' in navigator && !isLogin){
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
      safe(()=>reg.update());
      navigator.serviceWorker.addEventListener?.('message',()=>{});
    }).catch(()=>{});
  }
  // If a legacy sidebar exists, keep the V41 unified shell authoritative.
  const normalizeShell=()=>{
    if(document.getElementById('dg-shell-v41')){
      document.body.classList.add('dg-v48-shell-active');
      document.querySelectorAll('body>.app-shell>.sidebar').forEach(x=>x.setAttribute('aria-hidden','true'));
    }
  };
  const ensureNoleggiFallback=()=>{
    const nav=document.querySelector('.sidebar-nav');
    if(!nav || nav.querySelector('a[href*="noleggi-bus.html"]')) return;
    const a=document.createElement('a');a.className='nav-link';a.href='./noleggi-bus.html';a.innerHTML='<span class="nav-icon" aria-hidden="true">🚌</span>Noleggi Bus';
    const ref=[...nav.querySelectorAll('a')].find(a=>/Centro Operativo/i.test(a.textContent||''));
    (ref||nav.lastElementChild)?.insertAdjacentElement(ref?'afterend':'beforebegin',a) || nav.appendChild(a);
  };
  const init=()=>{normalizeShell();ensureNoleggiFallback();};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  setTimeout(init,500);setTimeout(init,1500);
  // Prevent accidental double submission on plain HTML forms while preserving retry after failure.
  document.addEventListener('submit',e=>{
    const form=e.target;if(!(form instanceof HTMLFormElement))return;
    if(form.dataset.dgSubmitting==='1') { e.preventDefault(); return; }
    form.dataset.dgSubmitting='1';
    const btn=form.querySelector('button[type="submit"]');
    if(btn){btn.dataset.dgOldDisabled=btn.disabled?'1':'0';btn.disabled=true;}
    setTimeout(()=>{form.dataset.dgSubmitting='';if(btn)btn.disabled=btn.dataset.dgOldDisabled==='1';},12000);
  },true);
  // Soft navigation guard: don't leave the app with a blank page because of an accidental hash-only link.
  document.addEventListener('click',e=>{
    const a=e.target.closest?.('a[href="#"]');
    if(a){e.preventDefault();}
  },true);
})();
