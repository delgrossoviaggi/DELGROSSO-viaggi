function calcola(){
let e=Number(entrate.value||0);
let s=Number(gasolio.value||0)+Number(pedaggi.value||0)+Number(altro.value||0);
risultato.innerHTML='Utile viaggio: € '+(e-s).toFixed(2);
}
