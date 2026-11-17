/**
 * DELGROSSO 4.0 — Agenda mensile e Scadenze indipendenti.
 * Restano nella tabella storica scadenze_gestionale; non viene modificato
 * nessun record esistente con la sola visualizzazione.
 */
/** Load both real Supabase archives without migrating or duplicating any row.
 * Historical appointments (V1/V2) are stored in attivita_gestionale; new
 * typed events and regulatory deadlines live in scadenze_gestionale.
 * __source is UI-only provenance; never persisted as a DB column.
 */
export function mergeAgendaSources(deadlines=[],legacyActivities=[]){
 const typed=(Array.isArray(deadlines)?deadlines:[]).map(x=>({...x,__source:'scadenze_gestionale'}));
 const legacy=(Array.isArray(legacyActivities)?legacyActivities:[]).map(x=>({
  ...x,__source:'attivita_gestionale',
  tipo:'Impegno',data_scadenza:x.scadenza,
  note:''
 }));
 return [...typed,...legacy];
}

export const agendaCategories=Object.freeze(['Agenda','Appuntamento','Impegno','Nota','Promemoria']);
export const deadlineCategories=Object.freeze(['Scadenza','operativa','Estintori']);
export const agendaKinds=Object.freeze([...agendaCategories,...deadlineCategories]);
export const agendaDeleted=item=>/^(eliminata|eliminato|cestinata|cestinato)$/i.test(String(item?.stato||'').trim());
export const isDiaryEntry=item=>agendaCategories.some(t=>t.toLocaleLowerCase('it')===String(item?.tipo||'').toLocaleLowerCase('it'));
export const isDeadlineEntry=item=>!isDiaryEntry(item);
export function agendaEntries(items,section,{includeDeleted=false,search=''}={}){
 const q=String(search||'').trim().toLocaleLowerCase('it');
 return (items||[]).filter(x=>x&&
  (includeDeleted?agendaDeleted(x):!agendaDeleted(x))&&
  (section==='all'||(section==='agenda'?isDiaryEntry(x):isDeadlineEntry(x)))&&
  (!q||[x.titolo,x.descrizione,x.note,x.tipo,x.stato,x.assegnata_a].some(v=>String(v||'').toLocaleLowerCase('it').includes(q))))
  .slice().sort((a,b)=>String(a.data_scadenza||'').localeCompare(String(b.data_scadenza||''))||String(a.titolo||'').localeCompare(String(b.titolo||'')));
}
export function deadlineStats(items,today){
 const live=agendaEntries(items,'scadenze');
 return {total:live.length,
  late:live.filter(x=>String(x.data_scadenza||'')<today&&!/completat/i.test(String(x.stato||''))).length,
  dueToday:live.filter(x=>x.data_scadenza===today&&!/completat/i.test(String(x.stato||''))).length,
  upcoming:live.filter(x=>x.data_scadenza>today&&!/completat/i.test(String(x.stato||''))).length,
  done:live.filter(x=>/completat/i.test(String(x.stato||''))).length};
}
export function calendarMonth(month){
 const match=/^(\d{4})-(0[1-9]|1[012])$/.exec(String(month||''));
 if(!match)throw new Error('Mese dell’agenda non valido.');
 const year=Number(match[1]),m=Number(match[2]);
 if(year<2000||year>2100)throw new Error('Mese fuori intervallo.');
 const first=new Date(Date.UTC(year,m-1,1));
 const offset=(first.getUTCDay()+6)%7; // week starts Monday
 const dayCount=new Date(Date.UTC(year,m,0)).getUTCDate();
 const count=Math.ceil((dayCount+offset)/7)*7;
 const days=[];
 for(let i=0;i<count;i++){
  const d=new Date(Date.UTC(year,m-1,1-offset+i));
  const date=d.toISOString().slice(0,10);
  days.push({date,day:d.getUTCDate(),within:date.slice(0,7)===month});
 }
 return days;
}
export function shiftCalendarMonth(month,delta){
 const match=/^(\d{4})-(\d{2})$/.exec(String(month||''));
 if(!match||!Number.isInteger(delta)||Math.abs(delta)>12)throw new Error('Navigazione calendario non valida.');
 const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1+delta,1));
 return date.toISOString().slice(0,7);
}
export function validateAgendaEntry(form,{section='agenda',original=null}={}){
 const v={titolo:String(form.titolo||'').trim(),
  descrizione:String(form.descrizione||'').trim(),
  note:String(form.note||'').trim(),
  tipo:String(form.tipo|| (section==='agenda'?'Appuntamento':'Scadenza')).trim(),
  stato:String(form.stato||'aperta').trim().toLowerCase(),
  priorita:String(form.priorita||'normale').trim().toLowerCase(),
  data_scadenza:String(form.data_scadenza||'').trim()};
 if(!v.titolo||v.titolo.length>180)throw new Error('Inserisci un titolo di massimo 180 caratteri.');
 if(v.descrizione.length>5000||v.note.length>3000)throw new Error('Descrizione o note troppo lunghe.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v.data_scadenza)||
    new Date(v.data_scadenza+'T12:00:00Z').toISOString().slice(0,10)!==v.data_scadenza)
  throw new Error('Inserisci una data valida.');
 if(!['normale','alta','bassa','urgente'].includes(v.priorita))throw new Error('Priorità non valida.');
 if(!['aperta','completata','in corso'].includes(v.stato))throw new Error('Stato non valido.');
 const permitted=section==='agenda'?agendaCategories:deadlineCategories;
 const sameLegacy=original?.tipo===v.tipo&&
  (section==='agenda'?isDiaryEntry(original):isDeadlineEntry(original));
 if(!permitted.includes(v.tipo)&&!sameLegacy)throw new Error('Tipo incompatibile con la sezione.');
 return v;
}
