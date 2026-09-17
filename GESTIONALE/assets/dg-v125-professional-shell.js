/* DELGROSSO V125 — safe UI normalization; no polling, no observers */
(function(){
  const ready=()=>{
    document.documentElement.dataset.dgUi='v125';
    document.body.classList.add('dg-v125');
    document.querySelectorAll('table').forEach(t=>{
      if(!t.parentElement?.classList.contains('table-responsive')){
        const w=document.createElement('div');w.className='table-responsive';t.parentNode.insertBefore(w,t);w.appendChild(t);
      }
    });
    document.querySelectorAll('button,a.btn,input[type="submit"],input[type="button"]').forEach(el=>el.setAttribute('data-dg-touch','true'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
