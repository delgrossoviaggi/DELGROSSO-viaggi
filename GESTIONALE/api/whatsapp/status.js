/* Does not expose any key, token or ID. No external messages. */
'use strict';
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 res.setHeader('Cache-Control','no-store');
 const inbound=Boolean(process.env.WA_VERIFY_TOKEN&&process.env.META_APP_SECRET&&process.env.WA_PHONE_NUMBER_ID&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
 const outbound=Boolean(inbound&&process.env.META_WA_ACCESS_TOKEN&&process.env.WA_AUTOMATION_ENABLED==='true'&&process.env.WA_TEMPLATE_CONFIRMATION&&process.env.WA_TEMPLATE_DEPOSIT&&process.env.WA_TEMPLATE_BALANCE);
 return res.status(200).json({inboundReady:inbound,outboundReady:outbound,mode:outbound?'manual_templates_enabled':inbound?'webhook_ready':'awaiting_meta_connection',outboundRequiresOperatorConfirmation:true});
};
