const id = new URLSearchParams(location.search).get('id');


async function caricaViaggio(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.eq('id',id)
.single();

if(error){
console.error(error);
return;
}

document.getElementById('titolo').value=data.titolo || '';
document.getElementById('destinazione').value=data.destinazione || '';
document.getElementById('data').value=data.data_partenza || '';
document.getElementById('prezzo').value=data.prezzo || '';
document.getElementById('stato').value=data.stato || 'bozza';
document.getElementById('locandina').value=data.locandina || '';

}


async function salvaModifiche(){

const aggiornamento={

titolo:document.getElementById('titolo').value,
destinazione:document.getElementById('destinazione').value,
data_partenza:document.getElementById('data').value,
prezzo:document.getElementById('prezzo').value,
stato:document.getElementById('stato').value,
locandina:document.getElementById('locandina').value

};


const {error}=await supabaseClient
.from('viaggi')
.update(aggiornamento)
.eq('id',id);


if(error){
console.error(error);
alert('Errore aggiornamento');
return;
}


alert('Viaggio aggiornato 🚍');

}


caricaViaggio();
