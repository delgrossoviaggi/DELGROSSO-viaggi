/* DELGROSSO — riconciliazione contanti: calcoli in centesimi, nessuna scrittura.
   Compatibile con regole operative V80: BUS BIS, rimborsi, movimenti senza attribuzione,
   trasferimenti interni esclusi dagli incassi, metodo POS distinto da contanti. */
(function(root){'use strict';
const txt=x=>String(x??'').trim();
const normal=x=>txt(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cents=x=>{const v=Number(x);return Number.isFinite(v)?Math.round(v*100):null};
const euro=x=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((x||0)/100);
const isCash=x=>/^(contanti|contante|cash|denaro contante)$/i.test(normal(x));
const isRecorded=p=>/^(registrato|confermato|pagato)$/i.test(txt(p.stato));
const isRefund=p=>/rimbors/i.test(txt(p.tipo));
const isCancelled=b=>/annull|cancel|storn|rimbors/i.test(txt(b?.stato));
function build({trips=[],bookings=[],payments=[],operators=[],cashTransfers=[]}={}){
 const tripMap=new Map(trips.map(t=>[txt(t.id),t])),bookMap=new Map(bookings.map(b=>[txt(b.id),b]));
 const operById=new Map(operators.filter(o=>o.attivo!==false).map(o=>[txt(o.user_id),normal(o.username)]));
 const idNicola=operators.find(o=>normal(o.username)==='nicola')?.user_id||'';
 const idRaffaele=operators.find(o=>normal(o.username)==='raffaele')?.user_id||'';
 const roots=new Map(),issues=[],movements=[],seen=new Set();let excludedMethods=0;
 const rootOf=t=>t?(t.bis_parent_id&&tripMap.has(t.bis_parent_id)?t.bis_parent_id:t.id):'';
 for(const trip of trips){const id=rootOf(trip);if(!roots.has(id))roots.set(id,{id,trip:tripMap.get(id)||trip,buses:[],movements:[],nicola:0,raffaele:0,nonAttribuiti:0,netto:0,received:0,refunds:0});roots.get(id).buses.push(trip)}
 const totals={nicola:0,raffaele:0,nonAttribuiti:0,netto:0,received:0,refunds:0};
 const owner=p=>{const byId=operById.get(txt(p.incassato_da_user_id));const name=byId||(!p.incassato_da_user_id?normal(p.incassato_da):'');return name==='nicola'?'nicola':name==='raffaele'?'raffaele':'nonAttribuiti'};
 for(const p of payments){if(!p.id||seen.has(p.id))continue;seen.add(p.id);if(!isRecorded(p))continue;
  const m1=txt(p.metodo_pagamento),m2=txt(p.metodo);
  if(m1&&m2&&isCash(m1)!==isCash(m2)){issues.push('Metodi contrastanti sulla ricevuta '+txt(p.receipt_number||p.id));continue}
  if(!isCash(m1||m2)){excludedMethods++;continue}
  const raw=cents(p.importo);if(raw===null||(!isRefund(p)&&raw<0)){issues.push('Importo non valido sul movimento '+txt(p.id));continue}
  const amount=isRefund(p)?-Math.abs(raw):raw,b=bookMap.get(txt(p.prenotazione_id));
  const targetId=txt(b?.viaggio_id||p.viaggio_id),rootId=rootOf(tripMap.get(targetId)),group=roots.get(rootId);
  if(b?.viaggio_id&&p.viaggio_id&&b.viaggio_id!==p.viaggio_id)issues.push('Movimento '+p.id+' collegato a viaggio diverso dalla prenotazione.');
  const who=owner(p);
  const record={id:p.id,rootId:group?.id||'',owner:who,amount,refund:isRefund(p),cliente:txt(p.cliente||b?.cliente||b?.cliente_nome)||'Cliente non identificato',date:txt(p.data_pagamento||p.created_at).slice(0,10),receipt:txt(p.receipt_number||p.ricevuta),booking:txt(b?.codice||b?.confirmation_number||b?.id_prenotazione),bookingStatus:isCancelled(b)?'Prenotazione annullata':'',bus:tripMap.get(targetId)?.bis_numero||1,stop:txt(b?.fermata_partenza),tipo:txt(p.tipo)||'Pagamento'};
  if(!group)issues.push('Pagamento contante senza viaggio collegabile: '+p.id);
  else{group.movements.push(record);group[who]+=amount;group.netto+=amount;if(amount>=0)group.received+=amount;else group.refunds-=amount}
  totals[who]+=amount;totals.netto+=amount;if(amount>=0)totals.received+=amount;else totals.refunds-=amount;
  movements.push(record);
 }
 const transfers={nicola:0,raffaele:0,unresolved:0,records:[]};
 for(const t of cashTransfers){if(!/^(confermato|eseguito|completato|registrato)$/i.test(txt(t.stato)))continue;
  const amount=cents(t.importo);if(amount===null||amount<=0||!t.da_operatore_user_id||!t.a_operatore_user_id||t.da_operatore_user_id===t.a_operatore_user_id){issues.push('Trasferimento interno non valido');continue}
  const src=t.da_operatore_user_id===idNicola?'nicola':t.da_operatore_user_id===idRaffaele?'raffaele':'unresolved';
  const dst=t.a_operatore_user_id===idNicola?'nicola':t.a_operatore_user_id===idRaffaele?'raffaele':'unresolved';
  transfers[src]-=amount;transfers[dst]+=amount;transfers.records.push({id:t.id,from:src,to:dst,amount,date:txt(t.data_trasferimento||t.created_at).slice(0,10)});
 }
 if(totals.nicola+totals.raffaele+totals.nonAttribuiti!==totals.netto)throw Error('Somma contanti non riconciliata');
 if(transfers.nicola+transfers.raffaele+transfers.unresolved!==0)throw Error('Trasferimenti interni non riconciliati');
 const groups=[...roots.values()].sort((a,b)=>txt(b.trip.data_partenza).localeCompare(txt(a.trip.data_partenza)));
 groups.forEach(g=>{g.buses.sort((a,b)=>Number(a.bis_numero||1)-Number(b.bis_numero||1));g.movements.sort((a,b)=>a.date.localeCompare(b.date)||a.cliente.localeCompare(b.cliente))});
 return {groups,totals,movements,unresolved:movements.filter(r=>!r.rootId),transfers,excludedMethods,issues:[...new Set(issues)],inCaricoViaggi:{nicola:totals.nicola+transfers.nicola,raffaele:totals.raffaele+transfers.raffaele,nonAttribuiti:totals.nonAttribuiti+transfers.unresolved}};
}
root.DG2Cash={build,cents,euro};if(typeof module!=='undefined'&&module.exports)module.exports=root.DG2Cash;
})(typeof window!=='undefined'?window:globalThis);
