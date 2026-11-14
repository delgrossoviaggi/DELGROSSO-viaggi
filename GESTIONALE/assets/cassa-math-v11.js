/* DELGROSSO 3.0 v1.1 - matematica finanziaria senza IO: centesimi, zero doppi conteggi. */
(function(g){'use strict';
 function cents(value){const x=Number(value);if(!Number.isFinite(x))throw Error('Importo non valido');return Math.round((x+Number.EPSILON)*100)}
 function money(x){return Math.round(x)/100}
 const num=x=>Number.isFinite(Number(x))?Number(x):0;
 const cash=s=>/contant|\bcash\b/i.test(String(s||''));
 const active=s=>!/(annull|storn|cancel)/i.test(String(s||''));
 function preview({operatorId,date,closures=[],ledger=[],transfers=[]}){
   if(!operatorId||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Operatore o data non valida');
   const all=(closures||[]).filter(x=>x.operatore_user_id===operatorId).sort((a,b)=>String(b.data_chiusura).localeCompare(String(a.data_chiusura)));
   const previous=all.find(x=>String(x.data_chiusura)<date)||null;
   const existing=all.find(x=>String(x.data_chiusura)===date)||null;
   const from=previous?String(previous.data_chiusura):'1900-01-01';
   let income=0,outgo=0,unmapped=0;
   for(const x of ledger||[]){
     if(x.operatore_user_id!==operatorId||!cash(x.metodo)||String(x.data_movimento)<=from||String(x.data_movimento)>date)continue;
     const n=Math.abs(cents(x.importo));
     if(/entrata/i.test(x.tipo))income+=n;
     else if(/uscita|rimborso/i.test(x.tipo))outgo+=n;
     else unmapped++;
   }
   let transIn=0,transOut=0;
   for(const t of transfers||[]){
     if(!/^confermato$/i.test(String(t.stato||''))||String(t.data_trasferimento)<=from||String(t.data_trasferimento)>date)continue;
     if(t.a_operatore_user_id===operatorId)transIn+=cents(t.importo);
     if(t.da_operatore_user_id===operatorId)transOut+=cents(t.importo);
   }
   const opening=previous?cents(previous.contanti_contati):0;
   const expected=opening+income-outgo+transIn-transOut;
   return {data:date,operatore_user_id:operatorId,data_ultima_chiusura:previous?.data_chiusura||null,
     saldo_precedente:money(opening),incassi_contanti:money(income),uscite_contanti:money(outgo),
     trasferimenti_entrata:money(transIn),trasferimenti_uscita:money(transOut),saldo_teorico:money(expected),
     gia_chiusa:!!existing,saldo_iniziale_non_verificato:!previous,movimenti_sconosciuti:unmapped,source:'LOCAL_PREVIEW_NON_AUTORITATIVO'};
 }
 function margin({bookings=[],costs=[],tripId}){
   const b=bookings.filter(x=>x.viaggio_id===tripId&&active(x.stato));
   const c=costs.filter(x=>x.viaggio_id===tripId&&x.stato!=='Annullato');
   const revenue=b.reduce((s,x)=>s+cents(num(x.totale)),0);
   const collected=b.reduce((s,x)=>s+cents(num(x.pagato)),0);
   const expectedCost=c.reduce((s,x)=>s+cents(num(x.importo_previsto)),0);
   const paid=c.filter(x=>x.stato==='Pagato').reduce((s,x)=>s+cents(num(x.importo_previsto)),0);
   return {ricavi_previsti:money(revenue),incassato:money(collected),costi_previsti:money(expectedCost),costi_pagati:money(paid),margine_previsionale:money(revenue-expectedCost),residuo_clienti:money(revenue-collected)};
 }
 const api={cents,money,preview,margin,cash};g.DG11Core=Object.freeze(api);if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
