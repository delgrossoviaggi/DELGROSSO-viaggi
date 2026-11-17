/* DELGROSSO 4.0 — editor completo piantine GT, lato browser.
 * La geometria non viene pubblicata senza il salvataggio e la RPC ufficiale.
 * Capienza fisica, numerazione e sedili fuori servizio sono protetti dal validatore.
 */
(()=>{'use strict';
const TYPES=['seat','aisle','empty','door','wc','driver','table'];
const LABELS={seat:'Sedile',aisle:'Corridoio',empty:'Vuoto',door:'Porta',wc:'WC',driver:'Autista',table:'Tavolino'};
const SYMBOLS={aisle:'┃',empty:'·',door:'🚪',wc:'WC',driver:'◉',table:'▤'};
const STATUSES=['available','blocked','out_of_service'];
const clone=x=>structuredClone(x);
const MAX_ROWS=35,MAX_COLS=8;
const safe=x=>String(x==null?'':x);
function ensureRows(input){
 if(!Array.isArray(input?.rows)||input.rows.length<1||input.rows.length>MAX_ROWS)
  throw Error('La piantina deve avere da 1 a 35 file.');
 return input.rows.map((r,i)=>{
  const source=Array.isArray(r?.cells)?r.cells:Array.isArray(r)?r:[];
  if(!source.length||source.length>MAX_COLS)throw Error('Ogni fila deve avere da 1 a 8 caselle.');
  return {label:safe(r?.label||'Fila '+(i+1)),rowNumber:i+1,
   cells:source.map(c=>{
    if(typeof c==='number')return {type:'seat',id:String(c),label:String(c),status:'available'};
    if(!c||typeof c!=='object')return {type:'empty'};
    const type=TYPES.includes(c.type)?c.type:'empty';
    if(type!=='seat')return {type};
    const id=safe(c.id||c.label);
    return {type,id,label:safe(c.label||id),status:STATUSES.includes(c.status)?c.status:'available'};
   })};
 });
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
 return {name:'Nuova piantina GT '+n,creator:'DELGROSSO 4.0',version:1,posti_totali:n,rows};
}
function countSeats(draft){
 return (draft?.rows||[]).reduce((n,r)=>n+(r.cells||[]).filter(x=>x.type==='seat').length,0);
}
function renumber(draft){
 let n=0;
 for(const [i,row] of (draft?.rows||[]).entries()){
  row.rowNumber=i+1;row.label='Fila '+(i+1);
  for(const cell of row.cells){
   if(cell.type==='seat'){
    n++;cell.id=String(n);cell.label=String(n);
    if(!STATUSES.includes(cell.status))cell.status='available';
   }else{delete cell.id;delete cell.label;delete cell.status;}
  }
 }
 draft.posti_totali=n;return draft;
}
function inspect(draft,capacity){
 const cap=Number(capacity);
 if(!Number.isInteger(cap)||cap<1||cap>100)return {valid:false,reason:'Capienza non valida'};
 let rows;
 try{rows=ensureRows(draft)}catch(e){return {valid:false,reason:String(e.message||e)}}
 const ids=rows.flatMap(r=>r.cells.filter(c=>c.type==='seat').map(c=>Number(c.id)));
 const complete=ids.length===cap&&new Set(ids).size===cap&&ids.every(x=>Number.isInteger(x)&&x>=1&&x<=cap)&&
  Array.from({length:cap},(_,i)=>i+1).every(x=>ids.includes(x));
 return {valid:complete,reason:complete?'':'La piantina deve includere esattamente i '+cap+' posti fisici, numerati 1–'+cap+'.',
  seats:ids.length,capacity:cap};
}
function mkButton(label,action,variant='secondary'){
 const button=document.createElement('button');button.type='button';
 button.textContent=label;button.className=variant;
 button.addEventListener('click',action);return button;
}
function mount(root,config=null){
 if(!root)throw Error('Contenitore editor non disponibile');
 let draft=config?{...clone(config),rows:ensureRows(config)}:newDraft(53);
 let original=clone(draft),undo=[],redo=[],tool='seat',selectedRow=0,changed=false;
 const header=document.createElement('div'),tools=document.createElement('div'),grid=document.createElement('div');
 const status=document.createElement('p'),note=document.createElement('p');
 header.className='dg4-layout-tools';tools.className='dg4-layout-tools';
 grid.className='dg4-edit-layout';status.className='help';note.className='help';
 root.replaceChildren();root.append(header,tools,note,status,grid);
 note.textContent='Scegli uno strumento e tocca le caselle. La numerazione progressiva è automatica, ma nessuna modifica viene pubblicata sul sito finché non salvi e associ la piantina.';
 const commit=edit=>{
  undo.push(clone(draft));if(undo.length>80)undo.shift();redo=[];
  edit();renumber(draft);changed=true;render();
 };
 const exportDraft=()=>{
  const out={...clone(draft),posted_to_supabase:false,version:Number(draft.version||1)};
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='DELGROSSO_PIANTINA_'+countSeats(draft)+'_BOZZA.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 };
 const importDraft=async file=>{
  if(!file)return;
  if(file.size>60000)throw Error('Il file JSON supera 60 KB.');
  const data=JSON.parse(await file.text());const rows=ensureRows(data);
  if(rows.length>MAX_ROWS||rows.some(r=>r.cells.length>MAX_COLS))throw Error('File non compatibile.');
  commit(()=>{draft={...clone(data),rows};});
 };
 const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';
 picker.hidden=true;picker.addEventListener('change',()=>{
  importDraft(picker.files?.[0]).catch(e=>alert('Importazione fallita: '+e.message));
  picker.value='';
 });
 header.append(
  mkButton('GT 53 posti',()=>commit(()=>{draft=newDraft(53);selectedRow=0;})),
  mkButton('GT 57 posti',()=>commit(()=>{draft=newDraft(57);selectedRow=0;})),
  mkButton('GT 63 posti',()=>commit(()=>{draft=newDraft(63);selectedRow=0;})),
  mkButton('Aggiungi fila',()=>{if(draft.rows.length>=MAX_ROWS)return alert('Massimo 35 file');commit(()=>{
   const cols=draft.rows[0].cells.length;
   draft.rows.splice(selectedRow+1,0,{label:'Nuova fila',rowNumber:0,cells:Array.from({length:cols},()=>({type:'empty'}))});
   selectedRow++;
  });}),
  mkButton('Rimuovi fila',()=>{if(draft.rows.length<=1)return;commit(()=>{draft.rows.splice(selectedRow,1);selectedRow=Math.min(selectedRow,draft.rows.length-1);});}),
  mkButton('Aggiungi colonna',()=>{if(draft.rows.some(x=>x.cells.length>=MAX_COLS))return alert('Massimo 8 colonne');commit(()=>draft.rows.forEach(row=>row.cells.push({type:'empty'})));}),
  mkButton('Rimuovi colonna',()=>{if(draft.rows.some(r=>r.cells.length<=1))return;commit(()=>draft.rows.forEach(row=>row.cells.pop()));}),
  mkButton('Rinumera',()=>commit(()=>{})),
  mkButton('Annulla ↶',()=>{if(!undo.length)return;redo.push(clone(draft));draft=undo.pop();changed=true;render();}),
  mkButton('Ripristina ↷',()=>{if(!redo.length)return;undo.push(clone(draft));draft=redo.pop();changed=true;render();}),
  mkButton('Originale',()=>{if(!confirm('Ripristinare la piantina all’apertura dell’editor? Le modifiche locali andranno perse.'))return;undo.push(clone(draft));draft=clone(original);redo=[];changed=false;render();}),
  mkButton('↓ Esporta JSON',exportDraft,'primary'),
  mkButton('↑ Importa JSON',()=>picker.click()),
  picker
 );
 const selectRow=document.createElement('select');selectRow.className='dg4-edit-row-select';
 selectRow.setAttribute('aria-label','Fila da aggiungere o rimuovere');
 selectRow.addEventListener('change',()=>{selectedRow=Number(selectRow.value)||0;render();});
 tools.append(selectRow);
 for(const type of TYPES){
  const b=mkButton(LABELS[type],()=>{tool=type;render();});
  b.dataset.tool=type;tools.append(b);
 }
 const selectedStatus=document.createElement('select');selectedStatus.setAttribute('aria-label','Stato del sedile');
 for(const [value,label] of [['available','Disponibile'],['blocked','Bloccato'],['out_of_service','Fuori servizio']]){
  const o=document.createElement('option');o.value=value;o.textContent=label;selectedStatus.append(o);
 }
 tools.append(selectedStatus);
 function render(){
  const cap=countSeats(draft),blocked=draft.rows.flatMap(r=>r.cells).filter(c=>c.type==='seat'&&c.status!=='available').length;
  status.textContent='Posti fisici: '+cap+' · File: '+draft.rows.length+
   ' · Sedili bloccati/fuori servizio: '+blocked+' · Modifiche: '+(changed?'non salvate':'nessuna');
  selectRow.replaceChildren();
  draft.rows.forEach((r,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent='Fila '+(i+1);selectRow.append(opt);});
  selectedRow=Math.max(0,Math.min(selectedRow,draft.rows.length-1));selectRow.value=String(selectedRow);
  tools.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('dg4-tool-selected',b.dataset.tool===tool));
  grid.replaceChildren();
  for(const [ri,row] of draft.rows.entries()){
   const wrap=document.createElement('div');wrap.className='dg4-edit-row';
   wrap.style.gridTemplateColumns='repeat('+row.cells.length+', minmax(40px, 60px))';
   const rowNum=document.createElement('span');rowNum.className='dg4-edit-number';rowNum.textContent='Fila '+(ri+1);
   const section=document.createElement('div');section.className='dg4-edit-row-with-number';
   section.append(rowNum,wrap);
   for(const [ci,cell] of row.cells.entries()){
    const b=document.createElement('button');b.type='button';
    b.className='seat dg4-edit-cell '+(cell.type==='seat'?
      (cell.status==='blocked'?'reserved':cell.status==='out_of_service'?'booked':''):'aisle');
    b.textContent=cell.type==='seat'?safe(cell.id||cell.label):SYMBOLS[cell.type]||'·';
    b.title='Fila '+(ri+1)+' posizione '+(ci+1)+' · '+LABELS[cell.type]+(cell.status?' · '+cell.status:'');
    b.setAttribute('aria-label',b.title);
    b.addEventListener('click',()=>commit(()=>{
      const formerStatus=cell.type==='seat'?cell.status:null;
      if(tool==='seat'){
       cell.type='seat';cell.status=selectedStatus.value||formerStatus||'available';
      }else{cell.type=tool;delete cell.status;}
    }));
    wrap.append(b);
   }
   grid.append(section);
  }
 }
 render();
 return {snapshot:()=>clone(draft),get changed(){return changed},get selectedTool(){return tool},
  validate:capacity=>inspect(draft,capacity),exportDraft,
  reset:()=>{draft=clone(original);undo=[];redo=[];changed=false;render()}};
}
window.DG4LayoutEditor=Object.freeze({mount,newDraft,renumber,ensureRows,countSeats,inspect,TYPES});
})();
