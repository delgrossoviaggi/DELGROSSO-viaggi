/* DELGROSSO exact money helpers — restored dependency required by booking/trip modules. */
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const cents=v=>Math.round((n(v)+Number.EPSILON)*100);
const decimal=v=>(cents(v)/100).toFixed(2);
const money=v=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents(v)/100);
const multiplyMoney=(a,b)=>cents(a*b)/100;
const addMoney=(...v)=>v.reduce((s,x)=>s+cents(x),0)/100;
const subtractMoney=(a,b)=>cents(a)-cents(b)===0?0:(cents(a)-cents(b))/100;
export{money,multiplyMoney,decimal,addMoney,subtractMoney,cents};
