/* DELGROSSO - Conferma PDF prenotazione
   Generazione locale nel browser. Il flusso di prenotazione può inviare il PDF al server per archiviarlo. */
(function(){
  'use strict';

  function latinText(value){
    return String(value ?? '')
      .replace(/[àáâäãå]/gi,'a').replace(/[èéêë]/gi,'e').replace(/[ìíîï]/gi,'i')
      .replace(/[òóôöõ]/gi,'o').replace(/[ùúûü]/gi,'u').replace(/[ç]/gi,'c')
      .replace(/[ÀÁÂÄÃÅ]/g,'A').replace(/[ÈÉÊË]/g,'E').replace(/[ÌÍÎÏ]/g,'I')
      .replace(/[ÒÓÔÖÕ]/g,'O').replace(/[ÙÚÛÜ]/g,'U').replace(/[Ç]/g,'C')
      .replace(/€/g,'EUR')
      .replace(/[–—−]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
      .replace(/[^\x20-\x7E]/g,' ');
  }
  function pdfEscape(value){
    return latinText(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  }
  function pdfBytes(parts){
    const enc=new TextEncoder();
    let total=0; const arr=parts.map(p=>typeof p==='string'?enc.encode(p):p); arr.forEach(a=>total+=a.length);
    const out=new Uint8Array(total); let off=0; arr.forEach(a=>{out.set(a,off);off+=a.length}); return out;
  }
  function jpegInfo(bytes){
    if(bytes.length<64||bytes[0]!==0xFF||bytes[1]!==0xD8)return null;
    let i=2;
    while(i<bytes.length-9){
      if(bytes[i]!==0xFF){i++;continue}
      const marker=bytes[i+1]; i+=2;
      if(marker===0xD8||marker===0xD9||marker===0x01) continue;
      if(i+1>=bytes.length) break;
      const len=(bytes[i]<<8)|bytes[i+1];
      if(marker>=0xC0&&marker<=0xC3){
        const height=(bytes[i+3]<<8)|bytes[i+4],width=(bytes[i+5]<<8)|bytes[i+6];
        return width>0&&height>0&&bytes[i+7]===3?{height,width}:null;
      }
      i+=len;
    }
    return null;
  }
  async function loadLogo(){
    try{
      const r=await fetch('assets/logo.JPEG',{cache:'no-store'}); if(!r.ok) return null;
      const b=new Uint8Array(await r.arrayBuffer()),info=jpegInfo(b);
      return info?{bytes:b,...info}:null;
    }catch(e){return null}
  }
  function buildPdf(data,logo){
    const W=595,H=842, objects=[];
    function add(body){objects.push(body);return objects.length}
    const catalog=add('<< /Type /Catalog /Pages 2 0 R >>');
    const pages=2;
    const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    let imageId=null;
    if(logo){
      imageId=add({dict:`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>`,stream:logo.bytes});
    }
    const content=[];
    const line=(x,y,text,size=11,bold=false)=>{
      // Keep long customer names and trip titles within the A4 page margins.
      const available=Math.max(60,W-x-50);
      const maxChars=Math.max(8,Math.floor(available/(size*0.56)));
      const normalized=latinText(text).replace(/[\r\n\t]+/g,' ').trim();
      const label=normalized.length>maxChars?normalized.slice(0,maxChars-3)+'...':normalized;
      content.push(`BT /F${bold?'2':'1'} ${size} Tf 0 Tr 1 0 0 1 ${x} ${y} Tm (${pdfEscape(label)}) Tj ET`);
    };
    content.push('q');
    if(imageId){
      const maxW=180,maxH=75,ratio=logo.width/logo.height; let iw=maxW,ih=iw/ratio;if(ih>maxH){ih=maxH;iw=ih*ratio;}
      content.push(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} 50 ${(H-50-ih).toFixed(2)} cm /Im1 Do Q`);
    } else {
      line(50,760,'DELGROSSO VIAGGI & LIMOUSINE BUS',15,true);
    }
    content.push('Q');
    line(50,690,'CONFERMA DI PRENOTAZIONE',21,true);
    if(data.riferimento) line(50,655,`Riferimento: ${data.riferimento}`,10,false);
    content.push('0.78 0.78 0.78 RG 1 w 50 670 m 545 670 l S');
    line(50,630,'Viaggio',9,false); line(50,610,data.viaggio,14,true);
    line(50,575,'Data e ora',9,false); line(50,555,`${data.data||''}${data.ora?' - '+data.ora:''}`,12,true);
    line(50,515,'Nome',9,false); line(50,495,data.nome,12,true);
    line(310,515,'Cognome',9,false); line(310,495,data.cognome,12,true);
    line(50,455,'Recapito telefonico',9,false); line(50,435,data.telefono,12,true);
    line(50,395,'N. posti prenotati',9,false); line(50,375,String(data.numeroPosti),14,true);
    line(310,395,'Posti scelti',9,false); line(310,375,data.posti.join(' - '),14,true);
    line(50,330,'Prezzo per persona',9,false); line(50,310,`EUR ${data.prezzo.toFixed(2)}`,12,true);
    line(50,265,'TOTALE VIAGGIO',10,false); line(50,235,`EUR ${data.totale.toFixed(2)}`,25,true);
    content.push('0.94 0.97 1 rg 50 175 495 42 re f');
    content.push('0 0 0 rg');
    line(65,198,'Conserva questo documento come conferma della prenotazione.',10,true);
    line(50,142,'La conferma non costituisce ricevuta di pagamento.',9,false);
    line(50,105,'DELGROSSO Viaggi & Limousine Bus',9,false);
    line(50,88,'Conferma generata automaticamente dal sito ufficiale.',8,false);
    const stream=content.join('\n');
    const resources=`<< /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >>${imageId?` /XObject << /Im1 ${imageId} 0 R >>`:''} >>`;
    const contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Contents ${contentId} 0 R >>`);
    // Rebuild Pages now that page id is known.
    objects[1]=`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;
    const header='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const enc=new TextEncoder(); let body=enc.encode(header), offsets=[0];
    function join(a,b){const out=new Uint8Array(a.length+b.length);out.set(a);out.set(b,a.length);return out;}
    for(let n=0;n<objects.length;n++){
      offsets.push(body.length);
      let objHead=enc.encode(`${n+1} 0 obj\n`);
      let objBody;
      const obj=objects[n];
      if(obj&&typeof obj==='object'&&obj.stream){
        objBody=enc.encode(obj.dict+'\nstream\n'); body=join(body,objHead);body=join(body,objBody);body=join(body,obj.stream);body=join(body,enc.encode('\nendstream\nendobj\n'));
      }else{
        body=join(body,objHead);body=join(body,enc.encode(String(obj)+'\nendobj\n'));
      }
    }
    const xref=body.length; let tail=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<offsets.length;i++) tail+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    tail+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return join(body,enc.encode(tail));
  }
  function slug(s){return latinText(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'prenotazione';}
  async function generate(data){
    const logo=await loadLogo();
    const bytes=buildPdf(data,logo);
    // Fail closed if PDF generation returned an empty or malformed payload.
    if(bytes.length<100 || String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-'){
      throw new Error('Impossibile generare una conferma PDF valida.');
    }
    return new Blob([bytes],{type:'application/pdf'});
  }
  window.DGReceipt={
    generate,
    async download(data){
      const blob=await generate(data); const url=URL.createObjectURL(blob); const a=document.createElement('a');
      a.href=url; a.download=`conferma-prenotazione-${slug(data.viaggio)}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),15000); return true;
    }
  };
})();
