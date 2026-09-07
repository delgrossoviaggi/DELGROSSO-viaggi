const SITE_URL='https://bhsanrbadsqcpbtxupmr.supabase.co';
const SITE_KEY='sb_publishable_jcc3RIJmNnXZdhcmFuIKFg_EpxO_rBp';
const headers={apikey:SITE_KEY,Authorization:`Bearer ${SITE_KEY}`};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function siteTable(table,params='select=*'){const r=await fetch(`${SITE_URL}/rest/v1/${table}?${params}`,{headers,cache:'no-store'});if(!r.ok)throw new Error(`Supabase SITO · ${table}: HTTP ${r.status}`);return r.json()}
export async function getSiteFleet(){return siteTable('flotta_page','select=id,titolo,descrizione,immagine_url,foto_urls,foto_gallery,categoria,posti,pubblicato,attivo&pubblicato=eq.true&attivo=eq.true&order=sort_order.asc,created_at.desc')}
export async function getHomeCarousel(){return siteTable('carousel_home','select=id,titolo,foto_urls&pubblicato=eq.true&order=sort_order.asc,created_at.desc')}
export async function getFleetCarousel(){return siteTable('carousel_flotta','select=id,titolo,immagine_url&pubblicato=eq.true&order=sort_order.asc,created_at.desc')}
export async function getEventGallery(){return siteTable('gallery_eventi','select=id,titolo,data_evento,foto_urls&pubblicato=eq.true&order=data_evento.desc,created_at.desc')}
export {esc};
