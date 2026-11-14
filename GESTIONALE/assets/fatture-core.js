/* DELGROSSO 3.0 — Motore bozze non fiscali. Dati monetari in centesimi interi.
 * Nessuna numerazione fiscale, invio SdI o applicazione automatica aliquote.
 */
(function(root,factory){
  const exports=factory();
  if(typeof module==='object'&&module.exports)module.exports=exports;
  if(root)root.DGInvoiceCore=exports;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const allowedTypes=new Set(['immediata','acconto','saldo','differita','nota_credito']);
  function cents(raw){
    const x=String(raw??'').trim().replace(',','.');
    if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(x))throw Error('Importo non valido. Inserisci al massimo due decimali e nessun importo negativo.');
    const [euros,decimals='']=x.split('.');
    const result=Number(euros)*100+Number((decimals+'00').slice(0,2));
    if(!Number.isSafeInteger(result)||result>999999999999)throw Error('Importo fuori limite');
    return result;
  }
  function eur(value){const c=Number(value);if(!Number.isSafeInteger(c))throw Error('Centesimi non validi');return (c/100).toLocaleString('it-IT',{style:'currency',currency:'EUR'});}
  function vatBasisPoints(value){
    const x=String(value??'').trim().replace(',','.');
    if(!/^(0|[1-9]\d?)(\.\d{1,2})?$/.test(x))throw Error('Aliquota IVA non valida');
    const bp=cents(x);if(bp>10000)throw Error('Aliquota superiore al 100%');return bp;
  }
  function roundedMul(value,bps){return Math.floor((value*bps+5000)/10000);}
  function validateIds(reference){
    const type=String(reference?.tipo||'manuale');
    if(!['manuale','prenotazione','noleggio'].includes(type))throw Error('Origine documento non valida');
    if(type!=='manuale'&&!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(reference.id||'')))throw Error('Riferimento documento non valido');
    return type;
  }
  function buildDraft(input){
    if(!input||!allowedTypes.has(input.tipo_documento))throw Error('Tipologia documento non valida');
    const issuer=input.emittente||{},recipient=input.destinatario||{};
    const issuerName=String(issuer.ragione_sociale||'').trim();
    if(!issuerName||!/^[0-9]{11}$/.test(String(issuer.partita_iva||'').trim()))throw Error('Ragione sociale e partita IVA di 11 cifre dell’emittente sono obbligatorie');
    const recipientName=String(recipient.denominazione||'').trim();
    if(!recipientName||!(String(recipient.codice_fiscale||'').trim()||String(recipient.partita_iva||'').trim()))throw Error('Cliente e almeno un identificativo fiscale sono obbligatori');
    const recipientVAT=String(recipient.partita_iva||'').trim();
    if(recipientVAT&&!/^[0-9]{11}$/.test(recipientVAT))throw Error('Partita IVA cliente non valida (11 cifre)');
    const vat=vatBasisPoints(input.aliquota_iva);
    const natura=String(input.natura_iva||'').trim().toUpperCase();
    if(vat===0&&!/^N[1-7](?:\.[0-9]+)?$/.test(natura))throw Error('Con aliquota IVA zero occorre indicare un codice natura da convalidare con il commercialista');
    if(vat!==0&&natura)throw Error('Con IVA diversa da zero lascia vuoto il codice natura');
    const rawLines=input.righe||[];
    if(!Array.isArray(rawLines)||rawLines.length===0||rawLines.length>30)throw Error('Inserisci da 1 a 30 righe');
    let taxable=0;const lines=rawLines.map((line,i)=>{
      const desc=String(line.descrizione||'').trim();if(!desc||desc.length>400)throw Error('Descrizione mancante o troppo lunga alla riga '+(i+1));
      const quantity=Number(line.quantita);
      if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw Error('Quantità non valida alla riga '+(i+1));
      const price=cents(line.prezzo_unitario);
      const subtotal=quantity*price;
      if(!Number.isSafeInteger(subtotal))throw Error('Valore eccessivo alla riga '+(i+1));
      taxable+=subtotal;
      return {descrizione:desc,quantita:quantity,prezzo_unitario_centesimi:price,imponibile_centesimi:subtotal};
    });
    if(!taxable||!Number.isSafeInteger(taxable))throw Error('Inserisci almeno un importo positivo');
    const tax=roundedMul(taxable,vat);
    const refType=validateIds(input.riferimento||{tipo:'manuale'});
    const data=String(input.data_bozza||'');if(!/^20\d\d-\d\d-\d\d$/.test(data)||!Number.isFinite(Date.parse(data+'T00:00:00Z')))throw Error('Data bozza non valida');
    return {
      data_bozza:data,tipo_documento:input.tipo_documento,
      prenotazione_id:refType==='prenotazione'?input.riferimento.id:null,
      noleggio_id:refType==='noleggio'?input.riferimento.id:null,
      cliente_id:null,
      emittente:{ragione_sociale:issuerName,partita_iva:String(issuer.partita_iva).trim(),codice_fiscale:String(issuer.codice_fiscale||'').trim(),indirizzo:String(issuer.indirizzo||'').trim(),cap:String(issuer.cap||'').trim(),comune:String(issuer.comune||'').trim(),provincia:String(issuer.provincia||'').trim(),regime_fiscale:String(issuer.regime_fiscale||'').trim()},
      destinatario:{denominazione:recipientName,partita_iva:recipientVAT,codice_fiscale:String(recipient.codice_fiscale||'').trim().toUpperCase(),indirizzo:String(recipient.indirizzo||'').trim(),cap:String(recipient.cap||'').trim(),comune:String(recipient.comune||'').trim(),provincia:String(recipient.provincia||'').trim(),codice_destinatario:String(recipient.codice_destinatario||'').trim().toUpperCase(),pec:String(recipient.pec||'').trim()},
      righe:lines,aliquota_iva:vat/100,natura_iva:vat===0?natura:null,
      imponibile_centesimi:taxable,iva_centesimi:tax,totale_centesimi:taxable+tax,
      note_interne:String(input.note_interne||'').trim().slice(0,1500),stato:'bozza'
    };
  }
  function readiness(draft){const issues=[];
    if(!draft.emittente.indirizzo||!draft.emittente.cap||!draft.emittente.comune||!draft.emittente.regime_fiscale)issues.push('Completare sede e regime fiscale emittente');
    if(!draft.destinatario.indirizzo||!draft.destinatario.cap||!draft.destinatario.comune)issues.push('Completare indirizzo fiscale destinatario');
    if(!draft.destinatario.codice_destinatario&&!draft.destinatario.pec)issues.push('Inserire e verificare codice destinatario / PEC dove richiesti');
    issues.push('Convalidare inquadramento IVA e natura fiscale con il commercialista');
    issues.push('Numerazione fiscale, tracciato FatturaPA, provider SdI, notifiche e conservazione non configurati');
    return issues;
  }
  return Object.freeze({cents,eur,vatBasisPoints,roundedMul,buildDraft,readiness});
});
