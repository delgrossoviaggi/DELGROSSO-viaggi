export const SITE_URL='https://exphxbeqwpwrsigdmilc.supabase.co';
export const SITE_KEY='sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';
let ACCESS_TOKEN='';
export function setAccessToken(token){ACCESS_TOKEN=token||''}
function headers(){return {apikey:SITE_KEY,Authorization:`Bearer ${ACCESS_TOKEN||SITE_KEY}`,'Content-Type':'application/json'}}
export async function siteFetch(table,{select='*',filters=[],order='created_at.desc',limit}={}){let u=new URL(`${SITE_URL}/rest/v1/${table}`);u.searchParams.set('select',select);if(order)u.searchParams.set('order',order);if(limit)u.searchParams.set('limit',limit);for(const f of filters)u.searchParams.set(f[0],`${f[1]}.${f[2]}`);const r=await fetch(u,{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);return r.json()}
export async function insertRow(table,payload){const r=await fetch(`${SITE_URL}/rest/v1/${table}`,{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);return r.json()}
export async function updateRow(table,id,payload){const r=await fetch(`${SITE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);return r.json()}
export async function deleteRow(table,id){const r=await fetch(`${SITE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:headers());if(!r.ok)throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`)}
export function img(url, fallback=''){return url||fallback}
export function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function firstImage(row){return row?.immagine_url||row?.immagine||row?.foto_gallery?.[0]||row?.foto_urls?.[0]||''}
export function allImages(row){return [...new Set([...(Array.isArray(row?.foto_gallery)?row.foto_gallery:[]),...(Array.isArray(row?.foto_urls)?row.foto_urls:[]),row?.immagine_url,row?.immagine].filter(Boolean))]}
