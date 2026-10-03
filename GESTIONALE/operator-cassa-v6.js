/* DELGROSSO V6 — Cassa per operatore: Nicola / Raffaele */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const eur=n=>typeof money==='function'?money(Number(n||0)):'€ '+Number(n||0).toFixed(2);
function rows(){
  const fromView=Array.isArray(state?.cassaOperatori)?state.cassaOperatori:[];
  if(fromView.length) return fromView.map(x=>({nome:x.nome||x.username||'Operatore',viaggi:Number(x.viaggi_incassati||0),noleggi:Number(x.noleggi_incassati||0),rimViaggi:Number(x.viaggi_rimborsi||0),rimNoleggi:Number(x.noleggi_rimborsi||0),netto:Number(x.cassa_netto||0)}));
  return ['Nicola','Raffaele'].map(nome=>{const vp=(state.pagamenti||[]).filter(x=>(x.incassato_da||'Nicola')===nome),np=(state.noleggiPagamenti||[]).filter(x=>(x.incassato_da||'Nicola')===nome);const vIn=vp.filter(x=>String(x.tipo||'').toLowerCase()!=='rimborso').reduce((a,x)=>a+Math.abs(Number(x.importo||0)),0),vRf=vp.filter(x=>String(x.tipo||'').toLowerCase()==='rimborso').reduce((a,x)=>a+Math.abs(Number(x.importo||0)),0),nIn=np.filter(x=>String(x.tipo||'').toLowerCase()!=='rimborso').reduce((a,x)=>a+Math.abs(Number(x.importo||0)),0),nRf=np.filter(x=>String(x.tipo||'').toLowerCase()==='rimborso').reduce((a,x)=>a+Math.abs(Number(x.importo||0)),0);return {nome,viaggi:vIn,noleggi:nIn,rimViaggi:vRf,rimNoleggi:nRf,netto:vIn+nIn-vRf-nRf}});
}
window.dgOperatorCashRows=rows;
function cards(){return rows().map(x=>`<div class="module-card dg-operator-cash"><h3>👤 ${esc(x.nome)} · soldi in cassa</h3><b style="font-size:25px">${eur(x.netto)}</b><small style="display:block;margin-top:6px">Viaggi ${eur(x.viaggi)} · Noleggi ${eur(x.noleggi)} · Rimborsi ${eur(x.rimViaggi+x.rimNoleggi)}</small></div>`).join('')}
const oldP=window.renderPayments;window.renderPayments=function(){if(typeof oldP==='function')oldP();const b=el('paymentSummary');if(b&&!b.querySelector('.dg-operator-cash'))b.insertAdjacentHTML('beforeend',cards())};
const oldE=window.renderEconomia;window.renderEconomia=function(){if(typeof oldE==='function')oldE();const b=el('economyKpis');if(b&&!b.querySelector('.dg-operator-cash'))b.insertAdjacentHTML('beforeend',cards())};
})();