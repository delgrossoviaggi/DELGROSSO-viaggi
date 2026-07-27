async function caricaFlotta(){

const {data,error}=await supabaseClient
.from('flotta')
.select('*')
.eq('stato','Disponibile');

const select=document.getElementById('autobus');

select.innerHTML='';

(data || []).forEach(bus=>{

select.innerHTML += `
<option value="${bus.id}" data-posti="${bus.posti}">
${bus.nome} (${bus.posti} posti)
</option>
`;

});

aggiornaPosti();

select.addEventListener('change', aggiornaPosti);

}

function aggiornaPosti(){

const select=document.getElementById('autobus');
const opt=select.options[select.selectedIndex];

if(opt){
document.getElementById('posti').value =
opt.dataset.posti + ' posti';
}

}


async function salvaViaggio(){

const select=document.getElementById('autobus');
const opt=select.options[select.selectedIndex];

const {error}=await supabaseClient
.from('viaggi')
.insert({

titolo:document.getElementById('titolo').value,
destinazione:document.getElementById('destinazione').value,
data_partenza:document.getElementById('data').value,
ora_partenza:document.getElementById('ora').value,
prezzo:document.getElementById('prezzo').value,
descrizione:document.getElementById('descrizione').value,
autobus_id:select.value,
posti_totali:Number(opt.dataset.posti)

});


if(error){

document.getElementById('messaggio').innerText =
'Errore: '+error.message;

return;

}

document.getElementById('messaggio').innerText =
'✅ Viaggio salvato correttamente';

}


caricaFlotta();
