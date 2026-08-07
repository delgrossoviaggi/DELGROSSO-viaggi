export function calcolaStatistiche(rows=[]){
  return {
    totali: rows.length,
    programmati: rows.filter(r=>r.stato==='Programmato').length,
    inCorso: rows.filter(r=>r.stato==='In corso').length,
    completati: rows.filter(r=>r.stato==='Completato').length
  };
}