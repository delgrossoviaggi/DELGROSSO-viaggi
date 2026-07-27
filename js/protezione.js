async function controlloAccesso(){

const {data}=await supabaseClient.auth.getSession();

if(!data.session){
window.location.href="/gestionale/login.html";
}

}

controlloAccesso();
