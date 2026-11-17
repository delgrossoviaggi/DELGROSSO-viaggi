import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../GESTIONALE/v4/live-sync.js',import.meta.url),'utf8').replace(/^export /gm,'');
const {createLiveSync,WATCH_TABLES}=vm.runInNewContext(source+';({createLiveSync,WATCH_TABLES})',{
 setTimeout,clearTimeout,setInterval,clearInterval,WebSocket:undefined
});
class FakeSocket{
 static sockets=[];
 constructor(url){this.url=url;this.readyState=0;this.sent=[];FakeSocket.sockets.push(this)}
 send(s){this.sent.push(JSON.parse(s))}
 open(){this.readyState=1;this.onopen?.()}
 receive(m){this.onmessage?.({data:JSON.stringify(m)})}
 close(){this.readyState=3;this.onclose?.()}
}
async function flush(){await Promise.resolve();await Promise.resolve();await Promise.resolve()}
const setup=({token='TEST_JWT'}={})=>{
 const changed=[],statuses=[],intervals=[];
 let key=token;
 const sync=createLiveSync({
  apiUrl:'https://chkuayhbmitdmzmmvona.supabase.co',
  key:'sb_publishable_demo',getToken:async()=>key,
  onChange:(table)=>changed.push(table),onStatus:(status)=>statuses.push(status),
  WebSocketImpl:FakeSocket,
  setIntervalFn:(fn,ms)=>{intervals.push(fn);return intervals.length},
  clearIntervalFn:()=>{},
  setTimeoutFn:(fn,ms)=>{intervals.push(fn);return intervals.length},
  clearTimeoutFn:()=>{}
 });
 return {sync,changed,statuses,intervals,changeToken:(v)=>{key=v}};
};
test('Supabase realtime subscribes to all seven published operational tables with JWT, never to write methods',async()=>{
 FakeSocket.sockets.length=0;
 const s=setup();s.sync.start();await flush();
 const socket=FakeSocket.sockets.at(-1);
 assert.ok(socket.url.startsWith('wss://chkuayhbmitdmzmmvona.supabase.co/realtime/v1/websocket?'));
 socket.open();
 const join=socket.sent.find(x=>x.event==='phx_join');
 assert.equal(join.payload.access_token,'TEST_JWT');
 assert.equal(join.payload.config.postgres_changes.length,7);
 assert.deepEqual([...WATCH_TABLES],join.payload.config.postgres_changes.map(x=>x.table));
 assert.ok(join.payload.config.postgres_changes.every(x=>x.schema==='public'&&x.event==='*'));
 socket.receive({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'ok',response:{}}});
 assert.equal(s.sync.isRealtime(),true);
 socket.receive({topic:join.topic,event:'postgres_changes',payload:{data:{table:'prenotazioni',type:'INSERT'}}});
 assert.deepEqual(s.changed,['prenotazioni']);
 socket.receive({topic:join.topic,event:'postgres_changes',payload:{data:{table:'secrets'}}});
 assert.deepEqual(s.changed,['prenotazioni']);
 s.sync.stop();assert.equal(s.sync.isRealtime(),false);
});
test('Failed subscription falls back to safe polling mode',async()=>{
 FakeSocket.sockets.length=0;
 const s=setup();s.sync.start();await flush();
 const ws=FakeSocket.sockets.at(-1);ws.open();
 const join=ws.sent.find(x=>x.event==='phx_join');
 ws.receive({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'error',response:{reason:'publication unavailable'}}});
 assert.equal(s.sync.status(),'polling');
 s.sync.stop();
});
test('No WebSocket implementation uses periodic-refresh-only fallback without crashing',()=>{
 const statuses=[];const sync=createLiveSync({
 apiUrl:'https://chkuayhbmitdmzmmvona.supabase.co',key:'public',
 getToken:async()=>null,onStatus:s=>statuses.push(s),WebSocketImpl:null
 });
 sync.start();assert.equal(sync.status(),'polling');sync.stop();
});
