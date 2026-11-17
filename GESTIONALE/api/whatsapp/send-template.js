/* Manual-only approved WhatsApp templates. NO automatic booking, seats, payment or PDF. */
'use strict';
const {currentOperator,rest,json,randomUUID,canonicalPhone}=require('../../lib/whatsapp-auth');
const names={confirmation:'WA_TEMPLATE_CONFIRMATION',deposit:'WA_TEMPLATE_DEPOSIT',balance:'WA_TEMPLATE_BALANCE'};
const num=x=>Number(x)||0;
const euros=x=>num(x).toFixed(2).replace('.',',')+' EUR';
function isClosed(b){return /annull|cancel|eliminat|rimbors/i.test(String(b.stato||''))}
function isConfirmed(b){return /confermat|prenotat|pagat|saldata/i.test(String(b.stato||''))}
function buildParams(b,t,v){
 const fullname=String(b.cliente||b.cliente_nome||'Cliente').trim().slice(0,140);
 const code=String(b.confirmation_number||b.codice||b.id_prenotazione||b.id).slice(0,80);
 const trip=String(v.titolo||v.destinazione||'Viaggio').slice(0,150);
 if(t==='confirmation'){
  if(!isConfirmed(b))throw Object.assign(Error('booking_not_confirmed'),{status:409});
  return [fullname,code,trip,String(b.posti||0)];
 }
 if(t==='deposit'){
  if(!(b.scadenza_acconto))throw Object.assign(Error('deposit_due_date_missing'),{status:409});
  if(num(b.acconto)>0 || num(b.pagato)>0)throw Object.assign(Error('payment_already_recorded_verify_manually'),{status:409});
  return [fullname,code,trip,String(b.scadenza_acconto).slice(0,20)];
 }
 if(t==='balance'){
  if(!(num(b.saldo)>0))throw Object.assign(Error('balance_not_due'),{status:409});
  return [fullname,code,trip,euros(b.saldo)];
 }
 throw Object.assign(Error('invalid_template_kind'),{status:400});
}
module.exports=async function(req,res){
 if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
 if(process.env.WA_AUTOMATION_ENABLED!=='true')return json(res,503,{error:'messaging_not_enabled'});
 if(!process.env.META_WA_ACCESS_TOKEN||!process.env.WA_PHONE_NUMBER_ID||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
   return json(res,503,{error:'integration_not_configured'});
 let op;try{op=await currentOperator(req)}catch(e){return json(res,e.status||503,{error:e.message})}
 const {booking_id,kind,request_id}=req.body||{};
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(booking_id||''))||!names[kind]||!
 /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(request_id||'')))return json(res,400,{error:'invalid_request'});
 const template=process.env[names[kind]];
 if(!template||!/^[a-z0-9_]{3,100}$/.test(template))return json(res,503,{error:'approved_template_not_configured'});
 let b,v,phone,params;
 try{
  b=(await rest('prenotazioni?id=eq.'+booking_id+'&select=*&limit=1'))?.[0];
  if(!b||isClosed(b)||b.riserva_aziendale)throw Object.assign(Error('booking_unavailable'),{status:409});
  v=(await rest('viaggi?id=eq.'+b.viaggio_id+'&select=id,titolo,destinazione,data_partenza,archiviato_at&limit=1'))?.[0];
  if(!v||v.archiviato_at)throw Object.assign(Error('trip_unavailable'),{status:409});
  phone=canonicalPhone(b.telefono);if(!phone)throw Object.assign(Error('invalid_customer_phone'),{status:409});
  const consent=(await rest('dg_whatsapp_optins_v61?phone=eq.'+encodeURIComponent(phone)+'&select=phone,revoked_at&limit=1'))?.[0];
  if(!consent||consent.revoked_at)throw Object.assign(Error('whatsapp_optin_required'),{status:409});
  params=buildParams(b,kind,v);
 }catch(e){return json(res,e.status||503,{error:e.message})}
 // Server-side dedupe: request_id is stable for retries, and can be sent exactly once.
 let row;
 try{
  const prior=await rest('dg_whatsapp_outbound_v62?request_id=eq.'+request_id+'&select=id,booking_id,template_kind,status&limit=1');
  if(prior.length){return json(res,409,{error:'request_already_submitted',status:prior[0].status})}
  row=(await rest('dg_whatsapp_outbound_v62',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({request_id,booking_id,template_kind:kind,recipient_phone:phone,created_by:op.user_id,status:'sending'})}))?.[0];
 }catch(e){return json(res,409,{error:'cannot_reserve_send_request'})}
 if(!row?.id)return json(res,503,{error:'send_reservation_failed'});
 const payload={messaging_product:'whatsapp',recipient_type:'individual',to:phone,type:'template',template:{name:template,language:{code:'it'},components:[{type:'body',parameters:params.map(text=>({type:'text',text:String(text)}))}]}};
 let meta=null,success=false,errorCode='';
 try{
  const response=await fetch('https://graph.facebook.com/'+(process.env.META_GRAPH_VERSION||'v23.0')+'/'+encodeURIComponent(process.env.WA_PHONE_NUMBER_ID)+'/messages',{method:'POST',headers:{Authorization:'Bearer '+process.env.META_WA_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  meta=await response.json().catch(()=>({}));success=response.ok&&Boolean(meta?.messages?.[0]?.id);
  if(!success)errorCode='meta_delivery_rejected_'+String(meta?.error?.code||response.status);
 }catch(e){errorCode='meta_request_failed'}
 // Status can still be reconciled from a Meta callback; do not re-send the same request_id.
 try{await rest('dg_whatsapp_outbound_v62?id=eq.'+row.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:success?'sent':'failed',meta_message_id:success?meta.messages[0].id:null,updated_at:new Date().toISOString(),last_error:success?null:errorCode})})}catch(e){/* preserve reservation to prevent duplicate send */}
 return json(res,success?200:502,{ok:success,error:success?null:errorCode,messageSent:success,request_id});
};
