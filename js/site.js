
const SITE_URL='https://bhsanrbadsqcpbtxupmr.supabase.co';
const SITE_KEY='sb_publishable_jcc3RIJmNnXZdhcmFuIKFg_EpxO_rBp';
const H={apikey:SITE_KEY,Authorization:`Bearer ${SITE_KEY}`};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function siteGet(table,query='select=*'){const r=await fetch(`${SITE_URL}/rest/v1/${table}?${query}`,{headers:H,cache:'no-store'});if(!r.ok)throw new Error(`SITO ${table}: HTTP ${r.status}`);return r.json()}
export async function siteWrite(table,body,method='POST',query=''){const r=await fetch(`${SITE_URL}/rest/v1/${table}${query}`,{method,headers:{...H,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());return r.json()}
export const fleet=()=>siteGet('flotta_page','select=id,titolo,descrizione,immagine_url,foto_urls,foto_gallery,categoria,posti,pubblicato,attivo&pubblicato=eq.true&attivo=eq.true&order=sort_order.asc,created_at.desc');
export const carousel=()=>siteGet('carousel_home','select=id,titolo,foto_urls&pubblicato=eq.true&order=sort_order.asc,created_at.desc');
export const gallery=()=>siteGet('gallery_eventi','select=id,titolo,data_evento,foto_urls&pubblicato=eq.true&order=data_evento.desc,created_at.desc');
export const settings=()=>siteGet('info_azienda','select=*&id=eq.1');
export const publicAsset=(row)=>row?.immagine_url||row?.foto_urls?.[0]||row?.foto_gallery?.[0]||'';
export {SITE_URL,SITE_KEY,H,esc};
