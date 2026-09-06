export const SITE_URL='https://exphxbeqwpwrsigdmilc.supabase.co';
export const SITE_KEY='sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';
let ACCESS_TOKEN='';
export function setAccessToken(token){ACCESS_TOKEN=token||''}
export function headers(){return {apikey:SITE_KEY,Authorization:`Bearer ${ACCESS_TOKEN||SITE_KEY}`,'Content-Type':'application/json'}}
export async function siteFetch(table,{select='*',filters=[],order='created_at.desc',limit}={}){const u=new URL(`${SITE_URL}/rest/v1/${table}`);u.searchParams.set('select',select);if(order)u.searchParams.set('order',order);if(limit)u.searchParams.set('limit',limit);for(const [field,op,value] of filters)u.searchParams.set(field,`${op}.${value}`);const r=await fetch(u,{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(`${table}: HTTP ${r.status}`);return r.json()}
export async function insertRow(table,payload){const r=await fetch(`${SITE_URL}/rest/v1/${table}`,{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);return r.json()}
export async function updateRow(table,id,payload){const r=await fetch(`${SITE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);return r.json()}
export async function deleteRow(table,id){const r=await fetch(`${SITE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:headers()});if(!r.ok)throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`)}
export function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function allImages(row){return [...new Set([row?.immagine_url,...(Array.isArray(row?.foto_urls)?row.foto_urls:[]),...(Array.isArray(row?.foto_gallery)?row.foto_gallery:[])].filter(Boolean))]}
export function firstImage(row){return allImages(row)[0]||''}
export function formatDate(v){if(!v)return 'Data da definire';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?v:d.toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'})}
