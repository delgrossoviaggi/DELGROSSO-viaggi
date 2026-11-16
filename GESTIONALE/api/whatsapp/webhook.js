/** DELGROSSO: webhook inbound WhatsApp Cloud API. No automatic booking/seat allocation.
 * Required private Vercel env vars: WA_VERIFY_TOKEN, WA_PHONE_NUMBER_ID, META_APP_SECRET,
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Set up only after Meta Cloud API / Coexistence onboarding.
 */
const crypto = require('node:crypto');

function respond(res, status, body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
async function rawBody(req){const chunks=[];let len=0;for await(const chunk of req){len+=chunk.length;if(len>262144)throw Error('Payload too large');chunks.push(chunk);}return Buffer.concat(chunks);}
module.exports = async function handler(req,res){
 if(req.method==='GET'){
  const query=req.query||{};
  if(query['hub.mode']==='subscribe'&&query['hub.verify_token']&&process.env.WA_VERIFY_TOKEN&&query['hub.verify_token']===process.env.WA_VERIFY_TOKEN){
   res.statusCode=200;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(String(query['hub.challenge']||''));return;
  }
  return respond(res,403,{error:'verification_failed'});
 }
 if(req.method!=='POST')return respond(res,405,{error:'method_not_allowed'});
 const secret=process.env.META_APP_SECRET,base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||!base||!key||!process.env.WA_PHONE_NUMBER_ID)return respond(res,503,{error:'integration_not_configured'});
 let raw;
 try{raw=await rawBody(req)}catch{return respond(res,413,{error:'oversized_payload'})}
 const signature=String(req.headers['x-hub-signature-256']||'');
 const calc='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
 if(signature.length!==calc.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(calc)))return respond(res,403,{error:'invalid_signature'});
 let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch{return respond(res,400,{error:'invalid_json'})}
 if(payload.object!=='whatsapp_business_account')return respond(res,200,{ok:true,ignored:true});
 const records=[];
 for(const entry of payload.entry||[]){for(const change of entry.changes||[]){
  const value=change.value||{};
  if(String(value.metadata?.phone_number_id||'')!==String(process.env.WA_PHONE_NUMBER_ID))continue;
  // Reconcile delivery/read/failure receipts without storing message contents.
  for(const st of value.statuses||[]){
    const remote=String(st.id||'');
    const mapped={sent:'sent',delivered:'delivered',read:'read',failed:'failed'}[st.status];
    if(!remote||!mapped)continue;
    try{
      const url=base.replace(/\/$/,'')+'/rest/v1/dg_whatsapp_outbound_v62?meta_message_id=eq.'+encodeURIComponent(remote);
      await fetch(url,{method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:mapped,updated_at:new Date().toISOString()})});
    }catch{ /* Meta will retry; delivery state can be inspected in Meta */ }
  }
  for(const m of value.messages||[]){
   // Ignore non-text types until an explicit media/document workflow is integrated.
   const from=String(m.from||'').replace(/\D/g,'');if(!m.id||from.length<10||from.length>15)continue;
   const text=String(m.text?.body||m.button?.text||m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||(m.type==='audio'?'[Messaggio audio da verificare]':m.type==='image'?'[Immagine da verificare]':'[Messaggio da verificare]')).slice(0,4000);
   const name=(value.contacts||[]).find(c=>c.wa_id===from)?.profile?.name||null;
   const intent=/prenot|posti|gita|viaggio|disponib/i.test(text)?'richiesta_prenotazione':/acconto|saldo|pagato|versat|bonifico/i.test(text)?'pagamento':'da_esaminare';
   records.push({wa_message_id:m.id,sender_phone:from,sender_name:name?String(name).slice(0,150):null,message_text:text,intent,status:'da_esaminare',received_at: /^[0-9]{10}$/.test(String(m.timestamp))?new Date(Number(m.timestamp)*1000).toISOString():new Date().toISOString()});
  }
 }}
 if(records.length){
  const url=base.replace(/\/$/,'')+'/rest/v1/dg_whatsapp_inbox_v61?on_conflict=wa_message_id';
  const response=await fetch(url,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(records)});
  if(!response.ok)return respond(res,503,{error:'storage_failed'});
 }
 return respond(res,200,{ok:true,received:records.length});
};
module.exports.config={api:{bodyParser:false}};
