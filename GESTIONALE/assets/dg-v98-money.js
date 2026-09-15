/* DEL GROSSO V98 — Precisione monetaria.
   Tutti i calcoli commerciali usano centesimi interi per evitare arrotondamenti
   impliciti del floating point. Nessun totale viene arrotondato alle decine/centinaia. */
export function toCents(value){
  if(value===null||value===undefined||value==='') return 0;
  if(typeof value==='number') return Number.isFinite(value)?Math.round(value*100):0;
  let s=String(value).trim().replace(/[^0-9,.-]/g,'');
  if(!s) return 0;
  const lastComma=s.lastIndexOf(','), lastDot=s.lastIndexOf('.');
  if(lastComma>lastDot) s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/,/g,'');
  const n=Number(s);
  return Number.isFinite(n)?Math.round(n*100):0;
}
export function fromCents(cents){ return (Number.isFinite(Number(cents))?Number(cents):0)/100; }
export function multiplyMoney(unitPrice, quantity){ return fromCents(toCents(unitPrice)*Math.max(0,Math.trunc(Number(quantity)||0))); }
export function addMoney(...values){ return fromCents(values.reduce((sum,v)=>sum+toCents(v),0)); }
export function subtractMoney(a,b){ return fromCents(toCents(a)-toCents(b)); }
export function money(value){
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(fromCents(toCents(value)));
}
export function decimal(value){ return fromCents(toCents(value)).toFixed(2); }
