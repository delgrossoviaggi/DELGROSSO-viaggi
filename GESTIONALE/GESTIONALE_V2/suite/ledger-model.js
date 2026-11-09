/* DELGROSSO VIAGGI 2.0 — model of booking/payment provenance, read-only.
   Cents only; avoid adding amounts recorded in bookings to those in pagamenti.
   Authoritative receiver = incassato_da_user_id, with name fallback only if ID missing.
   Never attribute unlinked receipts to customers based merely on a similar name. */
(function(root){'use strict';
const str=v=>String(v??'').trim();
const norm=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const num=v=>{if(v==null||String(v).trim()==='')return 0;const n=Number(v);return Number.isFinite(n)?Math.round(n*100):null};
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((n||0)/100);
const phone=v=>{const d=str(v).replace(/\D/g,'');return d.startsWith('39')&&d.length>=11?d.slice(2):d};
const cancelled=b=>/annull|cancel|storn/i.test(str(b?.stato));
const recorded=p=>/^(registrato|confermato|pagato)$/i.test(str(p.stato));
const refund=p=>/rimbors/i.test(str(p.tipo));
const cash=v=>/^(contanti|contante|cash|denaro contante)$/i.test(norm(v));
const category=p=>{const a=str(p.metodo_pagamento),b=str(p.metodo);if(a&&b&&cash(a)!==cash(b))return 'daVerificare';const m=norm(a||b);if(!m)return 'daVerificare';return cash(m)?'contanti':'elettronici'};
function build({trips=[],bookings=[],payments=[],operators=[]}={}){
 const tripsById=new Map(trips.map(t=>[str(t.id),t])),bookById=new Map(bookings.map(b=>[str(b.id),b]));
 const byUser=new Map(operators.filter(o=>o.attivo!==false).map(o=>[str(o.user_id),norm(o.username)]));
 function owner(p){const id=str(p.incassato_da_user_id),u=id?byUser.get(id):norm(p.incassato_da);return u==='nicola'?'nicola':u==='raffaele'?'raffaele':'nonAttribuiti'}
 const rootOf=id=>{let t=tripsById.get(str(id)),hops=0;const seen=new Set();while(t&&t.bis_parent_id&&tripsById.has(str(t.bis_parent_id))&&hops++<25){if(seen.has(t.id))break;seen.add(t.id);t=tripsById.get(str(t.bis_parent_id))}return t?str(t.id):''};
 const blankTotal=()=>({contanti:0,elettronici:0,daVerificare:0,netto:0});
 const groups=new Map();
 for(const t of trips){const id=rootOf(t.id);if(!groups.has(id))groups.set(id,{id,trip:tripsById.get(id)||t,buses:[],bookings:[],movements:[],owners:{nicola:blankTotal(),raffaele:blankTotal(),nonAttribuiti:blankTotal()},totals:blankTotal(),quote:0,saldatoDallePrenotazioni:0,residuo:0,issues:[]});groups.get(id).buses.push(t)}
 for(const b of bookings){const g=groups.get(rootOf(b.viaggio_id));if(!g)continue;g.bookings.push(b);if(cancelled(b))continue;g.quote+=num(b.totale)||0;g.saldatoDallePrenotazioni+=num(b.pagato)||0;g.residuo+=Math.max(0,(num(b.totale)||0)-(num(b.pagato)||0))}
 const receipts=[],orphan=[],seen=new Set();
 for(const p of payments){const key=str(p.id);if(!key||seen.has(key)||!recorded(p))continue;seen.add(key);
  const amountRaw=num(p.importo),b=bookById.get(str(p.prenotazione_id)),sourceTrip=str(b?.viaggio_id||p.viaggio_id);
  const g=groups.get(rootOf(sourceTrip)),err=[];
  if(amountRaw===null||(!refund(p)&&amountRaw<0)){err.push('Importo non valido');continue}
  const amount=refund(p)?-Math.abs(amountRaw):amountRaw;
  const cat=category(p),person=owner(p);
  if(!str(p.incassato_da_user_id)&&!str(p.incassato_da))err.push('Operatore non indicato');
  if(p.incassato_da_user_id&&!byUser.has(str(p.incassato_da_user_id)))err.push('Operatore ID non riconosciuto');
  if(cat==='daVerificare')err.push('Metodo pagamento mancante o contrastante');
  if(b?.viaggio_id&&p.viaggio_id&&b.viaggio_id!==p.viaggio_id)err.push('Viaggio pagamento diverso da quello della prenotazione');
  if(!g)err.push('Viaggio non rintracciabile');
  const item={id:key,amount,category:cat,owner:person,cliente:str(p.cliente||b?.cliente||b?.cliente_nome)||'Cliente non identificato',bookingId:str(b?.id),customerId:str(p.cliente_id),bookingCode:str(b?.codice||b?.confirmation_number||b?.id_prenotazione),date:str(p.data_pagamento||p.created_at).slice(0,10),tipo:str(p.tipo)||'Pagamento',method:str(p.metodo_pagamento||p.metodo),receipt:str(p.receipt_number||p.ricevuta||key.slice(0,8)),bus:str(tripsById.get(sourceTrip)?.bis_numero||1),status:str(b?.stato),tripId:sourceTrip,rootId:g?.id||'',issues:err};
  if(g){g.movements.push(item);g.owners[person][cat]+=amount;g.owners[person].netto+=amount;g.totals[cat]+=amount;g.totals.netto+=amount;for(const x of err)g.issues.push(item.receipt+': '+x)}else orphan.push(item);
  receipts.push(item);
 }
 const ordered=[...groups.values()].sort((a,b)=>str(b.trip.data_partenza).localeCompare(str(a.trip.data_partenza)));
 for(const g of ordered){g.buses.sort((a,b)=>Number(a.bis_numero||1)-Number(b.bis_numero||1));g.movements.sort((a,b)=>a.date.localeCompare(b.date)||a.cliente.localeCompare(b.cliente,'it'));
  if(g.totals.netto!==g.owners.nicola.netto+g.owners.raffaele.netto+g.owners.nonAttribuiti.netto)throw Error('Errore di riconciliazione operatori');
  if(g.totals.netto!==g.totals.contanti+g.totals.elettronici+g.totals.daVerificare)throw Error('Errore di riconciliazione metodi');
 }
 return {groups:ordered,groupsById:groups,receipts,orphan,rootOf,money};
}
function clientHistory(client,{clients=[],bookings=[],payments=[],trips=[],operators=[]}={}){
 const id=str(client.id),name=norm(str(client.nome)+' '+str(client.cognome)),cp=phone(client.telefono),ce=norm(client.email);
 const numberOfClientsWithPhone=cp?clients.filter(c=>phone(c.telefono)===cp).length:0;
 const numberOfClientsWithEmail=ce?clients.filter(c=>norm(c.email)===ce).length:0;
 const numberOfClientsWithName=name?clients.filter(c=>norm(str(c.nome)+' '+str(c.cognome))===name).length:0;
 const payIds=new Set(payments.filter(p=>str(p.cliente_id)===id&&p.prenotazione_id).map(p=>str(p.prenotazione_id)));
 const matches=[];
 for(const b of bookings){const sameName=norm(b.cliente||b.cliente_nome)===name;
  const phoneMatches=cp&&phone(b.telefono)===cp&&numberOfClientsWithPhone===1;
  const emailMatches=ce&&norm(b.email)===ce&&numberOfClientsWithEmail===1;
  const explicit=payIds.has(str(b.id));
  const linked=explicit||(sameName&&(phoneMatches||emailMatches))||(sameName&&numberOfClientsWithName===1&&!phone(b.telefono)&&!norm(b.email));
  if(!linked)continue;
  const basis=explicit?'Pagamento collegato al cliente':(phoneMatches||emailMatches?'Nome e contatto corrispondenti':'Nome univoco, da verificare');
  matches.push({booking:b,basis,trip:trips.find(t=>t.id===b.viaggio_id)});
 }
 const selectedBookings=new Set(matches.map(v=>str(v.booking.id))),selected=[];const seen=new Set();
 for(const p of payments){if(!recorded(p)||seen.has(str(p.id)))continue;
  if(str(p.cliente_id)!==id&&!selectedBookings.has(str(p.prenotazione_id)))continue;
  seen.add(str(p.id));const amount=num(p.importo);
  if(amount===null||(!refund(p)&&amount<0))continue;
  const ownerId=operators.find(o=>str(o.user_id)===str(p.incassato_da_user_id)&&o.attivo!==false);
  const ownerName=ownerId?norm(ownerId.username):(!p.incassato_da_user_id?norm(p.incassato_da):'');
  const owner=['nicola','raffaele'].includes(ownerName)?ownerName:'Da attribuire';
  selected.push({id:p.id,bookingId:str(p.prenotazione_id),tripId:str(p.viaggio_id),cliente:str(p.cliente),tipo:str(p.tipo),date:str(p.data_pagamento||p.created_at).slice(0,10),amount:refund(p)?-Math.abs(amount):amount,method:str(p.metodo_pagamento||p.metodo)||'Da verificare',category:category(p),owner,receipt:str(p.receipt_number||p.ricevuta||p.id),direct: str(p.cliente_id)===id});
 }
 selected.sort((a,b)=>a.date.localeCompare(b.date));
 const total=selected.reduce((a,p)=>a+p.amount,0);const totals=matches.filter(x=>!cancelled(x.booking)).reduce((a,v)=>({quote:a.quote+(num(v.booking.totale)||0),versato:a.versato+(num(v.booking.pagato)||0)}),{quote:0,versato:0});
 return {matches,payments:selected,total,quote:totals.quote,versato:totals.versato,residuo:Math.max(0,totals.quote-totals.versato),warnings:matches.filter(m=>m.basis.includes('da verificare')).length};
}
const api={build,clientHistory,money,cents:num};root.DG2Ledger=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
