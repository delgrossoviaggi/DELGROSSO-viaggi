/* DELGROSSO 4.0 — Editor piantine in memoria
 * Non comunica con Supabase e NON modifica le piantine ufficiali.
 * Permette bozze scaricabili e numerazione progressiva.
 */
(()=>{'use strict';
const safeText=x=>String(x==null?'':x);
const MAX=100;
const clone=x=>structuredClone(x);
function ensureRows(input) {
 if(!Array.isArray(input?.rows))throw Error('Schema originale privo di righe');
 return input.rows.map((row,i)=>({
   label:safeText(row?.label||'Fila '+(i+1)),
   rowNumber:i+1,
   cells:(Array.isArray(row?.cells)?row.cells:Array.isArray(row)?row:[]).map(c=>{
      if(typeof c==='number')return {type:'seat',label:String(c),id:String(c)};
      if(!c||typeof c!=='object')return {type:'aisle'};
      return {...c,type:['seat','aisle','empty','driver'].includes(c.type)?c.type:'empty'};
   })
 }));
}
function newDraft(capacity){
 const n=Number(capacity);
 if(![53,57,63].includes(n))throw Error('Capienza supportata: 53, 57 o 63 posti');
 let current=0;
 const rows=Array.from({length:Math.ceil(n/4)},(_,i)=>({
   label:'Fila '+(i+1),rowNumber:i+1,
   cells:Array.from({length:5},(_,j)=>{
     if(j===2)return {type:'aisle'};
     current++;
     return current<=n?{type:'seat',label:String(current),id:String(current),status:'available'}:{type:'empty'};
   })
 }));
 return {name:'Nuova piantina GT '+n,creator:'DELGROSSO 4.0 (bozza locale)',version:1,posti_totali:n,rows};
}
function countSeats(draft){return draft.rows.reduce((n,r)=>n+r.cells.filter(x=>x.type==='seat').length,0);}
function renumber(draft){
 let counter=0;
 for(let i=0;i<draft.rows.length;i++){
  const row=draft.rows[i];row.rowNumber=i+1;row.label='Fila '+(i+1);
  for(const cell of row.cells){
   if(cell.type==='seat'){counter++;cell.id=String(counter);cell.label=String(counter);cell.status='available';}
   else{delete cell.id;delete cell.label;delete cell.status;}
  }
 }
 draft.posti_totali=counter;
 return draft;
}
function createButton(text,fn,cls='secondary'){
 const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.addEventListener('click',fn);return b;
}
function mount(root,input=null) {
 if(!root)throw Error('Contenitore editor non disponibile');
 let draft=input?{...clone(input),rows:ensureRows(input)}:newDraft(53);
 const initial=clone(draft);
 let dirty=false;
 const status=document.createElement('p');
 status.className='help';
 const header=document.createElement('div');header.className='filters';
 const grid=document.createElement('div');
 const instruction=document.createElement('p');
 instruction.className='alert';
 instruction.textContent='Editor locale: non modifica Supabase. Seleziona una cella per cambiarne il tipo. La numerazione viene aggiornata solo sulle modifiche. Esporta la bozza JSON per conservarla.';
 root.replaceChildren();
 root.append(header,instruction,status,grid);
 header.append(
  createButton('Nuova 53 posti',()=>{draft=newDraft(53);dirty=true;render();}),
  createButton('Nuova 57 posti',()=>{draft=newDraft(57);dirty=true;render();}),
  createButton('Nuova 63 posti',()=>{draft=newDraft(63);dirty=true;render();}),
  createButton('+ Aggiungi fila',()=>{if(draft.rows.length>=30)return alert('Limite 30 file');draft.rows.push({label:'',cells:[{type:'empty'},{type:'empty'},{type:'aisle'},{type:'empty'},{type:'empty'}]});dirty=true;renumber(draft);render();}),
  createButton('− Ultima fila',()=>{if(draft.rows.length<=1)return;draft.rows.pop();dirty=true;renumber(draft);render();}),
  createButton('Ripristina iniziale',()=>{draft=clone(initial);dirty=false;render();}),
  createButton('↓ Esporta bozza JSON',()=>exportDraft(),'primary')
 );
 function exportDraft(){
  const data={...draft,version:Number(draft.version||1),name:safeText(draft.name||'Bozza DELGROSSO 4.0'),creator:'DELGROSSO VIAGGI · bozza non pubblicata',posted_to_supabase:false};
  const json=JSON.stringify(data,null,2);
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='delgrosso-piantina-'+data.posti_totali+'-bozza.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1800);
 }
 function render(){
  const count=countSeats(draft);
  status.textContent='Sedili numerati: '+count+' · File: '+draft.rows.length+
    ' · Stato: '+(dirty?'bozza modificata in memoria':'bozza senza variazioni')+
    ' · Nessuna scrittura sul database.';
  grid.replaceChildren();
  for(const [ri,row] of draft.rows.entries()){
   const wrap=document.createElement('div');
   wrap.className='seat-grid';wrap.style.margin='7px 0';
   for(const [ci,cell] of row.cells.entries()){
    const seat=document.createElement('button');
    seat.type='button';seat.className='seat '+(cell.type==='seat'?'': 'aisle');
    seat.textContent=cell.type==='seat'?safeText(cell.label||cell.id):cell.type==='aisle'?'┃':cell.type==='driver'?'🚍':'·';
    seat.title='Fila '+(ri+1)+' posizione '+(ci+1)+' · '+cell.type+' · premi per modificare';
    seat.setAttribute('aria-label',seat.title);
    seat.addEventListener('click',()=>{
      const cycle=['seat','aisle','empty','driver'];
      cell.type=cycle[(cycle.indexOf(cell.type)+1)%cycle.length];
      dirty=true;renumber(draft);render();
    });
    wrap.append(seat);
   }
   grid.append(wrap);
  }
 }
 render();
 return {snapshot:()=>clone(draft),get changed(){return dirty}};
}
window.DG4LayoutEditor=Object.freeze({mount,newDraft,renumber,ensureRows,countSeats});
})();