async function salvaPubblicazione(){

const viaggio={
titolo:document.getElementById('titolo').value,
destinazione:document.getElementById('destinazione').value,
data_partenza:document.getElementById('data').value,
prezzo:document.getElementById('prezzo').value,
locandina:document.getElementById('locandina').value,
stato:document.getElementById('stato').value
};

const {error}=await supabaseClient
.from('viaggi')
.insert([viaggio]);

if(error){
console.error(error);
alert('Errore pubblicazione');
return;
}

alert('Viaggio pubblicato 🚍');

}
