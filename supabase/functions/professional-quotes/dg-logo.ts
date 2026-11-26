// Logo ufficiale DELGROSSO Viaggi - limousineBUS (da /logo.JPEG, ritagliato senza bordi).
// Unico logo ammesso sui documenti PDF: niente scritte o loghi alternativi.
// Il file e' fissato a un commit preciso del repository e verificato con SHA-256;
// dopo il primo download ne resta una copia nello storage come riserva.
import { rgb } from "npm:pdf-lib@1.17.1";
export const LOGO_W=760, LOGO_H=397;
const SRC="https://raw.githubusercontent.com/delgrossoviaggi/DELGROSSO-viaggi/ee43173a32d9b16dc1d2f3d36f62d079df9c825e/GESTIONALE/assets/delgrosso-logo-pdf-ufficiale.jpg";
const SHA="5e5df07c0bb7b94c550545ad1ac5300bbb3068f077ca2051450d7d35263dcf69";
const COPY="assets/delgrosso-logo-pdf-ufficiale.jpg";
export const NAVY=rgb(.043,.145,.271), GOLD=rgb(.886,.639,.169), INK=rgb(.08,.14,.21), MUTED=rgb(.36,.43,.50), LINE=rgb(.86,.89,.92);
let store=null,bytes=null;
export function useLogoStorage(client){store=client}
async function genuine(b){const h=new Uint8Array(await crypto.subtle.digest("SHA-256",b));return Array.from(h,x=>x.toString(16).padStart(2,"0")).join("")===SHA}
async function logoBytes(){
  if(bytes)return bytes;
  try{if(store){const d=await store.storage.from("ricevute-prenotazioni").download(COPY);if(!d.error&&d.data){const b=new Uint8Array(await d.data.arrayBuffer());if(await genuine(b))return bytes=b}}}catch{}
  for(let i=0;i<3;i++){
    try{const r=await fetch(SRC);if(r.ok){const b=new Uint8Array(await r.arrayBuffer());if(await genuine(b)){bytes=b;try{if(store)await store.storage.from("ricevute-prenotazioni").upload(COPY,b,{upsert:true,contentType:"image/jpeg",cacheControl:"31536000"})}catch{}return b}}}catch{}
    await new Promise(r=>setTimeout(r,400*(i+1)));
  }
  throw new Error("Logo ufficiale non disponibile in questo momento: riprova tra poco.");
}
const cache=new WeakMap();
async function logo(doc){let i=cache.get(doc);if(!i){i=await doc.embedJpg(await logoBytes());cache.set(doc,i)}return i}
const right=(page,font,text,size,y,color)=>{const W=page.getWidth();page.drawText(text,{x:W-42-font.widthOfTextAtSize(text,size),y,size,font,color})};
// Intestazione di prima pagina: logo ufficiale a sinistra, titolo e dati del documento a destra.
// Restituisce la quota y da cui iniziare il contenuto.
export async function brandHeader(doc,page,reg,bold,o){
  const W=page.getWidth(),H=page.getHeight(),img=await logo(doc),lw=158,lh=lw*LOGO_H/LOGO_W;
  page.drawImage(img,{x:38,y:H-30-lh,width:lw,height:lh});
  right(page,bold,o.title,14.5,H-52,NAVY);
  let y=H-70;for(const s of (o.lines||[])){if(s){right(page,s.bold?bold:reg,s.text,s.size||9,y,s.color||INK);y-=14}}
  if(o.note)right(page,bold,o.note,7,H-122,MUTED);
  page.drawRectangle({x:42,y:H-136,width:W-84,height:1.2,color:NAVY});
  page.drawRectangle({x:42,y:H-138.5,width:72,height:3.5,color:GOLD});
  return H-166;
}
// Intestazione ridotta per le pagine successive.
export async function brandMini(doc,page,reg,label){
  const W=page.getWidth(),H=page.getHeight(),img=await logo(doc),lw=78,lh=lw*LOGO_H/LOGO_W;
  page.drawImage(img,{x:40,y:H-22-lh,width:lw,height:lh});
  right(page,reg,label,8.5,H-46,MUTED);
  page.drawRectangle({x:42,y:H-70,width:W-84,height:.8,color:LINE});
  return H-92;
}
