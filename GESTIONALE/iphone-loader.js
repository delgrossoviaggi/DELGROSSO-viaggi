(async function(){
  'use strict';
  const msg=(t)=>{const e=document.getElementById('dgbootmsg');if(e)e.textContent=t};
  try{
    // Clean only old DELGROSSO Gestionale caches. Do not touch Supabase/session data.
    if('serviceWorker' in navigator){
      try{
        const regs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.filter(r=>(r.scope||'').includes('/GESTIONALE/')).map(r=>r.unregister()));
      }catch(_){}
    }
    if(window.caches){
      try{
        const keys=await caches.keys();
        await Promise.all(keys.filter(k=>/^delgrosso-gestionale-/i.test(k)).map(k=>caches.delete(k)));
      }catch(_){}
    }

    msg('Caricamento interfaccia…');
    const res=await fetch('./index.html?iphone_safe=9&t='+Date.now(),{cache:'no-store',credentials:'same-origin'});
    if(!res.ok) throw new Error('Impossibile caricare index.html ('+res.status+')');
    let html=await res.text();

    // Extract inline/external scripts BEFORE Safari parses the original document.
    // This prevents raw JS/template strings from ever becoming visible page text.
    const scripts=[];
    html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,function(all,attrs,code){
      const src=(attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
      scripts.push({src,code,attrs});
      return '<!-- dg-iphone-script-'+(scripts.length-1)+' -->';
    });

    const parsed=new DOMParser().parseFromString(html,'text/html');

    // Keep this loader's document, but import the real head/body without scripts.
    document.title=parsed.title||'DELGROSSO Gestionale';
    [...parsed.head.children].forEach(el=>{
      if(el.tagName==='TITLE'||el.tagName==='META'&&el.getAttribute('charset')) return;
      document.head.appendChild(document.importNode(el,true));
    });
    document.body.innerHTML=parsed.body.innerHTML;

    // Belt-and-braces: scripts must never be rendered as text on iOS.
    const guard=document.createElement('style');
    guard.textContent='script{display:none!important;visibility:hidden!important}';
    document.head.appendChild(guard);

    msg('Avvio funzioni…');

    // Execute scripts in original order, separately from HTML parsing.
    for(const s of scripts){
      await new Promise((resolve,reject)=>{
        const el=document.createElement('script');
        if(s.src){
          try{ el.src=new URL(s.src,location.href).href; }catch(_){ el.src=s.src; }
          el.onload=resolve; el.onerror=()=>reject(new Error('Errore script '+s.src));
        }else{
          const blob=new Blob([s.code+'\n//# sourceURL=delgrosso-inline.js'],{type:'text/javascript'});
          const u=URL.createObjectURL(blob);
          el.src=u;
          el.onload=()=>{URL.revokeObjectURL(u);resolve()};
          el.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Errore JavaScript del gestionale'))};
        }
        document.body.appendChild(el);
      });
    }

    // If login/app code expects DOMContentLoaded/load, replay safe lifecycle events.
    try{document.dispatchEvent(new Event('DOMContentLoaded',{bubbles:true}))}catch(_){}
    try{window.dispatchEvent(new Event('load'))}catch(_){}
  }catch(err){
    document.body.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#061a2d;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:24px"><div style="max-width:420px;background:#fff;color:#10233a;padding:24px;border-radius:20px"><h2>Avvio iPhone non riuscito</h2><p>'+String(err.message||err).replace(/[<>&]/g,'')+'</p><button onclick="location.reload()" style="width:100%;padding:14px;border:0;border-radius:12px;background:#0878e5;color:#fff;font-weight:800">Riprova</button></div></div>';
  }
})();