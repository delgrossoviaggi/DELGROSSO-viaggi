/* DELGROSSO — Contabilita' individuale, dati Supabase, centesimi interi.
 * Nessun pagamento viene creato o modificato da questo report.
 * POS e bonifici sono incassi ma non denaro fisicamente in cassa.
 */
(function(root){'use strict';
const text=x=>String(x??'').trim();
const norm=x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cents=x=>{let n=Number(x);return Number.isFinite(n)?Math.round(n*100):null};
const euro=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((Number(x)||0)/100);
const recorded=s=>/^(registrato|confermato|pagato|eseguito|completato)$/i.test(text(s));
const cash=s=>/^(contant[ei]|cash|denaro contante)$/i.test(norm(s));
const nonCash=s=>/pos|carta|bancomat|bonific|paypal|stripe|satispay|online|transfer|credito|debito/i.test(norm(s));
const refund=p=>/rimbors/i.test(norm(p.tipo));
function build({trips=[],bookings=[],payments=[],operators=[],transfers=[]}={}){
 const tripMap=new Map(trips.map(x=>[text(x.id),x]));
 const bookingMap=new Map(bookings.map(x=>[text(x.id),x]));
 const users=new Map(operators.filter(x=>x.attivo!==false).map(x=>[text(x.user_id),norm(x.username||x.nome)]));
 const roots=new Map();
 const rootId=tripId=>{const t=tripMap.get(text(tripId));return text(t?.bis_parent_id&&tripMap.has(t.bis_parent_id)?t.bis_parent_id:t?.id||tripId)};
 const owner=p=>{
  const id=text(p.incassato_da_user_id),v=id?users.get(id):norm(p.incassato_da);
  return v==='nicola'||v==='raffaele'?v:'nonAttribuiti';
 };
 const empty=()=>({cash:0,electronic:0,unknown:0,net:0,refunds:0,count:0,transferredIn:0,transferredOut:0});
 const profiles={nicola:{...empty(),key:'nicola',name:'Nicola',movements:[],trips:[]},raffaele:{...empty(),key:'raffaele',name:'Raffaele',movements:[],trips:[]},nonAttribuiti:{...empty(),key:'nonAttribuiti',name:'Da attribuire',movements:[],trips:[]}};
 const issues=[],seen=new Set();
 for(const t of trips){const id=rootId(t.id);if(!roots.has(id))roots.set(id,{id,trip:tripMap.get(id)||t,buses:[],movements:[]});roots.get(id).buses.push(t)}
 for(const p of payments){if(!p.id||seen.has(p.id))continue;seen.add(p.id);
  if(!recorded(p.stato))continue;
  const sum=cents(p.importo);
  if(sum===null||sum<0&&!refund(p)){issues.push('Importo incoerente nel movimento '+p.id);continue}
  const signed=refund(p)?-Math.abs(sum):sum;
  const bk=bookingMap.get(text(p.prenotazione_id));
  const tripId=text(bk?.viaggio_id||p.viaggio_id),rootTripId=rootId(tripId),group=roots.get(rootTripId);
  if(!group)issues.push('Movimento senza viaggio collegato: '+String(p.receipt_number||p.id));
  if(bk?.viaggio_id&&p.viaggio_id&&p.viaggio_id!==bk.viaggio_id)issues.push('Viaggio diverso sulla ricevuta '+String(p.receipt_number||p.id));
  const m1=text(p.metodo_pagamento),m2=text(p.metodo);
  if(m1&&m2&&cash(m1)!==cash(m2)&&nonCash(m1)!==nonCash(m2))issues.push('Metodi di pagamento discordanti: '+String(p.receipt_number||p.id));
  const method=m1||m2;
  const category=cash(method)?'cash':nonCash(method)?'electronic':'unknown';
  const who=owner(p);
  const row={id:p.id,who,amount:signed,refund:refund(p),category,method:method||'Non indicato',
    date:text(p.data_pagamento||p.created_at).slice(0,10),timestamp:p.created_at||p.data_pagamento,
    client:text(p.cliente||bk?.cliente||bk?.cliente_nome)||'Cliente non indicato',
    receipt:text(p.receipt_number||p.ricevuta||p.id),booking:text(bk?.codice||bk?.confirmation_number||p.prenotazione_id),
    tripId,rootTripId,trip:group?.trip?.titolo||tripMap.get(tripId)?.titolo||'Viaggio non identificato',
    bus:tripMap.get(tripId)?.bis_numero||1,people:Number(bk?.posti)||0};
  profiles[who].movements.push(row);
  group?.movements.push(row);
  const target=profiles[who];target[category]+=signed;target.net+=signed;target.count++;if(signed<0)target.refunds+=-signed;
 }
 for(const op of ['nicola','raffaele','nonAttribuiti']){
  profiles[op].movements.sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
  profiles[op].trips=[...roots.values()].map(g=>{
   const m=g.movements.filter(x=>x.who===op);
   return {id:g.id,trip:g.trip,buses:g.buses,movements:m,net:m.reduce((a,x)=>a+x.amount,0),
     cash:m.filter(x=>x.category==='cash').reduce((a,x)=>a+x.amount,0),
     electronic:m.filter(x=>x.category==='electronic').reduce((a,x)=>a+x.amount,0),
     unknown:m.filter(x=>x.category==='unknown').reduce((a,x)=>a+x.amount,0)};
  }).filter(g=>g.movements.length).sort((a,b)=>String(b.trip.data_partenza).localeCompare(String(a.trip.data_partenza)));
 }
 const operatorById=new Map(operators.map(o=>[text(o.user_id),norm(o.username||o.nome)]));
 for(const t of transfers){if(!recorded(t.stato))continue;let amount=cents(t.importo);if(amount===null||amount<=0)continue;
  const src=operatorById.get(text(t.da_operatore_user_id)),dst=operatorById.get(text(t.a_operatore_user_id));
  if(src===dst){issues.push('Trasferimento fra lo stesso operatore');continue;}
  if(profiles[src])profiles[src].transferredOut+=amount;else issues.push('Trasferimento da operatore sconosciuto');
  if(profiles[dst])profiles[dst].transferredIn+=amount;else issues.push('Trasferimento a operatore sconosciuto');
 }
 for(const x of Object.values(profiles)){
  x.inHand=x.cash+x.transferredIn-x.transferredOut;
  if(x.cash+x.electronic+x.unknown!==x.net)throw Error('Contabilita non riconciliata per '+x.name);
 }
 return {profiles,issues,counts:{paymentsSeen:seen.size,recognized:profiles.nicola.count+profiles.raffaele.count+profiles.nonAttribuiti.count}};
}
root.DG2OperatorLedger={build,euro,cents};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DG2OperatorLedger;
})(typeof window!=='undefined'?window:globalThis);
