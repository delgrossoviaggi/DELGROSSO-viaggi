/* Filtri della vetrina pubblica, senza dipendenze dai servizi dati. */
(function(root){
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function sold(t){return t.sold_out===true||t.soldOut===true||/sold\s*out|esaurit|complet|chius[oa]|full/.test(normalize(t.stato));}
 function known(t){return t.posti_liberi!==null&&t.posti_liberi!==undefined&&t.posti_liberi!==''&&Number.isFinite(Number(t.posti_liberi));}
 function available(t){return known(t)&&!sold(t)&&Number(t.posti_liberi)>0;}
 function filter(list,{destination='',month='',from='',onlyAvailable=false,today=''}={}){return list.filter(t=>(!today||(t.data_partenza&&String(t.data_partenza).slice(0,10)>=today))&&normalize([t.titolo,t.destinazione].join(' ')).includes(normalize(destination))&&(!month||String(t.data_partenza||'').startsWith(month))&&normalize([t.luogo_partenza,t.punto_ritrovo,t.ritrovo,t.partenza].filter(Boolean).join(' ')).includes(normalize(from))&&(!onlyAvailable||available(t))).sort((a,b)=>String(a.data_partenza).localeCompare(String(b.data_partenza)));}
 const api={normalize,sold,known,available,filter};if(typeof module==='object'&&module.exports)module.exports=api;else root.DGTripDiscovery=api;
})(globalThis);
