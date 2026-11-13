/* DELGROSSO 2.0 — Modelli GT originali da prenota.html (6 novembre 2026). */
(function(root){
  'use strict';
  const legacy={
    GT53:{name:'GT53 Standard',totalSeats:53,frontLabel:'FRONTE BUS GT53',driverLabel:'AUTISTA',seatLayoutKey:'GT53',rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'empty','empty','empty'],[33,34,'aisle',35,36],[37,38,'aisle',39,40],[41,42,'aisle',43,44],[45,46,'aisle',47,48],[49,50,51,52,53]]},
    GT63:{name:'GT63 Premium',totalSeats:63,frontLabel:'FRONTE BUS GT63',driverLabel:'AUTISTA',seatLayoutKey:'GT63',rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'aisle',33,34],[35,36,'aisle',37,38],[39,40,'aisle',41,42],[43,44,'aisle',45,46],[47,48,'aisle',49,50],[51,52,'aisle',53,54],[55,56,'aisle',57,58],[59,60,61,62,63]]},
    GT63B:{name:'GT63B Business',totalSeats:63,frontLabel:'FRONTE BUS GT63',driverLabel:'AUTISTA',seatLayoutKey:'GT63',rows:[[1,2,'aisle',3,4],[5,6,'aisle',7,8],[9,10,'aisle',11,12],[13,14,'aisle',15,16],[17,18,'aisle',19,20],[21,22,'aisle',23,24],[25,26,'aisle',27,28],[29,30,'empty','empty','door'],[31,32,'aisle',33,34],[35,36,'aisle',37,38],[39,40,'aisle',41,42],[43,44,'aisle',45,46],[47,48,'aisle',49,50],[51,52,'aisle',53,54],[55,56,'aisle',57,58],[59,60,61,62,63]]}
  };
  const clone=x=>JSON.parse(JSON.stringify(x));
  const count=x=>x.rows.flat().filter(v=>Number.isInteger(v)&&v>0).length;
  function validate(x){
    if(!x||typeof x.name!=='string'||!x.name.trim()||!Array.isArray(x.rows)||!x.rows.length||x.rows.length>100)return 'Piantina non valida';
    if(x.rows.some(r=>!Array.isArray(r)||r.length!==5))return 'Ogni fila deve avere cinque celle';
    const found=new Set();
    for(const cell of x.rows.flat()){
      if(Number.isInteger(cell)&&cell>0&&cell<=9999){if(found.has(cell))return 'Numero di posto duplicato: '+cell;found.add(cell)}
      else if(!['aisle','door','empty'].includes(cell))return 'Cella non valida';
    }
    return found.size?'':'Inserire almeno un sedile';
  }
  // Seat numbers are always generated from the available identifiers.
  // Existing seat labels never change just because an empty cell is filled.
  function nextSeat(x){
    const used=new Set(x.rows.flat().filter(v=>Number.isInteger(v)&&v>0));
    for(let n=1;n<=9999;n++)if(!used.has(n))return n;
    throw Error('Raggiunto il limite di numerazione dei sedili');
  }
  function putSeat(x,r,c){
    const out=clone(x),old=out.rows[r]?.[c];
    if(old===undefined)throw Error('Cella non trovata');
    if(Number.isInteger(old))return out; // non rinumerare sedili esistenti con un clic
    out.rows[r][c]=nextSeat(out);
    out.totalSeats=count(out);
    return out;
  }
  function addRow(x){
    if(x.rows.length>=100)throw Error('La piantina può avere al massimo 100 file');
    const out=clone(x),newRow=['empty','empty','aisle','empty','empty'];
    for(const i of [0,1,3,4]){
      newRow[i]=nextSeat({...out,rows:[...out.rows,newRow]});
    }
    out.rows.push(newRow);out.totalSeats=count(out);return out;
  }
  function renumber(x){
    const out=clone(x);let n=0;
    out.rows=out.rows.map(row=>row.map(v=>Number.isInteger(v)?++n:v));
    out.totalSeats=n;return out;
  }
  function generate(name,quantity){
    const n=Number(quantity);
    if(!Number.isInteger(n)||n<1||n>400)throw Error('Inserisci un numero di sedili tra 1 e 400');
    const out=fresh(name);out.rows=[];let index=1;
    while(index<=n){
      const row=['empty','empty','aisle','empty','empty'];
      for(const k of [0,1,3,4])if(index<=n)row[k]=index++;
      out.rows.push(row);
    }
    out.totalSeats=n;return out;
  }
  // Capacity limits apply only to a specific trip, not to the actual fleet bus.
  function limitedToCapacity(x,limit){
    const n=Number(limit),total=count(x);
    if(!Number.isInteger(n)||n<=0||n>=total)return clone(x);
    const nums=x.rows.flat().filter(Number.isInteger).slice().sort((a,b)=>a-b);
    if(nums.some((v,i)=>v!==i+1))return clone(x);
    const out=clone(x);
    out.rows=out.rows.map(row=>row.map(v=>Number.isInteger(v)&&v>n?'empty':v));
    while(out.rows.length>1&&out.rows[out.rows.length-1].every(v=>v==='empty'||v==='aisle'))out.rows.pop();
    out.totalSeats=n;return out;
  }
  const fromLegacy=key=>clone(legacy[key]||legacy.GT53);
  const fresh=name=>({name:String(name||'Nuova piantina').trim(),totalSeats:0,frontLabel:'FRONTE BUS',driverLabel:'AUTISTA',seatLayoutKey:'CUSTOM',rows:[['empty','empty','aisle','empty','empty']]});
  root.DG2SeatModel={legacy,clone,count,validate,fromLegacy,fresh,nextSeat,putSeat,addRow,renumber,generate,limitedToCapacity};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.DG2SeatModel;
})(typeof window!=='undefined'?window:globalThis);
