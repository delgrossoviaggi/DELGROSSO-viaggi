async function controllaAdmin(){

const {data}=await supabaseClient.auth.getSession();

if(!data.session){
    window.location.href='/gestionale/login.html';
}

}

controllaAdmin();
