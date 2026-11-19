/* DELGROSSO V5 - Compenso Nicola; registro distinto dagli incassi */
(function(){
'use strict';
const route='compenso-nicola', el=id=>document.getElementById(id), safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0),
date=x=>{let v=String(x||'');return v.length>=10?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'—'},
cent=n=>Math.round((Number(n)||0)*100), localDate=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'});
let cache=null,selected=null,user=null,onlyDue=false;
const read=async(t,fields)=>{const out=[],size=400;for(let off=0;off<8000;off+=size){const q=new URLSearchParams({select:fields,limit:String(size),offset:String(off)});const part=await window.api(t,q.toString(),{noCache:true,timeout:18000});if(!Array.isArray(part))throw Error('Risposta inattesa da '+t);out.push(...part);if(part.length<size)return out}throw Error('Archivio incompleto: '+t)};
async function load(force){
const session=await window.dgSuiteGetSession();if(!session?.access_token||!session.user?.id)throw Error('Accedi al gestionale.');
if(user!==session.user.id){cache=null;user=session.user.id}
if(cache&&!force&&Date.now()-cache.time<10000)return cache;
const operators=await read('operatori_gestionale','user_id,username,attivo,nome');
if(!operators.some(o=>o.user_id===user&&o.attivo&&['nicola','raffaele'].includes(String(o.username).toLowerCase())))throw Error('Accesso riservato a Nicola e Raffaele.');
const [credits,links,transfers,trips]=await Promise.all([
read('dg_compensi_nicola','id,data_compenso,viaggio_id,descrizione,importo_compenso,note,riferimento'),
read('dg_compensi_nicola_liquidazioni','id,compenso_id,trasferimento_id,importo'),
read('cassa_trasferimenti','id,da_operatore_user_id,a_operatore_user_id,importo,stato,data_trasferimento,note'),
read('viaggi','id,titolo,data_partenza')
]);
const ra=operators.find(o=>String(o.username).toLowerCase()==='raffaele')?.user_id,ni=operators.find(o=>String(o.username).toLowerCase()==='nicola')?.user_id;
const valid=t=>t&&t.da_operatore_user_id===ra&&t.a_operatore_user_id===ni&&t.stato==='Confermato';
const tm=new Map(transfers.map(t=>[t.id,t])),paid=new Map();
let errors=0;
for(const x of links){const t=tm.get(x.trasferimento_id);if(!valid(t)||cent(t.importo)!==cent(x.importo)){errors++;continue}paid.set(x.compenso_id,(paid.get(x.compenso_id)||0)+cent(x.importo))}
const rows=credits.map(c=>{const due=cent(c.importo_compenso),got=paid.get(c.id)||0;if(got>due)errors++;return {...c,due,got,remaining:Math.max(0,due-got)}}).sort((a,b)=>String(b.data_compenso).localeCompare(String(a.data_compenso)));
const used=new Set(links.map(x=>x.trasferimento_id));
cache={operators,rows,trips,transfers,free:transfers.filter(t=>valid(t)&&!used.has(t.id)),time:Date.now(),errors};return cache;
}
function msg(text,err){const p=el('dgcn-message');if(p){p.textContent=text;p.className=err?'dgcn-error':'dgcn-ok'}}
function kpi(name,value,sub){return '<div class="dgcn-kpi"><small>'+safe(name)+'</small><strong>'+money(value/100)+'</strong><span>'+safe(sub)+'</span></div>'}
function html(data){
const mat=data.rows.reduce((s,c)=>s+c.due,0),got=data.rows.reduce((s,c)=>s+c.got,0),remaining=Math.max(0,mat-got);
const trips=data.trips.slice().sort((a,b)=>String(b.data_partenza).localeCompare(String(a.data_partenza)));
const opt=trips.slice(0,120).map(t=>'<option value="'+safe(t.id)+'">'+safe(date(t.data_partenza)+' · '+t.titolo)+'</option>').join('');
const rows=(onlyDue?data.rows.filter(x=>x.remaining>0):data.rows);
return '<header class="dgcn-head"><div><small>DELGROSSO VIAGGI · CONTABILITÀ PERSONALE</small><h2>Il mio credito <span>· Compenso Nicola</span></h2><p>Giornate lavorative, compensi maturati e versamenti di Raffaele. Separato dagli incassi dei passeggeri.</p></div><button data-dgcn="refresh">↻ Aggiorna</button></header>'+
'<p id="dgcn-message" role="status"></p>'+(data.errors?'<div class="dgcn-error">Attenzione: alcune liquidazioni sono incoerenti e richiedono verifica.</div>':'')+
'<div class="dgcn-kpis">'+kpi('Totale maturato',mat,data.rows.length+' compensi')+kpi('Già ricevuto',got,'Solo trasferimenti confermati')+kpi('Ancora da ricevere',remaining,'Saldo credito personale')+'</div>'+
'<section class="dgcn-panel"><h3>'+(selected?'Modifica compenso non liquidato':'Registra una giornata / nuovo compenso')+'</h3>'+
'<form id="dgcn-form"><div class="dgcn-grid"><label>Data servizio<input name="data_compenso" type="date" required value="'+safe(selected?.data_compenso||localDate())+'"></label><label>Compenso (€)<input name="importo_compenso" type="number" min="0.01" step="0.01" required value="'+safe(selected?.importo_compenso||'')+'"></label><label class="dgcn-full">Descrizione<input name="descrizione" minlength="4" maxlength="180" required placeholder="Giornata Napoli ..." value="'+safe(selected?.descrizione||'')+'"></label><label class="dgcn-full">Viaggio (facoltativo)<select name="viaggio_id"><option value="">Nessuno</option>'+opt+'</select></label><label class="dgcn-full">Note<textarea name="note" rows="2">'+safe(selected?.note||'')+'</textarea></label></div><div class="dgcn-actions"><button type="submit" class="dgcn-primary">'+(selected?'Salva modifica':'Registra compenso maturato')+'</button>'+(selected?'<button type="button" data-dgcn="cancel">Annulla</button>':'')+'</div></form><p class="dgcn-foot">Registrare un compenso non genera nuovi incassi, pagamenti o trasferimenti di cassa.</p></section>'+
'<section class="dgcn-panel"><div class="dgcn-flex"><h3>Registro compensi</h3><label><input id="dgcn-only" type="checkbox" '+(onlyDue?'checked':'')+'> Solo da ricevere</label></div><div class="dgcn-scroll"><table><thead><tr><th>Data</th><th>Descrizione</th><th>Maturato</th><th>Ricevuto</th><th>Residuo</th><th>Stato / azioni</th></tr></thead><tbody>'+rows.map(c=>'<tr><td>'+date(c.data_compenso)+'</td><td><b>'+safe(c.descrizione)+'</b>'+(c.note?'<small>'+safe(c.note)+'</small>':'')+'</td><td>'+money(c.due/100)+'</td><td>'+money(c.got/100)+'</td><td><b>'+money(c.remaining/100)+'</b></td><td><b class="'+(c.remaining?'dgcn-due':'dgcn-paid')+'">'+(c.remaining?'DA RICEVERE':'LIQUIDATO')+'</b><div class="dgcn-actions">'+(c.got?'':'<button data-dgcn="edit" data-id="'+safe(c.id)+'">Modifica</button><button data-dgcn="delete" data-id="'+safe(c.id)+'">Elimina</button>')+(c.remaining?'<button data-dgcn="associate" data-id="'+safe(c.id)+'">Abbina pagamento</button>':'')+'</div></td></tr>').join('')+'</tbody></table></div><p class="dgcn-foot">Compenso €50 del 15/11/2026: liquidato con trasferimento già registrato. I €450 Nicola → Raffaele del 15/11 e il bonifico €500 del 14/11 restano trasferimenti di cassa, non compensi.</p></section><p class="dgcn-foot">Dati letti da Supabase, aggiornamento '+new Date(data.time).toLocaleString('it-IT')+' · Le quote del 18/11/2026 rimangono invariate.</p>';
}
async function render(force){const host=el('page-'+route);if(!host)return;host.innerHTML='<div class="dgcn-panel">Caricamento compensi...</div>';try{const data=await load(force);if(el('page-'+route))el('page-'+route).innerHTML=html(data);if(selected){const sel=el('dgcn-form')?.querySelector('select[name=viaggio_id]');if(sel)sel.value=selected.viaggio_id||''}}catch(e){host.innerHTML='<div class="dgcn-error">'+safe(e.message)+'</div><button data-dgcn="refresh">Riprova</button>'}}
async function save(form){await window.dgSuiteGetSession();const f=new FormData(form),record={data_compenso:String(f.get('data_compenso')||''),descrizione:String(f.get('descrizione')||'').trim(),importo_compenso:Number(f.get('importo_compenso')),viaggio_id:String(f.get('viaggio_id')||'')||null,note:String(f.get('note')||'').trim()||null};
if(!/^\d{4}-\d\d-\d\d$/.test(record.data_compenso)||record.descrizione.length<4||!(record.importo_compenso>0))throw Error('Compila data, descrizione e importo.');
if(selected&&selected.got)throw Error('Un compenso liquidato non si modifica.');
await window.api('dg_compensi_nicola',selected?'id=eq.'+encodeURIComponent(selected.id):'',{method:selected?'PATCH':'POST',body:record,headers:{Prefer:'return=representation'}});
selected=null;cache=null;await render(true);msg('Compenso salvato. Nessuna variazione degli incassi o della cassa.');}
async function action(kind,id){const c=cache?.rows.find(x=>x.id===id);if(kind==='refresh'){selected=null;cache=null;return render(true)}
if(kind==='cancel'){selected=null;return render()}
if(kind==='edit'){if(!c||c.got)throw Error('Compenso non modificabile');selected=c;await render();return el('dgcn-form')?.scrollIntoView({behavior:'smooth',block:'center'})}
if(kind==='delete'){if(!c||c.got)throw Error('Impossibile eliminare un compenso già liquidato');if(!confirm('Eliminare il compenso NON pagato?'))return;await window.api('dg_compensi_nicola','id=eq.'+encodeURIComponent(id),{method:'DELETE'});cache=null;return render(true)}
if(kind==='associate'){if(!c||!c.remaining)throw Error('Compenso senza credito residuo');const free=cache.free.filter(t=>cent(t.importo)<=c.remaining);
if(!free.length){alert('Non ci sono trasferimenti confermati Raffaele → Nicola compatibili. Registra prima il pagamento nella cassa.');return}
const detail=free.map((t,i)=>(i+1)+') '+date(t.data_trasferimento)+' · '+money(t.importo)+' · '+String(t.note||'').slice(0,45)).join('\n');
const answer=prompt('Seleziona numero trasferimento già registrato:\n'+detail);if(answer===null)return;const n=Number(answer)-1,t=free[n];if(!t)throw Error('Selezione non valida');
if(!confirm('Collegare '+money(t.importo)+' al compenso di '+money(c.due/100)+'? Non verrà creato un nuovo trasferimento.'))return;
await window.api('dg_compensi_nicola_liquidazioni','',{method:'POST',body:{compenso_id:c.id,trasferimento_id:t.id,importo:Number(t.importo)},headers:{Prefer:'return=representation'}});cache=null;await render(true);return msg('Pagamento collegato al compenso senza duplicare la cassa')}
}
function init(){const host=document.querySelector('main.main > .content')||document.querySelector('main .content')||document.querySelector('main');if(!host)return;if(!el('page-'+route)){const s=document.createElement('section');s.className='page dgcn-page';s.id='page-'+route;host.appendChild(s)}
if(typeof PAGE_META!=='undefined')PAGE_META[route]=['Il mio credito · Compenso Nicola','Compensi maturati, ricevuti e credito residuo'];
const oldGo=window.go;if(typeof oldGo==='function'){window.go=function(p){const result=oldGo.apply(this,arguments);if(p===route){selected=null;render()}return result}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dgcn]');if(!b)return;e.preventDefault();action(b.dataset.dgcn,b.dataset.id).catch(err=>msg(err.message,true))});
document.addEventListener('change',e=>{if(e.target.id==='dgcn-only'){onlyDue=e.target.checked;render()}});
document.addEventListener('submit',e=>{if(e.target.id==='dgcn-form'){e.preventDefault();const b=e.target.querySelector('[type=submit]');if(b)b.disabled=true;save(e.target).catch(err=>{msg(err.message,true);if(b)b.disabled=false})}});
const logout=window.dgSuiteLogout;if(typeof logout==='function')window.dgSuiteLogout=function(){cache=null;user=null;selected=null;return logout.apply(this,arguments)};
if(location.hash==='#'+route&&document.body.classList.contains('dg44-authenticated'))render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
