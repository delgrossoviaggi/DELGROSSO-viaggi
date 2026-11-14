/* DELGROSSO VIAGGI · Anteprima OFFLINE dei cambi data, per test e demo.
 * In produzione la scelta ufficiale viene RICALCOLATA dal database dopo i lock.
 * Nessuna operazione finanziaria viene eseguita dal browser senza RPC.
 */
(function(root, build){
  const api=build();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DGMoveCore=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  function validInt(n){return Number.isSafeInteger(Number(n))&&Number(n)>0}
  function seats(raw){
    const arr=(Array.isArray(raw)?raw:String(raw||'').split(',')).map(x=>String(x).trim()).filter(Boolean);
    if(arr.some(x=>!/^[1-9][0-9]*$/.test(x)))throw Error('Il numero dei sedili non è valido');
    const nums=arr.map(Number);if(new Set(nums).size!==nums.length)throw Error('Sedili duplicati');
    return nums;
  }
  function rng(seed){let hash=2166136261;for(const ch of String(seed)){hash=Math.imul(hash^ch.charCodeAt(0),16777619)}
    return ()=>{hash^=hash<<13;hash^=hash>>>17;hash^=hash<<5;return ((hash>>>0)/4294967296)};}
  function plan({bookingId,targetTripId,passengers,capacity,targetBookings=[],targetSeatRows=[],oldSeats=[]}){
    const pax=Number(passengers),cap=Number(capacity);
    if(!validInt(pax)||!validInt(cap)||cap>100||pax>cap)throw Error('Numero passeggeri o capienza non valida');
    const taken=new Set();let people=0;let invalid=false;
    const active=new Set();
    for(const b of targetBookings){if(/annull|cancel|cancell/i.test(String(b.stato||'')))continue;
      active.add(b.id);people+=Number(b.posti||0);
      try{for(const n of seats(b.posti_selezionati||''))taken.add(n)}catch{invalid=true;}
    }
    for(const row of targetSeatRows){if(active.has(row.prenotazione_id)){
      try{for(const n of seats(row.posto))taken.add(n)}catch{invalid=true;}
    }}
    if(invalid||taken.size!==people)throw Error('Posti storici del nuovo viaggio non riconciliati');
    if(people+pax>cap)throw Error('Posti insufficienti nel nuovo viaggio');
    const free=[];for(let n=1;n<=cap;n++)if(!taken.has(n))free.push(n);
    if(free.length<pax)throw Error('Posti liberi insufficienti');
    const original=seats(oldSeats);
    if(original.length===pax&&original.every(n=>n<=cap&&!taken.has(n))){
      return {newSeats:original.slice().sort((a,b)=>a-b),oldSeats:original,preserved:true,passengers:pax};
    }
    const random=rng(String(bookingId)+':'+String(targetTripId)),runs=[];
    for(let start=1;start+pax-1<=cap;start++){
      let ok=true;for(let s=start;s<start+pax;s++)if(taken.has(s)){ok=false;break;}
      if(ok)runs.push(start);
    }
    let result;
    if(runs.length){let start=runs[Math.floor(random()*runs.length)];result=Array.from({length:pax},(_,i)=>start+i)}
    else {result=free.map(n=>({n,score:random()})).sort((a,b)=>a.score-b.score).slice(0,pax).map(x=>x.n).sort((a,b)=>a-b)}
    if(result.length!==pax||result.some(x=>taken.has(x)))throw Error('La riassegnazione non è completa');
    return {newSeats:result,oldSeats:original,preserved:false,passengers:pax};
  }
  return Object.freeze({seats,plan});
});
