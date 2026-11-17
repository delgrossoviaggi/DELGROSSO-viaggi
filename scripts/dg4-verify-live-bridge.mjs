// DG4: public, read-only integration test of the ACTUAL site <-> Supabase bridge.
// This script does not create bookings, payments, messages, or edits.
import assert from 'node:assert/strict';
const URL='https://bhsanrbadsqcpbtxupmr.supabase.co/functions/v1/gestionale-bridge';
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function call(action,payload={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:controller.signal});
  let json;try{json=await res.json()}catch{throw new Error(action+' returned invalid JSON (HTTP '+res.status+')')}
  if(!res.ok||json?.error)throw new Error(action+' HTTP '+res.status+' '+String(json?.error||''));
  return json;
 }finally{clearTimeout(timer)}
}
const healthController=new AbortController();
const health=await fetch(URL+'?health=1',{signal:healthController.signal});
assert.equal(health.status,200,'Bridge health endpoint is not responding');
const trips=await call('trips');
assert.ok(Array.isArray(trips),'Public trips response must be an array');
assert.ok(trips.length>0,'Expected a nonempty public catalog: inspect Supabase publication flags');
for(const trip of trips){
 assert.match(trip.data_partenza,/^\d{4}-\d{2}-\d{2}$/,'Unexpected trip date');
 assert.ok(trip.data_partenza>=today,'Expired trip leaked to public site');
 assert.ok(!trip.archiviato_at,'Archived trip leaked to public site');
 assert.ok(trip.pubblicato==='SI','Unpublished trip leaked to public site');
}
const trip=trips[0];
const seats=await call('booked-seats',{viaggioId:trip.active_viaggio_id||trip.id});
assert.ok(Array.isArray(seats),'Booked-seat lookup is not an array');
const layout=await call('bus-layout',{viaggioId:trip.active_viaggio_id||trip.id});
assert.ok(layout && typeof layout==='object','Official layout lookup returned invalid data');
const stops=await call('trip-stops',{viaggioId:trip.active_viaggio_id||trip.id});
assert.ok(Array.isArray(stops),'Trip-stop lookup must be an array');
console.log(JSON.stringify({healthy:true,dateRome:today,publicTrips:trips.length,sampledSeatRecords:seats.length,sampledStopNames:stops.length,layoutObject:true,writeOperations:0}));
