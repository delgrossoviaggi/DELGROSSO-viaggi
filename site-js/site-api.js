import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SITE_CONFIG } from './site-config.js';

let client;
export function getSupabase(){
  if(!client) client=createClient(SITE_CONFIG.supabaseUrl,SITE_CONFIG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
export function escapeHtml(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function publicUrl(v){return typeof v==='string'&&/^https?:/i.test(v)?v:'';}
export function formatDate(v){if(!v)return '';const d=new Date(String(v).slice(0,10)+'T00:00:00');return Number.isNaN(d.getTime())?'':d.toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});}
export function formatDateTime(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});}
export function formatEuro(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v)||0);}

async function query(table,select='*',mutate){
  try{let q=getSupabase().from(table).select(select);if(mutate)q=mutate(q)||q;const {data,error}=await q;if(error)throw error;return{ok:true,data:data||[],error:null};}
  catch(error){console.error('[DELGROSSO SITE]',table,error);return{ok:false,data:[],error};}
}
export const getHomeCarousel=()=>query('site_media','*',q=>q.eq('category','carousel').eq('published',true).order('sort_order').order('created_at',{ascending:false}));
export const getViaggiCarousel=()=>query('site_carousel_viaggi','*',q=>q.eq('published',true).order('sort_order').order('created_at',{ascending:false}));
export const getFleet=()=>query('site_fleet','*',q=>q.eq('published',true).order('sort_order').order('created_at',{ascending:false}));
export const getPartyEvents=()=>query('site_party_events','*',q=>q.eq('published',true).order('sort_order').order('event_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}));
export const getPosts=()=>query('site_posts','*',q=>q.eq('published',true).order('published_at',{ascending:false,nullsFirst:false}).order('sort_order').order('created_at',{ascending:false}));
export const getSettings=()=>query('site_settings','*',q=>q.limit(1));

export async function uploadSiteFile(file,folder='uploads'){
  if(!file)throw new Error('Nessun file selezionato.');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const safe=(file.name.replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,70)||'file');
  const path=`${folder}/${safe}`;
  const {error}=await getSupabase().storage.from(SITE_CONFIG.storageBucket).upload(path,file,{upsert:false,contentType:file.type||undefined});
  if(error)throw error;
  return {path,url:getSupabase().storage.from(SITE_CONFIG.storageBucket).getPublicUrl(path).data.publicUrl,originalName:file.name};
}
export async function removeSiteFile(path){if(!path)return;const {error}=await getSupabase().storage.from(SITE_CONFIG.storageBucket).remove([path]);if(error)console.warn(error);}
export async function getSession(){return (await getSupabase().auth.getSession()).data.session;}
export async function signIn(email,password){return getSupabase().auth.signInWithPassword({email,password});}
export async function signOut(){return getSupabase().auth.signOut();}
export async function isAdmin(){const {data,error}=await getSupabase().rpc('is_site_admin');return !error&&data===true;}
