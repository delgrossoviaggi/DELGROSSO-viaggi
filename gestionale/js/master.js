async function controllo(){

const {data}=await supabaseClient.auth.getSession();

if(!data.session){
location.href='/gestionale/login.html';
}

}

async function logout(){

await supabaseClient.auth.signOut();

location.href='/gestionale/login.html';

}

controllo();
