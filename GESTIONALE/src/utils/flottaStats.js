export function calcolaStatistiche(rows=[]){
  return {
    totali: rows.length,
    operativi: rows.filter(r=>r.stato==='Operativo').length,
    manutenzione: rows.filter(r=>r.stato==='In manutenzione').length,
    fuoriServizio: rows.filter(r=>r.stato==='Fuori servizio').length
  };
}