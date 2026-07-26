async function inviaPrenotazione(){

const {error}=await supabaseClient
.from('prenotazioni')
.insert({
viaggio_id:document.getElementById('viaggio').value,
nome_cliente:document.getElementById('nome').value,
telefono:document.getElementById('telefono').value,
posti:document.getElementById('posti').value,
stato:'in attesa'
});

if(error){
document.getElementById('msg').innerText=error.message;
return;
}

document.getElementById('msg').innerText='Prenotazione inviata 🚍';

}
