// Login Gestionale Del Grosso

async function loginAdmin(event){
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if(error){
        alert("Accesso non riuscito");
        return;
    }

    const user = data.user;

    const { data: admin, error: adminError } = await supabaseClient
        .from("admin_users")
        .select("*")
        .eq("user_id", user.id)
        .single();

    if(adminError || !admin){
        await supabaseClient.auth.signOut();
        alert("Utente non autorizzato");
        return;
    }

    window.location.href = "dashboard.html";
}


async function logoutAdmin(){
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}
