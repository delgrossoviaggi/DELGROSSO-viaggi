async function verificaAccesso(){

const {data}=await supabaseClient.auth.getSession();

if(!data.session){
window.location.href="login.html";
}

}

async function logoutAdmin(){

await supabaseClient.auth.signOut();

window.location.href="login.html";

}

verificaAccesso();
