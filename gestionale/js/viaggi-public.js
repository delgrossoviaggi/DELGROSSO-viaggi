async function caricaViaggi(){

const {data,error}=await supabaseClient
.from('viaggi')
.select('*')
.eq('stato','pubblicato');

const box=document.getElementById('listaViaggi');

if(error){box.innerHTML='Errore caricamento'; return;}

data.forEach(v=>{
box.innerHTML += `
<div class="card">
<h2>${v.titolo}</h2>
<p>${v.destinazione}</p>
<p>${v.data_partenza}</p>
<p>€ ${v.prezzo}</p>
<a href="prenota.html?id=${v.id}">
<button>Prenota ora</button>
</a>
</div>`;
});

}

caricaViaggi();
