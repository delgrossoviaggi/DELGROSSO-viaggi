async function controllo(){

const {data}=await supabaseClient.auth.getSession();

if(!data.session){
location.href='https://www.delgrossoviaggi.it';
}

}

async function logout(){

await supabaseClient.auth.signOut();

location.href='https://www.delgrossoviaggi.it';

}

controllo();
