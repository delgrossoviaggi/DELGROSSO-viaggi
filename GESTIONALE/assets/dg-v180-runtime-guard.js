/* DELGROSSO GESTIONALE V180 — runtime guard
   Non altera la logica applicativa: registra solo errori runtime/rejection per diagnosi. */
(()=>{
  const KEY='dg_runtime_last_error_v180';
  const emit=(type,detail)=>{try{window.dispatchEvent(new CustomEvent(type,{detail:{...detail,at:new Date().toISOString()}}))}catch{}};
  const save=(detail)=>{try{localStorage.setItem(KEY,JSON.stringify(detail))}catch{}};
  window.addEventListener('error',event=>{
    const detail={type:'error',message:event?.message||'Errore runtime',source:event?.filename||'',line:event?.lineno||0,column:event?.colno||0};
    save(detail); emit('dg:runtime:error',detail);
  },true);
  window.addEventListener('unhandledrejection',event=>{
    const reason=event?.reason; const detail={type:'unhandledrejection',message:reason?.message||String(reason||'Unhandled rejection')};
    save(detail); emit('dg:runtime:rejection',detail);
  });
  window.DG_RUNTIME_GUARD={version:'V180',getLastError(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}},clear(){try{localStorage.removeItem(KEY)}catch{}}};
})();
