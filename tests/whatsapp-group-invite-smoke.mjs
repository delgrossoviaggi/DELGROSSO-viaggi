import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync(new URL('../GESTIONALE/dg61-quote-whatsapp.js',import.meta.url),'utf8');
new vm.Script(js,{filename:'dg61-quote-whatsapp.js'});
const first=js.indexOf('function dg61NormalizeGroupInvite(raw){');
const last=js.indexOf('\nwindow.dg61CopyGroupLink=',first);
assert.ok(first>0&&last>first,'WhatsApp invite link normalization and save code must exist');
const uidStart=js.indexOf('const uid=()=>');
const uidEnd=js.indexOf(';',uidStart)+1;
assert.ok(uidStart>0&&uidEnd>uidStart,'Authenticated operator ID helper missing');
const code=js.slice(uidStart,uidEnd)+'\n'+js.slice(first,last);
const id='DCb6HluikWDaB123456789',valid='https://chat.whatsapp.com/'+id;
const trip='00000000-0000-4000-8000-000000000123';

function harness(apiOverride,authenticated=true){
 const inputs={
  dg61GroupTrip:{value:trip},
  dg61GroupUrl:{value:'',focus(){}}
 };
 const button={disabled:false};
 const messages=[],requests=[],state={whatsappInvites:[]};
 let reloads=0;
 const context={
  URL,console,state,
  authSession:authenticated?{user:{id:trip}}:null,
  window:{},
  $:x=>inputs[x],
  document:{
   getElementById:x=>inputs[x],
   querySelector:()=>button
  },
  toast:(message,ok)=>messages.push({message,ok}),
  api:async(table,qs,config)=>{
   requests.push({table,qs,config});
   if(apiOverride)return apiOverride(config,requests.length);
   if(!config?.method)return state.whatsappInvites.filter(x=>x.trip_id===trip);
   return [{...config.body}];
  },
  loadAll:async()=>{reloads++},
  getInvite:id=>state.whatsappInvites.find(x=>x.trip_id===id)?.invite_url||''
 };
 vm.runInNewContext(code,context);
 return {normalize:context.window.dg61NormalizeGroupInvite,save:context.window.dg61SaveGroupLink,render:context.window.dg61RenderGroupLink,inputs,button,messages,requests,state,reloads:()=>reloads};
}
const norm=harness().normalize;
for(const raw of [
 valid,
 valid+'?mode=ac_t&feature=share',
 valid+'/',
 'Unisciti al gruppo! \n'+valid+'\nClicca il link',
 'chat.whatsapp.com/'+id,
 'https://chat.whatsapp.com/invite/'+id,
 valid.slice(0,36)+'\u200B'+valid.slice(36)
])assert.equal(norm(raw),valid,'Failed to normalize valid WhatsApp link');
assert.equal(norm('https://chat.whatsapp.com/DCb6HluikWD8HBBkzSCqxk?s=cl&p=i&mlu=4&ilr=4&iam=2'),'https://chat.whatsapp.com/DCb6HluikWD8HBBkzSCqxk','Actual Napoli group link from WhatsApp share must normalize');
for(const raw of ['https://evilchat.whatsapp.com/'+id,'https://chat.whatsapp.com.evil.tld/'+id,'https://chat.whatsapp.com/short','niente link'])assert.equal(norm(raw),'','Must reject malformed/malicious links');

// Background synchronization must not clear a link pasted on iPhone.
const draft=harness();
draft.inputs.dg61GroupUrl.value='';
draft.render();
draft.inputs.dg61GroupUrl.value='Testo invito '+valid;
draft.render();
assert.equal(draft.inputs.dg61GroupUrl.value,'Testo invito '+valid,'Background sync erased the pasted invite');

const good=harness();
good.inputs.dg61GroupUrl.value='Invito al gruppo: '+valid+'?mode=ac_t';
await good.save();
assert.equal(good.requests.length,1);
assert.equal(good.requests[0].table,'dg_whatsapp_trip_invites_v61');
assert.equal(good.requests[0].config.body.invite_url,valid);
assert.equal(good.inputs.dg61GroupUrl.value,valid,'Input should show canonical URL');
assert.equal(good.state.whatsappInvites.length,1,'Saved invite must appear without waiting for refresh');
assert.equal(good.reloads(),1);
assert.equal(good.button.disabled,false);
assert.ok(good.messages.some(x=>x.message.includes('salvato correttamente')),'Show success after server confirms');

const existing=harness();
existing.state.whatsappInvites=[{trip_id:trip,invite_url:valid}];
existing.inputs.dg61GroupUrl.value=valid+'?s=cl&p=i&mlu=4&ilr=4&iam=2';
await existing.save();
assert.equal(existing.requests.length,1,'Already saved group invite should be confirmed with a read, not rewritten');
assert.ok(!existing.requests[0].config.method,'Already saved invite must not trigger an unnecessary POST');
assert.ok(existing.messages.some(x=>x.message.includes('già salvato e verificato')),'Already saved invite should show a clear success message');

const noPostBody=harness(async(config,n)=>{
 if(n===1)return [];
 return [{trip_id:trip,invite_url:valid,updated_by:trip}];
});
noPostBody.inputs.dg61GroupUrl.value=valid;
await noPostBody.save();
assert.equal(noPostBody.requests.length,2,'No POST representation must be verified with a GET');
assert.ok(noPostBody.requests[1].qs.startsWith('select=trip_id,invite_url,updated_by&trip_id=eq.'));
assert.equal(noPostBody.state.whatsappInvites.length,1,'Saved database row should confirm the invite');
assert.ok(noPostBody.messages.some(x=>x.message.includes('salvato correttamente')));

const rejected=harness(async()=>[]);
rejected.inputs.dg61GroupUrl.value=valid;
await rejected.save();
assert.equal(rejected.requests.length,2,'Missing POST representation must trigger a read-back before error');
assert.equal(rejected.state.whatsappInvites.length,0,'No unconfirmed URL should enter local state');
assert.ok(!rejected.messages.some(x=>x.message.includes('salvato correttamente')),'Never show a false success');

const invalid=harness();
invalid.inputs.dg61GroupUrl.value='https://example.org/fake';
await invalid.save();
assert.equal(invalid.requests.length,0,'Invalid links must never be sent to database');
assert.equal(invalid.button.disabled,false);

const expired=harness(null,false);
expired.inputs.dg61GroupUrl.value=valid;
await expired.save();
assert.equal(expired.requests.length,0,'No database write without a valid operator session');
assert.ok(expired.messages.some(x=>x.message.includes('Sessione scaduta')),'Show meaningful login prompt');
assert.equal(expired.button.disabled,false,'Expired login must leave button usable');

console.log('WhatsApp Business invite parsing, auth UID, persistence and failure reporting tests passed');
