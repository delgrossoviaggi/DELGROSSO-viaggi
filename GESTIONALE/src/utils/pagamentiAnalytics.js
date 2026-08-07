export function analytics(rows=[]){
  return{
    totaleMovimenti:rows.length,
    incassati:rows.filter(r=>r.stato==='Pagato').length,
    scaduti:rows.filter(r=>r.stato==='Scaduto').length,
    insoluti:rows.filter(r=>r.stato==='Insoluto').length
  };
}