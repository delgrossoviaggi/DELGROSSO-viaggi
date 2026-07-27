async function caricaCalendario(){

const {data}=await supabaseClient
.from('viaggi')
.select('*')
.order('data_partenza');

const box=document.getElementById('calendario');

(data||[]).forEach(v=>{

box.innerHTML += `
<div class="card">
<h3>🚍 ${v.titolo || ''}</h3>
<p>📅 ${v.data_partenza || ''}</p>
<p>📍 ${v.destinazione || ''}</p>
<a href="dettaglio-viaggio.html?id=${v.id}">
Apri viaggio
</a>
</div>`;

});

}

caricaCalendario();
