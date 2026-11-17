/* Session sharing is limited to the same-origin Business Suite V1 authenticated operator.
   No password/key is included. V2 verifies the JWT and operator authorization server-side. */
(()=>{'use strict';
  try{
    if(window.parent===window)return; // V2 can still operate independently if intentionally opened.
    if(window.parent.location.origin!==window.location.origin)return;
    const raw=sessionStorage.getItem('dg_auth');if(!raw)return;
    const src=JSON.parse(raw);
    if(!src.access_token||!src.refresh_token||!src.user?.id)return;
    const validUntil=Number(src.expires_at||Math.floor(Date.now()/1000)+3600)*1000;
    sessionStorage.setItem('dg2_operator_session_tab_v1',JSON.stringify({token:src.access_token,
      refreshToken:src.refresh_token,expiresAt:validUntil,userId:src.user.id}));
  }catch(e){console.info('Modulo V2: sessione singola non disponibile');}
})();
/* Page navigation is handled once by the main app router, which supports every V4 module. */
