async function caricaCalendario(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza',{ascending:true});


const box=document.getElementById('calendario');


if(error){
console.error(error);
return;
}


box.innerHTML='';


data.forEach(v=>{

const data = new Date(v.data_partenza)
.toLocaleDateString('it-IT');


box.innerHTML += `

<div class="evento">

<h2>🚍 ${v.titolo}</h2>

<p>📍 ${v.destinazione || ''}</p>

<p>📅 ${data}</p>

<p>💶 € ${v.prezzo || 0}</p>

<p>🚌 ${v.autobus || ''}</p>

<p>Stato: ${v.stato || ''}</p>

<a href="dettaglio-viaggio.html?id=${v.id}">
Apri viaggio
</a>

</div>

`;

});


}

caricaCalendario();
