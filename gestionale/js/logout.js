async function logoutAdmin(){

await supabaseClient.auth.signOut();

window.location.href='https://www.delgrossoviaggi.it';

}
