/*
 * DELGROSSO Viaggi — Ricevuta PDF prenotazione sito
 * Unico modulo dedicato alla ricevuta: genera e scarica automaticamente
 * la conferma con logo, nominativo, telefono, viaggio, posti e totale.
 */
(function(){
  'use strict';

  const LOGO_URL = 'assets/logo.JPEG';
  let logoPromise = null;

  function imageAsDataUrl(url){
    if(logoPromise) return logoPromise;
    logoPromise = fetch(url,{cache:'force-cache'})
      .then(r=>{ if(!r.ok) throw new Error('Logo non disponibile'); return r.blob(); })
      .then(blob=>new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(new Error('Logo non leggibile'));
        reader.readAsDataURL(blob);
      }));
    return logoPromise;
  }

  const clean = value => String(value ?? '').trim();
  const money = value => `€ ${Number(value||0).toFixed(2).replace('.',',')}`;
  const safeFile = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70) || 'prenotazione';
  const dateIt = value => {
    if(!value) return '';
    const d=new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? clean(value) : new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  };
  const timeIt = value => clean(value).slice(0,5);

  async function generatePrenotazioneRicevuta({booking, trip}){
    const nome=clean(booking?.nome);
    const cognome=clean(booking?.cognome);
    const telefono=clean(booking?.telefono);
    const posti=Array.isArray(booking?.posti) ? booking.posti.map(Number).filter(Number.isFinite).sort((a,b)=>a-b) : [];
    const prezzoPersona=Number(trip?.prezzo||0);
    const totale=prezzoPersona*posti.length;

    if(!nome || !cognome || !telefono || !trip || !posti.length){
      throw new Error('Dati insufficienti per generare la ricevuta PDF');
    }
    if(!window.jspdf?.jsPDF) throw new Error('Libreria PDF non disponibile');

    const [logo]=await Promise.all([imageAsDataUrl(LOGO_URL)]);
    const jsPDF=window.jspdf.jsPDF;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const pageW=210;
    const margin=18;

    doc.setFillColor(7,17,31);
    doc.roundedRect(margin,14,pageW-margin*2,35,5,5,'F');
    try{ doc.addImage(logo,'JPEG',margin+5,19,35,25); }catch(e){}

    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(14);
    doc.text('DELGROSSO VIAGGI',margin+45,26);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    doc.text('& LIMOUSINE BUS',margin+45,32);
    doc.setFontSize(9);
    doc.text('RICEVUTA DI PRENOTAZIONE',pageW-margin,26,{align:'right'});
    doc.setFontSize(7.5);
    doc.text('Conferma automatica della prenotazione online',pageW-margin,32,{align:'right'});

    doc.setTextColor(7,17,31);
    doc.setFont('helvetica','bold');
    doc.setFontSize(20);
    doc.text('RICEVUTA DI PRENOTAZIONE',margin,64);
    doc.setDrawColor(25,118,201);
    doc.setLineWidth(1);
    doc.line(margin,69,pageW-margin,69);

    doc.setFillColor(238,247,255);
    doc.roundedRect(margin,78,pageW-margin*2,38,5,5,'F');
    doc.setTextColor(10,79,136);
    doc.setFontSize(8);
    doc.text('VIAGGIO PRENOTATO',margin+7,87);
    doc.setTextColor(7,17,31);
    doc.setFontSize(13);
    doc.setFont('helvetica','bold');
    const tripTitle=clean(trip?.titolo||trip?.destinazione||'Viaggio');
    const tripLines=doc.splitTextToSize(tripTitle,pageW-margin*2-14);
    doc.text(tripLines,margin+7,96);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    const routeParts=[dateIt(trip?.data_partenza),timeIt(trip?.ora_partenza),clean(trip?.luogo_partenza)].filter(Boolean);
    doc.text(routeParts.join('  ·  '),margin+7,109);

    function row(y,label,value){
      doc.setDrawColor(222,230,238);
      doc.setLineWidth(.35);
      doc.line(margin,y+8,pageW-margin,y+8);
      doc.setTextColor(103,119,138);
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);
      doc.text(label,margin,y);
      doc.setTextColor(7,17,31);
      doc.setFont('helvetica','normal');
      doc.setFontSize(10.5);
      const lines=doc.splitTextToSize(clean(value),pageW-margin*2-55);
      doc.text(lines,pageW-margin,y,{align:'right'});
      return Math.max(12,lines.length*5+7);
    }

    let y=130;
    y+=row(y,'Nome',nome);
    y+=row(y,'Cognome',cognome);
    y+=row(y,'Recapito telefonico',telefono);
    y+=row(y,'N° posti prenotati',String(posti.length));
    y+=row(y,'Posti scelti',posti.join('  ·  '));

    y+=7;
    doc.setFillColor(7,17,31);
    doc.roundedRect(margin,y,pageW-margin*2,31,5,5,'F');
    doc.setTextColor(166,183,201);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text('Prezzo viaggio per persona',margin+8,y+11);
    doc.setTextColor(255,255,255);
    doc.setFontSize(11);
    doc.setFont('helvetica','bold');
    doc.text(money(prezzoPersona),pageW-margin-8,y+11,{align:'right'});
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text(`${posti.length} ${posti.length===1?'posto':'posti'} × ${money(prezzoPersona)}`,margin+8,y+22);
    doc.setFont('helvetica','bold');
    doc.setFontSize(17);
    doc.text(money(totale),pageW-margin-8,y+23,{align:'right'});

    const footerY=y+49;
    doc.setTextColor(91,106,123);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.text('Ricevuta generata automaticamente dal sito DELGROSSO Viaggi.',pageW/2,footerY,{align:'center'});
    doc.setFontSize(7.5);
    doc.text('Conserva questo documento come conferma della prenotazione e dei posti selezionati.',pageW/2,footerY+5,{align:'center'});

    const codice=safeFile(booking?.numero||booking?.id_prenotazione||booking?.id||'');
    const tripName=safeFile(tripTitle);
    doc.save(`Ricevuta-Prenotazione-${tripName}-${codice}.pdf`);
    return true;
  }

  window.generatePrenotazioneRicevuta = generatePrenotazioneRicevuta;
})();
