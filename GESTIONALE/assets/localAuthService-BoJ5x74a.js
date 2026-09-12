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
  const input=String(v);
  if(globalThis.crypto?.subtle?.digest){
    const data=new TextEncoder().encode(input);
    const buf=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  // Fallback per Safari/WebView o contesti senza WebCrypto.
  const K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
  let h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
  const bytes=Array.from(new TextEncoder().encode(input)); bytes.push(128); while((bytes.length%64)!==56)bytes.push(0); const bits=input.length*8; for(let i=7;i>=0;i--)bytes.push(Math.floor(bits/2**(8*i))&255);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let o=0;o<bytes.length;o+=64){
    const w=new Array(64); for(let i=0;i<16;i++)w[i]=((bytes[o+4*i]<<24)|(bytes[o+4*i+1]<<16)|(bytes[o+4*i+2]<<8)|bytes[o+4*i+3])|0;
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=(rotr(a,7)^rotr(a,18)^(a>>>3)),s1=(rotr(b,17)^rotr(b,19)^(b>>>10));w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}
    let [a,b,c,d,e,f,g,j]=h; for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25), ch=(e&f)^(~e&g), t1=(j+S1+ch+K[i]+w[i])|0, S0=rotr(a,2)^rotr(a,13)^rotr(a,22), maj=(a&b)^(a&c)^(b&c), t2=(S0+maj)|0; j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    h=h.map((x,i)=>x+([a,b,c,d,e,f,g,j][i])|0);
  }
  return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
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
