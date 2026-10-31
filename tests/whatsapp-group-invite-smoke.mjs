import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync(new URL('../GESTIONALE/dg61-quote-whatsapp.js',import.meta.url),'utf8');
new vm.Script(js,{filename:'dg61-quote-whatsapp.js'});
const first=js.indexOf('function dg61NormalizeGroupInvite(raw){');
const last=js.indexOf('\nwindow.dg61CopyGroupLink=',first);
assert.ok(first>0&&last>first,'WhatsApp invite link normalization and save code must exist');
const code=js.slice(first,last);
const id='DCb6HluikWDaB123456789',valid='https://chat.whatsapp.com/'+id;
const trip='00000000-0000-4000-8000-000000000123';

function harness(apiOverride){
 const inputs={
  dg61GroupTrip:{value:trip},
  dg61GroupUrl:{value:'',focus(){}}
 };
 const button={disabled:false};
 const messages=[],requests=[],state={whatsappInvites:[]};
 let reloads=0;
 const context={
  URL,console,state,
  window:{},
  document:{
   getElementById:x=>inputs[x],
   querySelector:()=>button
  },
  toast:(message,ok)=>messages.push({message,ok}),
  uid:()=>trip,
  api:async(table,qs,config)=>{
   requests.push({table,qs,config});
   if(apiOverride)return apiOverride(config,requests.length);
   return [{...config.body}];
  },
  loadAll:async()=>{reloads++},
  getInvite:()=>''
 };
 vm.runInNewContext(code,context);
 return {normalize:context.window.dg61NormalizeGroupInvite,save:context.window.dg61SaveGroupLink,inputs,button,messages,requests,state,reloads:()=>reloads};
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
for(const raw of ['https://evilchat.whatsapp.com/'+id,'https://chat.whatsapp.com.evil.tld/'+id,'https://chat.whatsapp.com/short','niente link'])assert.equal(norm(raw),'','Must reject malformed/malicious links');

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

const rejected=harness(async()=>[]);
rejected.inputs.dg61GroupUrl.value=valid;
await rejected.save();
assert.equal(rejected.requests.length,1);
assert.equal(rejected.state.whatsappInvites.length,0,'No unconfirmed URL should enter local state');
assert.ok(!rejected.messages.some(x=>x.message.includes('salvato correttamente')),'Never show a false success');

const invalid=harness();
invalid.inputs.dg61GroupUrl.value='https://example.org/fake';
await invalid.save();
assert.equal(invalid.requests.length,0,'Invalid links must never be sent to database');
assert.equal(invalid.button.disabled,false);
console.log('WhatsApp Business invite parsing, persistence and failure reporting tests passed');
