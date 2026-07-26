let idViaggio=new URLSearchParams(location.search).get('id');

creaSeatMap();

async function inviaPrenotazione(){

const prenotazione={
viaggio_id:idViaggio,
nome_cliente:document.getElementById('nome').value,
telefono:document.getElementById('telefono').value,
email:document.getElementById('email').value,
posti:postiSelezionati.join(','),
stato:'in attesa'
};

const {error}=await supabaseClient
.from('prenotazioni')
.insert([prenotazione]);

if(error){
alert('Errore prenotazione');
return;
}

alert('Prenotazione inviata 🚍');

}
