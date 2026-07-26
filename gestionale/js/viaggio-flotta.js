let flotta=[];

async function caricaAutobus(){

const {data,error}=await supabaseClient
.from('autobus')
.select('*');

if(error){
console.error(error);
return;
}

flotta=data||[];

const select=document.getElementById('autobus');

flotta.forEach(bus=>{
select.innerHTML += `
<option value="${bus.id}">
${bus.nome} - ${bus.tipo} (${bus.posti_totali} posti)
</option>`;
});

}

document.getElementById('autobus').addEventListener('change',()=>{

const id=document.getElementById('autobus').value;

const bus=flotta.find(x=>x.id===id);

if(bus){
document.getElementById('infoBus').innerHTML=
`
🚌 ${bus.tipo}<br>
💺 Posti: ${bus.posti_totali}<br>
💺 Seat Map: ${bus.tipo}
`;
}

});


async function salvaViaggio(){

const bus=flotta.find(
x=>x.id===document.getElementById('autobus').value
);

const viaggio={
titolo:document.getElementById('titolo').value,
destinazione:document.getElementById('destinazione').value,
data_partenza:document.getElementById('data').value,
autobus:bus ? bus.tipo : null,
posti_totali:bus ? bus.posti_totali : 0
};

const {error}=await supabaseClient
.from('viaggi')
.insert([viaggio]);

if(error){
console.error(error);
alert('Errore salvataggio viaggio');
return;
}

alert('Viaggio creato correttamente 🚍');

}

caricaAutobus();
