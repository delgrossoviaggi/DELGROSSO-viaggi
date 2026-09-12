/* DELGROSSO GESTIONALE — AUTH V59
 * Supabase Auth is the source of truth for the two administrators.
 * The local cache exists only to keep the existing UI modules compatible.
 */
const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const SESSION_KEY='dg_session';
const ACCOUNTS_KEY='dg_accounts_v2';
const ADMINS=[
  {id:'acc-nicola',username:'Nicola',email:'nicola@delgrossoviaggi.it',nome:'Nicola Pio',ruolo:'admin',attivo:true},
  {id:'acc-raffaele',username:'Raffaele',email:'raffaele@delgrossoviaggi.it',nome:'Raffaele',ruolo:'admin',attivo:true}
];
let client=null;
async function getClient(){
  if(client)return client;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{db:{schema:'public'},auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
  return client;
}
function cacheUser(u){
  if(!u){localStorage.removeItem(SESSION_KEY);window.__currentUser=null;window.__userRole=null;return null;}
  const out={authenticated:true,username:u.username||u.email?.split('@')[0]||'',email:u.email||'',nome:u.nome||u.user_metadata?.nome||u.user_metadata?.name||u.email||'',ruolo:'admin',supabase_user_id:u.id||''};
  localStorage.setItem(SESSION_KEY,JSON.stringify(out));window.__currentUser=out;window.__userRole='admin';return out;
}
function cached(){try{const v=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');return v?.authenticated?v:null}catch{return null}}
function normalizeLogin(v){return String(v||'').trim().toLowerCase()}
function accountFor(login){const q=normalizeLogin(login);return ADMINS.find(a=>normalizeLogin(a.username)===q||normalizeLogin(a.email)===q)||null}
async function login(login,password){
  const acc=accountFor(login); const email=acc?.email||normalizeLogin(login);
  if(!email||!password)throw new Error('Inserisci username/email e password.');
  const sb=await getClient();
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)throw new Error(error.message||'Credenziali non valide');
  if(!data?.user||!data?.session)throw new Error('Accesso Supabase non completato.');
  const meta=data.user.user_metadata||{};
  const out=cacheUser({...data.user,nome:meta.nome||acc?.nome||data.user.email,username:meta.username||acc?.username||data.user.email,ruolo:'admin'});
  return out;
}
async function logout(){try{const sb=await getClient();await sb.auth.signOut()}finally{cacheUser(null)}}
function current(){return cached()}
function isAuthenticated(){return !!cached()}
function roleLabel(role){return String(role||'').toLowerCase()==='admin'?'Amministratore':String(role||'').toLowerCase()==='operatore'?'Operatore':'Collaboratore'}
function getAccounts(){return ADMINS.map(x=>({...x}))}
async function updateAccount(id,patch={}){
  const currentUser=cached();
  if(id!==currentUser?.supabase_user_id) throw new Error('Per sicurezza puoi modificare solo il tuo account.');
  const sb=await getClient();
  const clean={}; if(patch.password!==undefined)clean.password=String(patch.password); if(patch.nome)clean.data={nome:String(patch.nome),username:currentUser.username,ruolo:'admin'};
  const {data,error}=await sb.auth.updateUser(clean); if(error)throw error;
  return cacheUser({...data.user,nome:data.user.user_metadata?.nome||currentUser.nome,username:data.user.user_metadata?.username||currentUser.username,ruolo:'admin'});
}
function createAccount(){throw new Error('I nuovi account vengono creati da Supabase Auth tramite la procedura Amministratori.');}
function removeAccount(){throw new Error('Gli amministratori Nicola e Raffaele sono account protetti.');}
function setActive(){return true}
async function changePassword(id,password){return updateAccount(id,{password})}

// Keep the legacy synchronous surface used by existing modules.
window.DG_AUTH={getClient,login,logout,current,isAuthenticated,getAccounts,roleLabel,updateAccount,changePassword};
export{current as a,login as c,updateAccount as d,getAccounts as i,logout as l,createAccount as n,roleLabel as o,removeAccount as r,isAuthenticated as s,changePassword as t,setActive as u,getClient};
