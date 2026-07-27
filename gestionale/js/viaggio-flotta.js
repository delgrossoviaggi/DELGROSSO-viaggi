async function caricaAutobus(){

const {data,error}=await supabaseClient
.from('flotta')
.select('*')
.eq('stato','Disponibile');

const select=document.getElementById('autobus');

(data||[]).forEach(bus=>{

select.innerHTML += `
<option value="${bus.id}" data-posti="${bus.posti}">
${bus.nome} (${bus.posti} posti)
</option>
`;

});

select.onchange=function(){
const opt=this.options[this.selectedIndex];
document.getElementById('posti').value=opt.dataset.posti;
}

}


async function salvaViaggio(){

const bus=document.getElementById('autobus');
const opt=bus.options[bus.selectedIndex];

const {error}=await supabaseClient
.from('viaggi')
.insert({
titolo:document.getElementById('titolo').value,
destinazione:document.getElementById('destinazione').value,
data_partenza:document.getElementById('data').value,
prezzo:document.getElementById('prezzo').value,
autobus_id:bus.value,
posti_totali:opt.dataset.posti
});


if(error){
alert(error.message);
return;
}

alert('Viaggio creato con autobus assegnato 🚍');
window.location.href='gestione-viaggi.html';

}


caricaAutobus();
