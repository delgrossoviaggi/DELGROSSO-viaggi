/* DELGROSSO VIAGGI — Generatore ricevuta PDF corretto per iOS/Android/desktop.
   Compatibile con le chiamate esistenti DGReceipt.download(receiptData).
   Nessuna libreria esterna, nessun invio dati a terzi. */
(function () {
  'use strict';

  const PDF_WIDTH = 595.28;
  const PDF_HEIGHT = 841.89;
  const utf8 = new TextEncoder();
  const cp1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
  };

  function safeString(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  }
  function bytesWinAnsi(text) {
    const out = [];
    for (const char of String(text)) {
      const cp = char.codePointAt(0);
      if ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255)) out.push(cp);
      else if (Object.prototype.hasOwnProperty.call(cp1252, cp)) out.push(cp1252[cp]);
      else if (cp === 10) out.push(10);
      else out.push(63); // Unsupported glyph: '?' rather than malformed PDF.
    }
    return Uint8Array.from(out);
  }
  function pdfString(value) {
    // Hexadecimal strings avoid accidental PDF operators and work with WinAnsiEncoding.
    return '<' + Array.from(bytesWinAnsi(safeString(value)), v => v.toString(16).padStart(2, '0')).join('') + '>';
  }
  function concatBytes(parts) {
    const n = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(n);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }
  function jpegInfo(bytes) {
    if (!bytes || bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      let marker = bytes[i + 1]; i += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > bytes.length) break;
      const length = bytes[i] * 256 + bytes[i + 1];
      if (length < 2 || i + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3].includes(marker)) {
        const height = bytes[i + 3] * 256 + bytes[i + 4];
        const width = bytes[i + 5] * 256 + bytes[i + 6];
        const components = bytes[i + 7];
        if (!width || !height || components !== 3) return null;
        return { width, height };
      }
      i += length;
    }
    return null;
  }
  async function loadLogo() {
    try {
      const response = await fetch('assets/logo.JPEG', { cache: 'force-cache' });
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const meta = jpegInfo(bytes);
      return meta ? { bytes, ...meta } : null;
    } catch (_) { return null; }
  }
  function fmtEuro(value) {
    const number = Number(value);
    return `${(Number.isFinite(number) ? number : 0).toFixed(2).replace('.', ',')} €`;
  }
  function shortText(value, limit) {
    const text = safeString(value) || '—';
    return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
  }

  function buildPdf(data, logo) {
    if (!data || typeof data !== 'object') throw new Error('Dati ricevuta mancanti');
    const objs = [];
    const add = (obj) => { objs.push(obj); return objs.length; };
    const rootId = add(null);
    const pagesId = add(null);
    const regularId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const boldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    let imageId = null;
    if (logo?.bytes && logo?.width && logo?.height) {
      imageId = add({ dictionary: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>`, bytes: logo.bytes });
    }

    const ops = [];
    const ink = '0.07 0.12 0.20';
    const muted = '0.29 0.35 0.43';
    const teal = '0.04 0.37 0.53';
    function text(x, y, value, size=11, bold=false, color=ink) {
      const str = shortText(value, 140);
      // Explicit fill color + 0 Tr: fixes invisible text on Apple PDFKit and printing.
      ops.push(`q ${color} rg BT /${bold ? 'FB' : 'FR'} ${size} Tf 0 Tr 1 0 0 1 ${x} ${y} Tm ${pdfString(str)} Tj ET Q`);
    }
    function line(y) { ops.push('q 0.79 0.84 0.89 RG 0.8 w 50 ' + y + ' m 545 ' + y + ' l S Q'); }
    function field(x,y,label,value,fontsize=11,max=60) {
      text(x,y,label.toUpperCase(),8.6,true,muted);
      text(x,y-23,shortText(value,max),fontsize,true,ink);
    }

    if (imageId) {
      const maxW=165,maxH=70,ratio=logo.width/logo.height;
      let iw=maxW, ih=iw/ratio;
      if (ih>maxH) { ih=maxH; iw=ih*ratio; }
      ops.push(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} 50 ${(PDF_HEIGHT-38-ih).toFixed(2)} cm /Im1 Do Q`);
    } else {
      text(50,PDF_HEIGHT-75,'DELGROSSO VIAGGI & LIMOUSINE BUS',16,true,teal);
    }
    text(50,696,'CONFERMA DI PRENOTAZIONE',20,true,ink);
    line(678);
    text(50,650,'DETTAGLI DEL VIAGGIO',9,true,teal);
    field(50,625,'Viaggio',data.viaggio,14,54);
    field(50,572,'Data e ora',`${safeString(data.data) || '—'}${data.ora ? '  |  ' + safeString(data.ora) : ''}`,12,28);
    field(303,572,'Fermata di partenza',data.fermataPartenza || 'Da confermare',11,32);
    line(526);
    text(50,507,'INTESTATARIO',9,true,teal);
    field(50,480,'Nome',data.nome,12,27);
    field(303,480,'Cognome',data.cognome,12,27);
    field(50,419,'Recapito telefonico',data.telefono,12,48);
    line(371);
    text(50,350,'POSTI E QUOTE',9,true,teal);
    field(50,322,'Numero posti',data.numeroPosti ?? (Array.isArray(data.posti) ? data.posti.length : '—'),13,25);
    field(303,322,'Posti assegnati',Array.isArray(data.posti) ? data.posti.join(' - ') : data.posti,12,36);
    field(50,264,'Quota per persona',fmtEuro(data.prezzo),12);
    ops.push('q 0.92 0.96 0.99 rg 50 154 495 69 re f Q');
    text(65,193,'TOTALE PRENOTAZIONE',9,true,teal);
    text(65,166,fmtEuro(data.totale),19,true,ink);
    text(50,124,'Conserva questo documento come riepilogo della prenotazione.',9,false,muted);
    text(50,104,'Lo stato effettivo e i pagamenti devono essere verificati con DELGROSSO.',8,false,muted);
    line(86);
    text(50,68,'DELGROSSO VIAGGI & LIMOUSINE BUS',9,true,ink);
    text(50,52,'www.delgrossoviaggi.it  |  info@delgrossoviaggi.it  |  WhatsApp 366 212 7916',8,false,muted);

    const contentBytes = bytesWinAnsi(ops.join('\n') + '\n');
    const contentsId = add({dictionary: `<< /Length ${contentBytes.length} >>`, bytes: contentBytes});
    const resources = `<< /Font << /FR ${regularId} 0 R /FB ${boldId} 0 R >>${imageId ? ` /XObject << /Im1 ${imageId} 0 R >>` : ''} >>`;
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources ${resources} /Contents ${contentsId} 0 R >>`);
    objs[rootId-1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId-1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

    const parts=[utf8.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offsets=[0];
    let length = parts[0].length;
    const push = v => { parts.push(v); length += v.length; };
    for (let i=0;i<objs.length;i++) {
      offsets.push(length);
      push(utf8.encode(`${i+1} 0 obj\n`));
      const o=objs[i];
      if (o && typeof o === 'object' && o.bytes) {
        push(utf8.encode(o.dictionary + '\nstream\n'));
        push(o.bytes);
        push(utf8.encode('\nendstream\n'));
      } else push(utf8.encode(String(o) + '\n'));
      push(utf8.encode('endobj\n'));
    }
    const startxref=length;
    let tail=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    for (let i=1;i<offsets.length;i++) tail += String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    tail += `trailer\n<< /Size ${objs.length+1} /Root ${rootId} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
    push(utf8.encode(tail));
    return concatBytes(parts);
  }

  function slug(value) {
    return safeString(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'prenotazione';
  }
  async function createBlob(data) {
    const logo=await loadLogo();
    const pdf=buildPdf(data,logo);
    if (pdf.length < 1500) throw new Error('PDF incompleto');
    return new Blob([pdf],{type:'application/pdf'});
  }
  async function download(data) {
    const blob = await createBlob(data);
    const url = URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=`DELGROSSO_conferma_prenotazione_${slug(data.viaggio)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // On iOS Safari, allow enough time for the built-in PDF viewer to read the Blob.
    setTimeout(()=>URL.revokeObjectURL(url),120000);
    return true;
  }
  window.DGReceipt = { download, createBlob };
  // Diagnostic helper for non-production tests. It does not send booking information.
  window.DGReceipt._buildPdf = buildPdf;
})();
