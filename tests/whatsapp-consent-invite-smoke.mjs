import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../GESTIONALE/dg68-gruppi-viaggio.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'dg68-gruppi-viaggio.js'});
const trip='6b420176-e5b5-4195-81b8-beb83f7bdc47';
const booking='00000000-0000-4000-8000-000000000124';
const phone='393208888888';
const inviteUrl='https://chat.whatsapp.com/DCb6HluikWD8HBBkzSCqxk';
const operatorId='00000000-0000-4000-8000-000000000999';
const fields={};
for(const id of ['page-whatsapp','dg68Root','dg68Bus','dg68Roster','dg68Stats','dg68Msg']){
 fields[id]={id,innerHTML:'',value:'',dataset:{},style:{},handlers:{},
  classList:{contains:()=>false},
  addEventListener(type,fn){this.handlers[type]=fn}};
}
fields.dg68Root.value=trip;
fields.dg68Bus.value=trip;
const clicks=[];
const document={
 readyState:'loading',
 getElementById:id=>fields[id]||null,
 addEventListener(){},
 body:{appendChild(){}},
 createElement:()=>({href:'',click(){clicks.push(this.href)},remove(){}})
};
const state={
 viaggi:[{id:trip,titolo:'NAPOLI & SPACCANAPOLI 29/11/2026',data_partenza:'2026-11-29',bis_numero:1}],
 prenotazioni:[{id:booking,viaggio_id:trip,cliente_nome:'Cliente test',telefono:'3208888888',posti:2}],
 notifiche:[],
 whatsappInvites:[{trip_id:trip,invite_url:inviteUrl}]
};
const calls=[];
let agrees=true,legacyRefreshes=0;
const window={dg61RenderWhatsApp(){},dg63Render(){legacyRefreshes++},confirm(){return agrees}};
const api=async(table,params,options)=>{
 calls.push({table,params,options});
 if(options?.method==='POST')return [{...options.body}];
 return [];
};
vm.runInNewContext(source,{state,document,window,api,authSession:{user:{id:operatorId}},Date,console});
window.dg68RefreshTripGroups();
for(let i=0;i<8;i++)await Promise.resolve();
const roster=()=>fields.dg68Roster.innerHTML;
const writes=()=>calls.filter(x=>x.options?.method==='POST');
const trigger=dataset=>fields['page-whatsapp'].handlers.click({target:{closest:()=>({dataset})}});
assert.ok(legacyRefreshes>0,'Old WhatsApp customer list must refresh after consent load');
assert.ok(!roster().includes('data-dg68-request='),'Optional link invitation should not force a second consent request');
assert.ok(roster().includes('data-dg68-consent='),'Record consent action must be available');
assert.ok(roster().includes('data-dg68-invite='),'Voluntary group link invite must be available without recorded consent');
assert.equal(writes().length,0);
trigger({dg68Invite:trip+'|'+phone});
assert.equal(clicks.length,1,'Voluntary group invite should open one manual WhatsApp chat');
assert.ok(decodeURIComponent(clicks[0]).includes(inviteUrl),'Voluntary invite must include the saved bus link');
assert.ok(decodeURIComponent(clicks[0]).includes('facoltativa'),'Group invitation must disclose that joining is optional');
assert.equal(writes().length,0,'Sending a voluntary link must never fabricate a consent record');

trigger({dg68Request:trip+'|'+phone});
assert.equal(clicks.length,2,'Optional explicit consent request should still be available to operators');
assert.ok(decodeURIComponent(clicks[1]).includes('rispondi SI'),'Optional consent request must ask for an explicit reply');
assert.ok(!decodeURIComponent(clicks[1]).includes(inviteUrl),'Separate consent request must not include the link');
assert.equal(writes().length,0,'Asking must not mark consent in database');

agrees=false;
trigger({dg68Consent:trip+'|'+phone});
for(let i=0;i<6;i++)await Promise.resolve();
assert.equal(writes().length,0,'Canceling record must not write a consent');

agrees=true;
trigger({dg68Consent:trip+'|'+phone});
for(let i=0;i<10;i++)await Promise.resolve();
assert.equal(writes().length,1,'Record consent only after affirmative operator confirmation');
assert.equal(writes()[0].table,'dg_trip_group_consents_v65');
assert.equal(writes()[0].options.body.booking_id,booking);
assert.equal(writes()[0].options.body.trip_id,trip);
assert.equal(writes()[0].options.body.recorded_by,operatorId);
assert.ok(roster().includes('data-dg68-invite='),'Invitation must be enabled after confirmed consent');

trigger({dg68Invite:trip+'|'+phone});
assert.equal(clicks.length,3,'A fresh manual invitation can be reopened after consent was recorded');
assert.ok(decodeURIComponent(clicks[2]).includes(inviteUrl),'Invitation must keep the correct bus invite URL');
state.whatsappOptins=[{phone:'3208888888',revoked_at:'2026-11-03T10:00:00Z'}];
window.dg68RefreshTripGroups();
assert.ok(roster().includes('Contatto WhatsApp revocato'),'Opted-out customers must be visibly marked');
const beforeRevokedClick=clicks.length;
trigger({dg68Invite:trip+'|'+phone});
assert.equal(clicks.length,beforeRevokedClick,'Direct invocation must also block a revoked WhatsApp contact');
state.whatsappOptins=[];
state.whatsappInvites=[];
window.dg68RefreshTripGroups();
assert.ok(roster().includes('Salva prima il link del gruppo'),'Invitation without a matching bus link must be disabled');
assert.ok(!source.includes("if(!person||!consentsLoaded||!person.bookings.some"),'Voluntary link invitation must not require prior group membership consent');
assert.ok(source.includes('if(revokedWhatsApp(tel))'),'Explicitly revoked WhatsApp contact must remain blocked');

const legacy=readFileSync(new URL('../GESTIONALE/dg63-whatsapp-gratis.js',import.meta.url),'utf8');
new vm.Script(legacy,{filename:'dg63-whatsapp-gratis.js'});
assert.ok(legacy.includes("function hasGroupConsent(b)"),'Legacy WhatsApp view must check trip-specific consent');
assert.ok(legacy.includes("'Invita con link'"),'Legacy customer list must offer an optional link');
assert.ok(legacy.includes("(invite&&revokedWhatsApp(b))"),'Manual preview must block revoked WhatsApp contacts');
const legacyStart=legacy.indexOf('window.dg63InviteBooking=id=>{');
const legacyEnd=legacy.indexOf('\nwindow.dg63CopyGroupTitle=',legacyStart);
assert.ok(legacyStart>=0&&legacyEnd>legacyStart,'Legacy invitation handler not found');
async function runLegacyInvitation(consent){
 let focused=0,opened=0;
 const w={
  dg68FocusGroupConsent(id,tid){assert.equal(id,booking);assert.equal(tid,trip);focused++},
  dg63SelectBooking(){},
  dg63OpenChat(){opened++},
  toast(){}
 };
 const b={id:booking,viaggio_id:trip};
 vm.runInNewContext(legacy.slice(legacyStart,legacyEnd),
  {window:w,booking:()=>b,revokedWhatsApp:()=>false,hasGroupConsent:()=>consent,state:{whatsappInvites:[{trip_id:trip,invite_url:inviteUrl}]}});
 w.dg63InviteBooking(booking);
 return {focused,opened};
}
const before=await runLegacyInvitation(false);
assert.equal(before.focused,0,'Voluntary link invitation must not force a consent screen');
assert.equal(before.opened,1,'Legacy view must allow manual link invitation before recording consent');
const after=await runLegacyInvitation(true);
assert.equal(after.focused,0);
assert.equal(after.opened,1,'Legacy view should enable manual invitation after consent');
console.log('Old and new WhatsApp invitation views are consistent');

console.log('Napoli voluntary WhatsApp group invite and optional recorded consent workflow passed');
