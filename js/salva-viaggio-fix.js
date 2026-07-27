
async function salvaViaggio(){

const bus = document.getElementById('autobus');
const opt = bus.options[bus.selectedIndex];

if(!opt || !bus.value){
alert('Seleziona prima un autobus');
return;
}

const viaggio = {
titolo: document.getElementById('titolo').value,
destinazione: document.getElementById('destinazione').value,
data_partenza: document.getElementById('data').value,
ora_partenza: document.getElementById('ora').value,
prezzo: Number(document.getElementById('prezzo').value || 0),

autobus_id: bus.value,
posti_totali: Number(opt.dataset.posti),

descrizione: document.getElementById('descrizione')?.value || ''
};


const {error}=await supabaseClient
.from('viaggi')
.insert(viaggio);


if(error){
alert('Errore salvataggio: '+error.message);
return;
}

alert('✅ Viaggio salvato con autobus assegnato');

location.href='gestione-viaggi.html';

}
