async function salvaViaggio(){

const {error}=await supabaseClient
.from('viaggi')
.insert({
titolo:document.getElementById('titolo').value,
destinazione:document.getElementById('destinazione').value,
data_partenza:document.getElementById('data').value,
ora_partenza:document.getElementById('ora').value,
prezzo:document.getElementById('prezzo').value,
posti:document.getElementById('posti').value,
descrizione:document.getElementById('descrizione').value
});

if(error){
alert(error.message);
return;
}

alert('Viaggio salvato');
window.location.href='gestione-viaggi.html';

}
