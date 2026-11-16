/* Server-only Supabase authentication for WhatsApp integration. */
'use strict';
const {randomUUID}=require('node:crypto');
const base=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const service=()=>String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const rest=async(path,options={})=>{
 const r=await fetch(base()+'/rest/v1/'+path,{...options,headers:{apikey:service(),Authorization:'Bearer '+service(),'Content-Type':'application/json',Accept:'application/json',...(options.headers||{})}});
 const txt=await r.text();let data;try{data=txt?JSON.parse(txt):null}catch{data=txt};
 if(!r.ok){const e=Error('Supabase request failed: '+r.status);e.status=r.status;throw e};return data;
};
const json=(res,code,body)=>{res.status(code).setHeader('Cache-Control','no-store').json(body)};
async function currentOperator(req){
 if(!base()||!service())throw Object.assign(Error('server_not_configured'),{status:503});
 const token=/^Bearer (\S+)$/i.exec(String(req.headers.authorization||''))?.[1];
 if(!token)throw Object.assign(Error('authorization_required'),{status:401});
 const user=await fetch(base()+'/auth/v1/user',{headers:{apikey:service(),Authorization:'Bearer '+token},cache:'no-store'});
 if(!user.ok)throw Object.assign(Error('invalid_session'),{status:401});
 const u=await user.json();if(!u?.id)throw Object.assign(Error('invalid_session'),{status:401});
 const ops=await rest('operatori_gestionale?user_id=eq.'+encodeURIComponent(u.id)+'&select=user_id,username,nome,ruolo,attivo&limit=1');
 const op=ops?.[0];
 if(!op||!op.attivo||op.ruolo!=='admin'||!['nicola','raffaele'].includes(String(op.username).toLowerCase()))
  throw Object.assign(Error('operator_not_authorized'),{status:403});
 return op;
}
const canonicalPhone=value=>{let s=String(value||'').replace(/\D/g,'');if(s.length===10)s='39'+s;return /^\d{11,15}$/.test(s)?s:null};
module.exports={currentOperator,rest,json,base,service,randomUUID,canonicalPhone};
