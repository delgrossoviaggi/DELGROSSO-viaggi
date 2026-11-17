/**
 * DELGROSSO 4.0 — authenticated Supabase Realtime Postgres Changes.
 * Lightweight Phoenix v1 JSON protocol, no external CDN/dependency.
 * This is a READ-ONLY subscription: it never executes DB mutations.
 * On connection failures the app performs scheduled authenticated full refresh.
 * Requires the server-side supabase_realtime publication, already enabled.
 */
export const WATCH_TABLES=Object.freeze([
 'viaggi','prenotazioni','prenotazione_posti','pagamenti',
 'noleggi_bus','notifiche','scadenze_gestionale'
]);
export function createLiveSync({apiUrl,key,getToken,onChange,onStatus,
 WebSocketImpl=typeof WebSocket!=='undefined'?WebSocket:null,
 setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout,
 setIntervalFn=setInterval,clearIntervalFn=clearInterval}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(apiUrl||''))throw new Error('Endpoint Realtime non valido');
 const topic='realtime:dg4-operator-sync';
 const watch=new Set(WATCH_TABLES);
 let socket=null,stopped=true,reconnectTimer=null,heartbeatTimer=null,seq=0,joinRef='',
     jwt=null,retry=0,ready=false,connectionId=0,lastStatus='';
 const status=(value)=>{
  if(lastStatus===value)return;
  lastStatus=value;
  try{onStatus?.(value)}catch{}
 };
 const send=(event,payload={},destination=topic,join=joinRef)=>{
  if(!socket||socket.readyState!==1)return false;
  try{socket.send(JSON.stringify({
   topic:destination,event,payload,ref:String(++seq),join_ref:join||undefined
  }));return true}catch{return false}
 };
 const cleanHeartbeat=()=>{
  if(heartbeatTimer!==null){clearIntervalFn(heartbeatTimer);heartbeatTimer=null}
 };
 const cleanReconnect=()=>{
  if(reconnectTimer!==null){clearTimeoutFn(reconnectTimer);reconnectTimer=null}
 };
 const schedule=()=>{
  if(stopped||reconnectTimer!==null)return;
  ready=false;status('polling');
  const pause=[1500,3000,6000,12000,30000][Math.min(retry++,4)];
  reconnectTimer=setTimeoutFn(()=>{reconnectTimer=null;void connect()},pause);
 };
 async function connect(){
  if(stopped||!WebSocketImpl)return;
  const my=++connectionId;
  if(socket){try{socket.close()}catch{}socket=null}
  try{
   jwt=await getToken?.();
   if(stopped||my!==connectionId)return;
   if(!jwt){status('offline');schedule();return}
   const endpoint=apiUrl.replace(/^https:/,'wss:')+'/realtime/v1/websocket?vsn=1.0.0&apikey='+encodeURIComponent(key);
   const ws=new WebSocketImpl(endpoint);socket=ws;
   status('connecting');ready=false;
   ws.onopen=()=>{
    if(stopped||my!==connectionId)return;
    joinRef=String(++seq);
    send('phx_join',{
     config:{
      private:false,
      broadcast:{ack:false,self:false},
      presence:{enabled:false},
      postgres_changes:WATCH_TABLES.map(table=>({event:'*',schema:'public',table}))
     },
     access_token:jwt
    },topic,joinRef);
    cleanHeartbeat();
    heartbeatTimer=setIntervalFn(async()=>{
     if(stopped||my!==connectionId)return;
     if(ws.readyState!==1){status('polling');return}
     try{
      const next=await getToken?.();
      if(!next){ws.close();return}
      if(next!==jwt){jwt=next;send('access_token',{access_token:next})}
      send('heartbeat',{},'phoenix','');
     }catch{status('polling');try{ws.close()}catch{}}
    },20000);
   };
   ws.onmessage=event=>{
    if(stopped||my!==connectionId)return;
    let msg;try{msg=JSON.parse(event.data)}catch{return}
    // Phoenix 1.0.0 JSON envelope.
    if(msg?.event==='phx_reply'&&msg.ref===joinRef){
     if(msg.payload?.status==='ok'){ready=true;retry=0;status('realtime');}
     else{ready=false;status('polling');try{ws.close()}catch{}}
     return;
    }
    if(msg?.event==='postgres_changes'&&ready){
     const table=String(msg.payload?.data?.table||msg.payload?.table||'');
     if(watch.has(table)){try{onChange?.(table)}catch{}}
     else if(!table){try{onChange?.('unknown')}catch{}}
    }
    if(msg?.event==='phx_close'||msg?.event==='phx_error'){
      ready=false;status('polling');try{ws.close()}catch{}}
    if(msg?.event==='system'&&msg.payload?.status==='error'){
      ready=false;status('polling');try{ws.close()}catch{}}
   };
   ws.onerror=()=>{if(!stopped){ready=false;status('polling')}};
   ws.onclose=()=>{
    if(my!==connectionId)return;
    cleanHeartbeat();
    ready=false;
    if(!stopped)schedule();
   };
  }catch{if(!stopped)schedule()}
 }
 return {
  start(){
   if(!stopped)return;
   stopped=false;retry=0;
   status(WebSocketImpl?'connecting':'polling');
   void connect();
  },
  stop(){
   stopped=true;connectionId++;
   cleanReconnect();cleanHeartbeat();ready=false;
   if(socket){try{socket.close()}catch{}socket=null}
   jwt=null;status('offline');
  },
  reconnect(){
   if(stopped)return;
   cleanReconnect();void connect();
  },
  status:()=>lastStatus,
  isRealtime:()=>ready,
  tables:()=>[...WATCH_TABLES]
 };
}
