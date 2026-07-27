async function logoutAdmin(){

await supabaseClient.auth.signOut();

window.location.href='login.html';

}
