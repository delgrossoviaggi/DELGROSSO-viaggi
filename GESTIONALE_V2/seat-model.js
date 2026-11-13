/* Modelli originali (prenota.html su main, 06-11-2026). Modifiche V2 solo in bozza. */
(function(root){
 'use strict';
 const legacy={
 GT53:{name:'GT53 Standard',totalSeats:53,frontLabel:'FRONTE BUS GT53',driverLabel:'AUTISTA',seatLayoutKey:'GT53',rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'empty','empty','empty'],[33,34,'aisle',35,36],[37,38,'aisle',39,40],[41,42,'aisle',43,44],[45,46,'aisle',47,48],[49,50,51,52,53]]},
 GT63:{name:'GT63 Premium',totalSeats:63,frontLabel:'FRONTE BUS GT63',driverLabel:'AUTISTA',seatLayoutKey:'GT63',rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'aisle',33,34],[35,36,'aisle',37,38],[39,40,'aisle',41,42],[43,44,'aisle',45,46],[47,48,'aisle',49,50],[51,52,'aisle',53,54],[55,56,'aisle',57,58],[59,60,61,62,63]]},
 GT63B:{name:'GT63B Business',totalSeats:63,frontLabel:'FRONTE BUS GT63',driverLabel:'AUTISTA',seatLayoutKey:'GT63',rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'aisle',33,34],[35,36,'aisle',37,38],[39,40,'aisle',41,42],[43,44,'aisle',45,46],[47,48,'aisle',49,50],[51,52,'aisle',53,54],[55,56,'aisle',57,58],[59,60,61,62,63]]}
 };
 const clone=x=>JSON.parse(JSON.stringify(x));
 function count(x){return x.rows.flat().filter(n=>Number.isInteger(n)&&n>0).length}
 function validate(x){
  if(!x||typeof x.name!=='string'||!x.name.trim()||!Array.isArray(x.rows)||x.rows.length<1||x.rows.length>100)return 'Piantina non valida';
  if(x.rows.some(r=>!Array.isArray(r)||r.length!==5))return 'Ogni fila deve avere cinque celle';
  const seen=new Set();
  for(const cell of x.rows.flat()){
   if(Number.isInteger(cell)&&cell>=1&&cell<=9999){if(seen.has(cell))return 'Posto duplicato: '+cell;seen.add(cell)}
   else if(!['aisle','door','empty'].includes(cell))return 'Cella non valida';
  }
  return seen.size?'':'Inserire almeno un posto';
 }
 const fromLegacy=key=>clone(legacy[key]||legacy.GT53);
 const fresh=name=>({name:String(name||'Nuova piantina').trim(),totalSeats:0,frontLabel:'FRONTE BUS',driverLabel:'AUTISTA',seatLayoutKey:'CUSTOM',rows:[['empty','empty','aisle','empty','empty']]});
 root.DG2SeatModel={legacy,clone,count,validate,fromLegacy,fresh};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.DG2SeatModel;
})(typeof window!=='undefined'?window:globalThis);
