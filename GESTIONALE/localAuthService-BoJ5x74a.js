/* DELGROSSO GESTIONALE — AUTH V60
 * Login locale del Gestionale. Supabase Auth non è richiesto per l'operatività.
 * Il database è configurato separatamente per consentire al frontend operativo di funzionare.
 */
const SUPABASE_URL='https://chkuayhbmitdmzmmvona.supabase.co';
const SUPABASE_KEY='sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';
const SESSION_KEY='dg_session';
const ADMINS=[
  {id:'acc-nicola',username:'Nicola',email:'nicola@delgrossoviaggi.it',nome:'Nicola Pio',ruolo:'admin',attivo:true},
  {id:'acc-raffaele',username:'Raffaele',email:'raffaele@delgrossoviaggi.it',nome:'Raffaele',ruolo:'admin',attivo:true}
];
const PASSWORD_SALT='DG-V60-LOCAL-AUTH';
// SHA-256 della password amministrativa scelta dall'utente, con salt applicativo.
const PASSWORD_HASH='f6f39658253bd87287ae97eeb185b73e7eda86cb9c8dd72abc7ac857191a8b1a';
let client=null;
async function getClient(){
  if(client)return client;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{db:{schema:'public'},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return client;
}
async function sha256(v){
  const data=new TextEncoder().encode(String(v));
  const buf=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function cacheUser(u){
  if(!u){localStorage.removeItem(SESSION_KEY);window.__currentUser=null;window.__userRole=null;return null;}
  const out={authenticated:true,username:u.username||'',email:u.email||'',nome:u.nome||'',ruolo:'admin',local_user_id:u.id||''};
  localStorage.setItem(SESSION_KEY,JSON.stringify(out));window.__currentUser=out;window.__userRole='admin';return out;
}
function cached(){try{const v=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');return v?.authenticated?v:null}catch{return null}}
function normalizeLogin(v){return String(v||'').trim().toLowerCase()}
function accountFor(login){const q=normalizeLogin(login);return ADMINS.find(a=>normalizeLogin(a.username)===q||normalizeLogin(a.email)===q)||null}
async function login(login,password){
  const acc=accountFor(login);
  if(!acc||!acc.attivo)throw new Error('Credenziali non valide.');
  if(!password)throw new Error('Inserisci username/email e password.');
  const hash=await sha256(PASSWORD_SALT+'|'+password);
  if(hash!==PASSWORD_HASH)throw new Error('Credenziali non valide.');
  return cacheUser(acc);
}
async function logout(){cacheUser(null)}
function current(){return cached()}
function isAuthenticated(){return !!cached()}
function roleLabel(role){return String(role||'').toLowerCase()==='admin'?'Amministratore':String(role||'').toLowerCase()==='operatore'?'Operatore':'Collaboratore'}
function getAccounts(){return ADMINS.map(x=>({...x}))}
async function updateAccount(id,patch={}){
  const u=cached();
  if(!u||id!==u.local_user_id)throw new Error('Per sicurezza puoi modificare solo il tuo account.');
  return u;
}
function createAccount(){throw new Error('Gli account amministrativi sono gestiti dal Gestionale.');}
function removeAccount(){throw new Error('Gli amministratori Nicola e Raffaele sono account protetti.');}
function setActive(){return true}
async function changePassword(){throw new Error('La modifica password è disabilitata in questa versione operativa.');}
window.DG_AUTH={getClient,login,logout,current,isAuthenticated,getAccounts,roleLabel,updateAccount,changePassword};
export{current as a,login as c,updateAccount as d,getAccounts as i,logout as l,createAccount as n,roleLabel as o,removeAccount as r,isAuthenticated as s,changePassword as t,setActive as u,getClient};
